import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { PedidoDto } from '../../core/models/logistica.models';

export interface PedidoItemUI {
  id: string;
  codigo: string;
  prioridad?: 'ALTA' | 'URGENTE';
  clienteNombre: string;
  clienteTelefono: string;
  destinatarioNombre: string;
  fechaPrometida: string;
  registroInfo: string;
  esAnticipado: boolean;
  esHoy: boolean;
  zonaNombre: string;
  zonaColor: string;
  ventanaHoraria: string;
  cargaTitulo: string;
  cargaIcono: string;
  cargaProgreso: string;
  cargaBarClass: string;
  estadoPill: string;
  estadoColor: string;
  sinRepartidor?: boolean;
  rawPedido?: PedidoDto;
}

@Component({
  selector: 'app-pedidos-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pedidos.page.html',
})
export class PedidosPage {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  // Filter State
  readonly activeTab = signal<'todos' | 'anticipados' | 'hoy' | 'pendientes'>('todos');
  readonly searchQuery = signal<string>('');
  readonly selectedIds = signal<Set<string>>(new Set());

  // Slideover & Toast UI State
  readonly drawerOpen = signal<boolean>(false);
  readonly toastVisible = signal<boolean>(false);
  readonly toastTitle = signal<string>('Pedido Registrado');
  readonly toastMessage = signal<string>('Asignado con éxito a Zona Oriente - Las Condes A');
  private toastTimer: any = null;

  // New Order Form state
  readonly formFecha = signal<string>('2025-02-14');
  readonly formVentana = signal<string>('10:00 - 12:00 hrs (Pico Matutino)');
  readonly formCliente = signal<string>('Sebastián Valenzuela');
  readonly formEmail = signal<string>('sebastian@empresa.com');
  readonly formDestinatario = signal<string>('Valentina Ramos');
  readonly formTelefono = signal<string>('+56 9 9123 4567');
  readonly formDireccion = signal<string>('Av. Isidora Goyenechea 3000, Dpto 804, Las Condes');
  readonly formZona = signal<string>('Zona Oriente - Sector Residencial Las Condes A');
  readonly formTipoCarga = signal<'flores' | 'pasteleria' | 'general'>('flores');
  readonly formNotas = signal<string>(
    'Dejar con conserje Don Manuel si no responden citófono. Entrega sorpresa, no llamar antes.',
  );

  // Local newly created orders to display immediately
  readonly localOrders = signal<PedidoItemUI[]>([]);

  // Combined orders (backend + local)
  readonly allOrders = computed<PedidoItemUI[]>(() => {
    const backendOrders = this.operations.pedidos().map((p): PedidoItemUI => {
      const esAnticipado = p.fechaEntrega > this.operations.fecha;
      const esHoy = p.fechaEntrega === this.operations.fecha;
      const sinRepartidor = p.estado === 'Pendiente' || !p.rutaId;
      return {
        id: p.id,
        codigo: `#${this.operations.short(p.id)}`,
        prioridad: sinRepartidor ? 'URGENTE' : undefined,
        clienteNombre: p.clienteNombre,
        clienteTelefono: p.clienteTelefono || '+56 9 8412 0000',
        destinatarioNombre: p.clienteNombre,
        fechaPrometida: esHoy ? 'Hoy, Entrega' : p.fechaEntrega,
        registroInfo: `Reg: ${p.fechaEntrega} • ${p.horaEntrega?.slice(0, 5) || '12:00'}`,
        esAnticipado,
        esHoy,
        zonaNombre: this.operations.zoneName(p.zonaId) || 'Zona Metropolitana',
        zonaColor: 'bg-status-routing',
        ventanaHoraria: `${p.horaEntrega?.slice(0, 5) || '10:00'} - 18:00 hrs`,
        cargaTitulo: 'Paquete Despacho Standard',
        cargaIcono: 'inventory_2',
        cargaProgreso: '50%',
        cargaBarClass: 'bg-primary',
        estadoPill: sinRepartidor ? 'Sin Repartidor' : this.operations.label(p.estado),
        estadoColor: sinRepartidor
          ? 'bg-surface-container text-outline'
          : p.estado === 'Entregado'
            ? 'bg-status-delivered/15 text-status-delivered'
            : p.estado === 'EnCamino'
              ? 'bg-status-in-transit/15 text-status-in-transit'
              : 'bg-status-routing/15 text-status-routing',
        sinRepartidor,
        rawPedido: p,
      };
    });

    return [...this.localOrders(), ...backendOrders];
  });

  // Filtered orders based on selected tab and search term
  readonly filteredOrders = computed<PedidoItemUI[]>(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().toLowerCase().trim();

    return this.allOrders().filter((order) => {
      // Tab matching
      if (tab === 'anticipados' && !order.esAnticipado) return false;
      if (tab === 'hoy' && !order.esHoy) return false;
      if (tab === 'pendientes' && !order.sinRepartidor) return false;

      // Query matching
      if (query) {
        const matchesCode = order.codigo.toLowerCase().includes(query);
        const matchesClient = order.clienteNombre.toLowerCase().includes(query);
        const matchesRecipient = order.destinatarioNombre.toLowerCase().includes(query);
        const matchesZone = order.zonaNombre.toLowerCase().includes(query);
        const matchesPhone = order.clienteTelefono.toLowerCase().includes(query);
        return matchesCode || matchesClient || matchesRecipient || matchesZone || matchesPhone;
      }

      return true;
    });
  });

  // Fast KPI metrics
  readonly anticipadosCount = computed(
    () => this.allOrders().filter((o) => o.esAnticipado).length,
  );
  readonly pendientesCount = computed(
    () => this.allOrders().filter((o) => o.sinRepartidor).length,
  );
  readonly hoyCount = computed(() => this.allOrders().filter((o) => o.esHoy).length);
  readonly totalOrdersCount = computed(() => this.allOrders().length);

  constructor() {
    this.operations.view.set('Pedidos');
  }

  // Keyboard shortcut listener for ⌘F / Ctrl+F and Escape
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.drawerOpen()) {
      this.closeOrderSheet();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
    }
  }

  setActiveTab(tab: 'todos' | 'anticipados' | 'hoy' | 'pendientes') {
    this.activeTab.set(tab);
  }

  openOrderSheet() {
    this.drawerOpen.set(true);
  }

  closeOrderSheet() {
    this.drawerOpen.set(false);
  }

  setTipoCarga(tipo: 'flores' | 'pasteleria' | 'general') {
    this.formTipoCarga.set(tipo);
  }

  toggleSelectAll(checked: boolean) {
    const next = new Set<string>();
    if (checked) {
      this.filteredOrders().forEach((o) => next.add(o.id));
    }
    this.selectedIds.set(next);
  }

  toggleSelectRow(id: string) {
    const next = new Set(this.selectedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedIds.set(next);
  }

  isRowSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  isAllSelected(): boolean {
    const orders = this.filteredOrders();
    return orders.length > 0 && orders.every((o) => this.selectedIds().has(o.id));
  }

  quickAssign(order: PedidoItemUI) {
    order.sinRepartidor = false;
    order.estadoPill = 'Ruta Optimizada #05';
    order.estadoColor = 'bg-status-routing/15 text-status-routing';
    this.showToast(
      `Pedido ${order.codigo} Asignado`,
      `Enrutado dinámicamente a la flota de ${order.zonaNombre}`,
    );
  }

  saveOrderAndRoute() {
    const nextIdNumber = Math.floor(9403 + Math.random() * 50);
    const newCode = `#PED-${nextIdNumber}`;
    const isValentine = this.formFecha().includes('02-14');

    const newOrder: PedidoItemUI = {
      id: `PED-${nextIdNumber}`,
      codigo: newCode,
      prioridad: isValentine ? 'ALTA' : undefined,
      clienteNombre: this.formCliente() || 'Sebastián Valenzuela',
      clienteTelefono: this.formTelefono() || '+56 9 9123 4567',
      destinatarioNombre: this.formDestinatario() || 'Valentina Ramos',
      fechaPrometida: this.formFecha() === '2025-02-14' ? '14 Feb 2025' : this.formFecha(),
      registroInfo: 'Reg: Ahora • Anticipado',
      esAnticipado: true,
      esHoy: false,
      zonaNombre: this.formZona(),
      zonaColor: 'bg-status-routing',
      ventanaHoraria: this.formVentana().split('(')[0].trim(),
      cargaTitulo:
        this.formTipoCarga() === 'flores'
          ? 'Ramo Premium & Tarjeta'
          : this.formTipoCarga() === 'pasteleria'
            ? 'Caja Bombones Artesanales'
            : 'Paquete de Obsequio',
      cargaIcono:
        this.formTipoCarga() === 'flores'
          ? 'local_florist'
          : this.formTipoCarga() === 'pasteleria'
            ? 'cake'
            : 'redeem',
      cargaProgreso: '45%',
      cargaBarClass: this.formTipoCarga() === 'flores' ? 'bg-tint-teal' : 'bg-secondary',
      estadoPill: 'Ruta Optimizada #09',
      estadoColor: 'bg-status-routing/15 text-status-routing',
    };

    // Prepend new order locally
    this.localOrders.update((prev) => [newOrder, ...prev]);

    // Close drawer
    this.closeOrderSheet();

    // Show macOS toast notification
    this.showToast(
      `Pedido ${newCode} Registrado`,
      `Asignado con éxito a ${this.formZona()}`,
    );
  }

  showToast(title: string, message: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTitle.set(title);
    this.toastMessage.set(message);
    this.toastVisible.set(true);

    this.toastTimer = setTimeout(() => {
      this.toastVisible.set(false);
    }, 4500);
  }
}

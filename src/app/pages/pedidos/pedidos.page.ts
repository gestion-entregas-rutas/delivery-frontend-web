import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
  OnDestroy,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { RouteAssignmentService } from '../../core/services/route-assignment.service';
import {
  PedidoDto,
  PuntoDto,
  DetallesPedidoDto,
  RegistrarPedidoRequest,
} from '../../core/models/logistica.models';
import { zoneForPoint } from '../../core/utils/presentation';
import { PedidoDetailService } from '../../core/services/pedido-detail.service';
import { AddressPicker } from '../../shared/components/address-picker/address-picker';
import { LocalLocationService } from '../../core/services/local-location.service';
import { deliveryCoverage } from '../../core/utils/delivery-coverage';
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
  sinRepartidor: boolean;
  rawPedido: PedidoDto;
}
@Component({
  selector: 'app-pedidos-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AddressPicker],
  templateUrl: './pedidos.page.html',
  styleUrl: './pedidos.page.css',
})
export class PedidosPage implements OnDestroy {
  readonly local = inject(LocalLocationService);
  readonly operations = inject(OperationsService);
  readonly detail = inject(PedidoDetailService);
  readonly filtersOpen = signal(false);
  @ViewChild('datePicker') datePicker?: ElementRef<HTMLInputElement>;
  chooseDate() {
    try {
      this.datePicker?.nativeElement.showPicker();
    } catch {
      this.datePicker?.nativeElement.focus();
    }
  }
  readonly forms = inject(OperationFormsService);
  readonly assignment = inject(RouteAssignmentService);
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  readonly activeTab = signal<'todos' | 'anticipados' | 'hoy' | 'pendientes'>('todos');
  readonly searchQuery = signal(this.operations.search || '');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly drawerOpen = signal(false);
  readonly toastVisible = signal(false);
  readonly toastTitle = signal('');
  readonly toastMessage = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private editRequest = 0;
  readonly formFecha = signal(this.operations.fecha);
  readonly formHora = signal('16:00');
  readonly formVentana = signal('afternoon');
  readonly formCliente = signal('');

  onVentanaChange(ventana: string) {
    this.formVentana.set(ventana);
    switch (ventana) {
      case 'morning':
        this.formHora.set('11:00');
        break;
      case 'afternoon':
        this.formHora.set('16:00');
        break;
      case 'evening':
        this.formHora.set('19:30');
        break;
      case 'full':
        this.formHora.set('18:00');
        break;
    }
  }

  onHoraChange(hora: string) {
    this.formHora.set(hora);
    if (!hora) return;
    const parts = hora.split(':');
    const h = parseInt(parts[0], 10);
    if (isNaN(h)) return;
    if (h >= 9 && h <= 13) {
      this.formVentana.set('morning');
    } else if (h > 13 && h <= 18) {
      this.formVentana.set('afternoon');
    } else if (h > 18 && h <= 21) {
      this.formVentana.set('evening');
    } else {
      this.formVentana.set('full');
    }
  }

  formatVentanaHoraria(horaEntrega: string): string {
    if (!horaEntrega) return 'No informada';
    const hora = horaEntrega.slice(0, 5);
    const h = parseInt(hora.split(':')[0], 10);
    if (h >= 9 && h <= 13) return 'Mañana (09:00 - 13:00)';
    if (h > 13 && h <= 18) return 'Tarde (14:00 - 18:00)';
    if (h > 18 && h <= 21) return 'Noche (18:00 - 21:00)';
    return 'Jornada Completa (' + hora + ')';
  }
  readonly editing = signal<PedidoDto | null>(null);
  readonly editingPoint = signal<PuntoDto | null>(null);
  readonly formRemitente = signal('');
  readonly formRemitenteTelefono = signal('');
  readonly formDestinatarioCorreo = signal('');
  readonly formPeso = signal<number | null>(null);
  readonly formFragil = signal<boolean | null>(null);
  readonly formPrioridad = signal<DetallesPedidoDto['prioridad']>(null);
  readonly formEmail = signal('');
  readonly formTelefono = signal('');
  readonly formDireccion = signal('');
  readonly formTipoCarga = signal<DetallesPedidoDto['tipoCarga']>(null);
  readonly formNotas = signal('');
  readonly formPoint = signal<PuntoDto | null>(null);
  readonly coverage = computed(() =>
    deliveryCoverage(
      this.formPoint(),
      this.operations.zonas(),
      this.local.location()?.ubicacion || null,
    ),
  );
  readonly formZona = computed(
    () =>
      zoneForPoint(this.formPoint(), this.operations.zonas())?.nombre ||
      (this.formPoint() ? 'Fuera del área de cobertura' : 'Selecciona una ubicación'),
  );
  readonly allOrders = computed<PedidoItemUI[]>(() =>
    this.operations.pedidos().map((p) => ({
      id: p.id,
      codigo: '#' + this.operations.short(p.id),
      clienteNombre: p.detalles?.remitenteNombre || 'No informado',
      clienteTelefono: p.detalles?.remitenteTelefono || p.clienteTelefono,
      destinatarioNombre: p.destinatarioNombre || p.clienteNombre,
      prioridad:
        p.detalles?.prioridad === 'Alta'
          ? 'ALTA'
          : p.detalles?.prioridad === 'Urgente'
            ? 'URGENTE'
            : undefined,
      fechaPrometida: p.fechaEntrega,
      registroInfo: 'Reg: ' + new Date(p.registradoEn).toLocaleString('es-EC'),
      esAnticipado: p.fechaEntrega > this.operations.today,
      esHoy: p.fechaEntrega === this.operations.today,
      zonaNombre: this.operations.zoneName(p.zonaId),
      zonaColor: 'bg-status-routing',
      ventanaHoraria: this.formatVentanaHoraria(p.horaEntrega),
      cargaTitulo:
        [
          p.detalles?.tipoCarga,
          p.detalles?.pesoKg != null ? p.detalles.pesoKg + ' kg' : null,
          p.detalles?.fragil === true
            ? 'Frágil'
            : p.detalles?.fragil === false
              ? 'No frágil'
              : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'No informada',
      cargaIcono: 'inventory_2',
      cargaProgreso: '0%',
      cargaBarClass: 'bg-primary',
      estadoPill: this.operations.label(p.estado),
      estadoColor:
        p.estado === 'Entregado'
          ? 'bg-status-delivered/15 text-tertiary'
          : p.estado === 'Cancelado'
            ? 'bg-status-urgent/15 text-status-urgent'
            : p.estado === 'EnCamino'
              ? 'bg-status-in-transit/15 text-on-surface-variant'
              : 'bg-status-routing/15 text-status-routing',
      sinRepartidor: p.estado === 'Pendiente' && !p.rutaId,
      rawPedido: p,
    })),
  );
  readonly filteredOrders = computed<PedidoItemUI[]>(() => {
    const orders = this.allOrders();
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.codigo.toLowerCase().includes(q) ||
        o.clienteNombre.toLowerCase().includes(q) ||
        o.clienteTelefono.toLowerCase().includes(q) ||
        o.destinatarioNombre.toLowerCase().includes(q) ||
        o.zonaNombre.toLowerCase().includes(q) ||
        o.rawPedido.direccion.toLowerCase().includes(q),
    );
  });
  readonly anticipadosCount = computed(() => {
    this.operations.resumen();
    return this.operations.desde === this.operations.scheduledDate() && !this.operations.hasta
      ? this.operations.total()
      : '—';
  });
  readonly pendientesCount = computed(() => this.operations.count('Pendiente'));
  readonly hoyCount = computed(() => {
    this.operations.resumen();
    return this.operations.fecha === this.operations.today &&
      !this.operations.desde &&
      !this.operations.hasta
      ? this.operations.total()
      : '—';
  });
  readonly totalOrdersCount = computed(() => this.operations.total());
  constructor() {
    this.operations.view.set('Pedidos');
  }
  @HostListener('window:keydown', ['$event']) handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (document.activeElement === this.searchInput?.nativeElement && this.searchQuery()) {
        this.onSearchChange('');
        return;
      }
      this.closeOrderSheet();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
      this.searchInput?.nativeElement.select();
    }
  }
  setActiveTab(tab: 'todos' | 'anticipados' | 'hoy' | 'pendientes') {
    this.activeTab.set(tab);
    this.operations.estado = tab === 'pendientes' ? 'Pendiente' : '';
    this.operations.desde = tab === 'anticipados' ? this.operations.scheduledDate() : '';
    this.operations.hasta = '';
    if (tab === 'hoy') this.operations.fecha = this.operations.today;
    void this.operations.changeDate();
  }
  onSearchChange(value: string) {
    this.searchQuery.set(value);
    this.searchOnServer(value);
  }
  searchOnServer(value: string) {
    clearTimeout(this.searchTimer);
    this.operations.search = value.slice(0, 150);
    this.searchTimer = setTimeout(() => void this.operations.refresh(true), 350);
  }
  applyRange() {
    if (
      this.operations.desde &&
      this.operations.hasta &&
      this.operations.desde > this.operations.hasta
    ) {
      this.operations.error.set('Desde no puede ser posterior a Hasta.');
      return;
    }
    void this.operations.refresh(true);
  }
  selectExactDate() {
    this.operations.desde = '';
    this.operations.hasta = '';
    void this.operations.changeDate();
  }
  openOrderSheet() {
    this.editing.set(null);
    this.editingPoint.set(null);
    this.formRemitente.set('');
    this.formRemitenteTelefono.set('');
    this.formEmail.set('');
    this.formDestinatarioCorreo.set('');
    this.formNotas.set('');
    this.formTipoCarga.set(null);
    this.formPeso.set(null);
    this.formFragil.set(null);
    this.formPrioridad.set(null);
    this.formFecha.set(this.operations.fecha);
    this.formVentana.set('afternoon');
    this.formHora.set('16:00');
    this.formCliente.set('');
    this.formTelefono.set('');
    this.formDireccion.set('');
    this.formPoint.set(null);
    this.operations.error.set('');
    this.drawerOpen.set(true);
  }
  async editOrder(id: string) {
    if (this.operations.saving()) return;
    const request = ++this.editRequest;
    try {
      const p = await firstValueFrom(this.operations.api.obtenerPedido(id));
      if (this.destroyed || request !== this.editRequest) return;
      if (p.estado !== 'Pendiente' || p.version == null) {
        this.operations.error.set('Solo puedes editar un pedido pendiente con versión vigente.');
        return;
      }
      this.openOrderSheet();
      this.editing.set(p);
      this.editingPoint.set(p.ubicacion);
      this.formCliente.set(p.clienteNombre);
      this.formTelefono.set(p.clienteTelefono);
      this.formDireccion.set(p.direccion);
      this.formPoint.set(p.ubicacion);
      this.formFecha.set(p.fechaEntrega);
      const horaStr = p.horaEntrega ? p.horaEntrega.slice(0, 5) : '16:00';
      this.onHoraChange(horaStr);
      const d = p.detalles;
      this.formRemitente.set(d?.remitenteNombre || '');
      this.formRemitenteTelefono.set(d?.remitenteTelefono || '');
      this.formEmail.set(d?.remitenteCorreo || '');
      this.formDestinatarioCorreo.set(d?.destinatarioCorreo || '');
      this.formNotas.set(d?.observaciones || '');
      this.formTipoCarga.set(d?.tipoCarga ?? null);
      this.formPeso.set(d?.pesoKg ?? null);
      this.formFragil.set(d?.fragil ?? null);
      this.formPrioridad.set(d?.prioridad ?? null);
    } catch (e) {
      this.operations.showError(e);
    }
  }
  closeOrderSheet() {
    if (!this.operations.saving()) this.drawerOpen.set(false);
  }
  setTipoCarga(tipo: DetallesPedidoDto['tipoCarga']) {
    this.formTipoCarga.set(tipo);
  }
  toggleSelectAll(checked: boolean) {
    this.selectedIds.set(new Set(checked ? this.filteredOrders().map((o) => o.id) : []));
  }
  toggleSelectRow(id: string) {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
  }
  isRowSelected(id: string) {
    return this.selectedIds().has(id);
  }
  isAllSelected() {
    return (
      this.filteredOrders().length > 0 &&
      this.filteredOrders().every((o) => this.isRowSelected(o.id))
    );
  }
  quickAssign(order: PedidoItemUI) {
    void this.assignment.open(order.rawPedido);
  }
  viewRoute(order: PedidoItemUI) {
    if (order.rawPedido.rutaId) this.operations.showOrderRoute(order.rawPedido.rutaId);
  }
  async saveOrderAndRoute() {
    if (this.operations.saving()) return;
    const point = this.formPoint();
    if (
      !point ||
      !this.formCliente().trim() ||
      !this.formTelefono().trim() ||
      !this.formDireccion().trim()
    ) {
      this.operations.error.set(
        'Completa nombre, teléfono, dirección y selecciona la ubicación en el mapa.',
      );
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.formFecha()) || this.formFecha() < this.operations.today) {
      this.operations.error.set('La fecha de entrega debe ser hoy o futura.');
      return;
    }
    if (!this.coverage().covered) {
      this.operations.error.set(this.coverage().message);
      return;
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(this.formHora())) {
      this.operations.error.set('Selecciona una hora de entrega válida.');
      return;
    }
    if (Boolean(this.formRemitente().trim()) !== Boolean(this.formRemitenteTelefono().trim())) {
      this.operations.error.set('Completa juntos nombre y teléfono del remitente.');
      return;
    }
    if (
      [this.formEmail(), this.formDestinatarioCorreo()].some(
        (v) => v && (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)),
      )
    ) {
      this.operations.error.set('Revisa el formato de los correos.');
      return;
    }
    const peso = this.formPeso();
    if (
      peso != null &&
      (!Number.isFinite(peso) ||
        peso <= 0 ||
        peso > 10000 ||
        Math.abs(peso * 1000 - Math.round(peso * 1000)) > 1e-7)
    ) {
      this.operations.error.set(
        'El peso debe ser mayor que 0 y hasta 10000 kg, con hasta tres decimales.',
      );
      return;
    }
    if (
      this.formNotas().length > 2000 ||
      this.formRemitente().length > 150 ||
      this.formRemitenteTelefono().length > 30
    ) {
      this.operations.error.set('Revisa la longitud del remitente y las observaciones.');
      return;
    }
    this.operations.saving.set(true);
    this.operations.error.set('');
    try {
      const details: DetallesPedidoDto = {
        remitenteNombre: this.formRemitente().trim() || null,
        remitenteTelefono: this.formRemitenteTelefono().trim() || null,
        remitenteCorreo: this.formEmail().trim() || null,
        destinatarioCorreo: this.formDestinatarioCorreo().trim() || null,
        observaciones: this.formNotas().trim() || null,
        tipoCarga: this.formTipoCarga() ?? null,
        pesoKg: peso,
        fragil: this.formFragil(),
        prioridad: this.formPrioridad() ?? null,
      };
      const body: RegistrarPedidoRequest = {
        clienteNombre: this.formCliente().trim(),
        clienteTelefono: this.formTelefono().trim(),
        direccion: this.formDireccion().trim(),
        fechaEntrega: this.formFecha(),
        horaEntrega: this.formHora().length === 5 ? this.formHora() + ':00' : this.formHora(),
        latitud: point.latitud,
        longitud: point.longitud,
        ...(Object.values(details).some((v) => v != null)
          ? { detalles: details }
          : this.editing()
            ? { detalles: null }
            : {}),
      };
      const editing = this.editing();
      if (!editing) return;
      if (editing.version == null) throw new Error('Recarga el pedido antes de editar.');
      if (
        point.latitud === editing.ubicacion.latitud &&
        point.longitud === editing.ubicacion.longitud
      )
        body.zonaId = editing.zonaId;
      const updated = await firstValueFrom(
        this.operations.api.actualizarPedido(editing.id, { ...body, version: editing.version }),
      );
      this.drawerOpen.set(false);
      this.operations.fecha = updated.fechaEntrega;
      await this.operations.changeDate();
      this.showToast(
        'Pedido actualizado',
        'Cambios guardados. La edición no asigna una ruta automáticamente.',
      );
    } catch (e) {
      if ((e as any)?.status === 409 && this.editing()) {
        const editingId = this.editing()!.id;
        this.editing.set({ ...this.editing()!, version: undefined });
        try {
          const current = await firstValueFrom(this.operations.api.obtenerPedido(editingId));
          this.operations.pedidos.update((all) =>
            all.map((p) => (p.id === current.id ? current : p)),
          );
        } catch {}
        this.operations.showError(e);
        this.operations.error.update(
          (message) =>
            message +
            ' Tus cambios siguen en el formulario. Recarga el pedido antes de volver a guardar.',
        );
        return;
      }
      this.operations.showError(e);
    } finally {
      this.operations.saving.set(false);
    }
  }
  showToast(title: string, message: string) {
    clearTimeout(this.toastTimer);
    this.toastTitle.set(title);
    this.toastMessage.set(message);
    this.toastVisible.set(true);
    this.toastTimer = setTimeout(() => this.toastVisible.set(false), 4500);
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.editRequest++;
    clearTimeout(this.toastTimer);
    clearTimeout(this.searchTimer);
  }
}

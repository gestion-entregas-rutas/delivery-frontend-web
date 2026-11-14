import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { RouteAssignmentService } from '../../core/services/route-assignment.service';
import { PedidoDto, RutaDto } from '../../core/models/logistica.models';
import { initialsAvatar } from '../../core/utils/presentation';
import { RouteWorkspace } from '../../shared/components/route-workspace/route-workspace';
import { RouteOrderService } from '../../core/services/route-order.service';
export interface PendingOrder {
  raw: PedidoDto;
  code: string;
  zone: string;
  zoneLabel: string;
  badgeClass: string;
  window: string;
  isUrgent: boolean;
  client: string;
  address: string;
  details: string;
  tag: string;
}

export interface SimulationEvent {
  id: string;
  type: 'auto' | 'new_route' | 'evaluating';
  badge: string;
  badgeClass: string;
  timeAgo: string;
  borderClass: string;
  icon: string;
  iconClass: string;
  titleHtml: string;
  subtitle: string;
  actionText?: string;
  capacityText: string;
  capacityBadge: string;
  capacityBadgeClass: string;
}

export interface RouteStop {
  pedidoId: string;
  num: number;
  address: string;
  time: string;
  status: 'delivered' | 'in_transit' | 'pending' | 'auto_inserted';
}

export interface RouteCardItem {
  raw: RutaDto;
  id: string;
  routeNumber: string;
  zone: string;
  zoneBadgeClass: string;
  driverName: string;
  driverAvatar: string;
  vehicle: string;
  vehicleIcon: string;
  statusText: string;
  statusBadgeClass: string;
  cupoText: string;
  cupoSubtext: string;
  cupoSubtextClass: string;
  progressPercent: number;
  progressBarClass: string;
  stops: RouteStop[];
  hasDropPlaceholder?: boolean;
  distanceTime: string;
  actionButtonLabel: string;
}

@Component({
  selector: 'app-rutas-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouteWorkspace],
  templateUrl: './rutas.page.html',
})
export class RutasPage implements OnDestroy {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);
  readonly assignment = inject(RouteAssignmentService);
  readonly order = inject(RouteOrderService);
  readonly selectedModel = signal('Planificación configurada en el backend');
  readonly models = ['Planificación configurada en el backend'];
  readonly pendingFilter = signal('Todas');
  readonly pendingSearch = signal('');
  readonly viewMode = signal<'mosaico' | 'cronograma' | 'mapa'>(
    this.operations.selected() ? 'mapa' : 'mosaico',
  );
  readonly optimizing = this.operations.saving;
  readonly toastMessage = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;
  readonly pendingOrders = computed<PendingOrder[]>(() =>
    this.operations
      .pedidos()
      .filter((p) => p.estado === 'Pendiente' && !p.rutaId)
      .map((p) => ({
        raw: p,
        code: '#' + this.operations.short(p.id),
        zone: this.operations.zoneName(p.zonaId),
        zoneLabel: this.operations.zoneName(p.zonaId),
        badgeClass: 'bg-primary/10 text-primary',
        window: p.horaEntrega.slice(0, 5),
        isUrgent: false,
        client: p.clienteNombre,
        address: p.direccion,
        details: 'Entrega ' + p.fechaEntrega,
        tag: 'Pendiente',
      })),
  );
  readonly batchCount = computed(() => this.pendingOrders().length);
  readonly filteredPendingOrders = computed(() => {
    const q = this.pendingSearch().toLocaleLowerCase().trim(),
      zone = this.pendingFilter();
    return this.pendingOrders().filter(
      (p) =>
        (zone === 'Todas' || p.zone.toLocaleLowerCase().includes(zone.toLocaleLowerCase())) &&
        (!q ||
          [p.client, p.address, p.code, p.zoneLabel].join(' ').toLocaleLowerCase().includes(q)),
    );
  });
  readonly routeCards = computed<RouteCardItem[]>(() =>
    this.operations
      .rutas()
      .filter((r) => !this.operations.zona || r.zonaId === this.operations.zona)
      .map((r) => {
        const driver = this.operations.driver(r.repartidorId);
        return {
          raw: r,
          id: r.id,
          routeNumber: 'Ruta #' + this.operations.short(r.id),
          zone: this.operations.zoneName(r.zonaId),
          zoneBadgeClass: 'bg-tint-teal/15 text-on-surface-variant',
          driverName: driver,
          driverAvatar: initialsAvatar(driver),
          vehicle: 'No informado',
          vehicleIcon: 'local_shipping',
          statusText: this.operations.label(r.estado),
          statusBadgeClass:
            r.estado === 'Completada'
              ? 'bg-status-delivered/15 text-tertiary'
              : r.estado === 'Cancelada'
                ? 'bg-status-urgent/15 text-status-urgent'
                : 'bg-primary/15 text-primary',
          cupoText: 'Cupo: ' + r.paradas.length + '/' + r.capacidad + ' pedidos',
          cupoSubtext: Math.max(0, r.capacidad - r.paradas.length) + ' cupos libres',
          cupoSubtextClass: 'text-primary',
          progressPercent: r.capacidad ? Math.min(100, (r.paradas.length / r.capacidad) * 100) : 0,
          progressBarClass: 'bg-primary',
          stops: [...r.paradas]
            .sort((a, b) => a.orden - b.orden)
            .map((p) => ({
              num: p.orden,
              pedidoId: p.pedido.id,
              address: p.pedido.direccion,
              time: p.pedido.horaEntrega.slice(0, 5),
              status:
                p.pedido.estado === 'Entregado'
                  ? 'delivered'
                  : p.pedido.estado === 'EnCamino'
                    ? 'in_transit'
                    : 'pending',
            })),
          hasDropPlaceholder:
            (r.estado === 'Planificada' || r.estado === 'EnCurso') &&
            r.paradas.length < r.capacidad,
          distanceTime: 'Distancia y duración no informadas',
          actionButtonLabel: r.estado === 'Planificada' ? 'Iniciar ruta' : 'Ver detalle',
        };
      }),
  );
  readonly liveEvents = computed<SimulationEvent[]>(() => {
    const registration = this.operations.lastRegistration();
    if (!registration || !registration.asignacion) return [];
    const a = registration.asignacion;
    return [
      {
        id: '#' + this.operations.short(registration.pedido.id),
        type: a.tipo === 'EnEspera' ? 'evaluating' : a.tipo === 'RutaNueva' ? 'new_route' : 'auto',
        badge: a.tipo === 'EnEspera' ? 'En espera' : 'Asignación confirmada',
        badgeClass:
          a.tipo === 'EnEspera'
            ? 'bg-status-in-transit/15 text-on-surface-variant'
            : 'bg-status-delivered/15 text-tertiary',
        timeAgo: 'Último registro de esta sesión',
        borderClass: 'bg-primary',
        icon: 'alt_route',
        iconClass: 'text-primary',
        titleHtml:
          a.tipo === 'EnEspera' ? 'Registrado sin ruta disponible' : 'Asignado por el backend',
        subtitle: registration.pedido.clienteNombre + ' · ' + registration.pedido.direccion,
        actionText: a.tipo === 'EnEspera' ? 'Asignar a ruta' : undefined,
        capacityText: 'Resultado de asignación',
        capacityBadge: a.rutaId ? 'Ruta #' + this.operations.short(a.rutaId) : 'Sin asignar',
        capacityBadgeClass: 'bg-primary/15 text-primary',
      },
    ];
  });
  constructor() {
    this.operations.view.set('Rutas');
  }
  completedRoutes() {
    return this.operations.rutas().filter((r) => r.estado === 'Completada').length;
  }
  fleetPercent(state: string) {
    const drivers = this.operations.repartidores();
    return drivers.length
      ? (drivers.filter((d) => d.estado === state).length / drivers.length) * 100
      : 0;
  }
  openRoutes() {
    return this.operations
      .rutas()
      .filter(
        (r) =>
          (r.estado === 'Planificada' || r.estado === 'EnCurso') && r.paradas.length < r.capacidad,
      ).length;
  }
  pendingFor(name: string) {
    return this.pendingOrders().filter((p) =>
      p.zone.toLocaleLowerCase().includes(name.toLocaleLowerCase()),
    ).length;
  }
  async triggerOptimization() {
    const result = await this.operations.buildRoutes();
    if (result)
      this.showToast(
        result.rutas.length +
          ' rutas generadas; ' +
          result.pedidosSinAsignar +
          ' pedidos sin asignar.',
      );
  }
  registerSameDay() {
    this.operations.fecha = this.operations.today;
    void this.operations.changeDate();
    this.forms.open('Pedido');
  }
  validateInsertion(_event: SimulationEvent) {
    const p = this.operations.lastRegistration()?.pedido;
    if (p?.estado === 'Pendiente') void this.assignment.open(p);
  }
  rebalanceAll() {
    this.operations.error.set('Pendiente de backend: no existe operación de rebalanceo global.');
  }
  assignPendingToFreeSlot(order: PendingOrder | undefined, routeId = '') {
    if (order) void this.assignment.open(order.raw, routeId);
  }
  async actOnRoute(card: RouteCardItem) {
    if (card.raw.estado === 'Planificada') {
      await this.operations.action(this.operations.api.iniciarRuta(card.id), 'Ruta iniciada.');
    } else this.openRoute(card);
  }
  openRoute(card: RouteCardItem) {
    this.operations.selectRoute(card.raw);
    this.viewMode.set('mapa');
  }
  startDrag(event: DragEvent, order: PendingOrder) {
    event.dataTransfer?.setData('text/plain', order.raw.id);
  }
  dropOnRoute(event: DragEvent, card: RouteCardItem) {
    event.preventDefault();
    event.stopPropagation();
    const id=event.dataTransfer?.getData('text/plain');
    const pedido=this.operations.pedidos().find(p=>p.id===id) || this.operations.rutas().flatMap(r=>r.paradas).find(s=>s.pedido.id===id)?.pedido;
    if(pedido && pedido.rutaId!==card.id)void this.assignment.open(pedido,card.id);
  }
  startStopDrag(event: DragEvent,card: RouteCardItem,stop: RouteStop) {
    const p=card.raw.paradas.find(s=>s.pedido.id===stop.pedidoId)?.pedido;
    if(p?.estado==='AsignadoARuta')event.dataTransfer?.setData('text/plain',p.id);
    else event.preventDefault();
  }
  showToast(message: string) {
    clearTimeout(this.timer);
    this.toastMessage.set(message);
    this.timer = setTimeout(() => this.toastMessage.set(null), 4000);
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }
}

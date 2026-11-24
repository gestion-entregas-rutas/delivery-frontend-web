import { Component, ViewChild, computed, effect, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { RouteAssignmentService } from '../../core/services/route-assignment.service';
import { PedidoDto, RutaDto, ResultadoPuntualidadDto } from '../../core/models/logistica.models';
import { PlanningMap, COLORES_PLAN } from '../../shared/components/planning-map/planning-map';
import { RouteOrderService } from '../../core/services/route-order.service';
import { RouteDetailModal } from '../../shared/components/route-detail-modal/route-detail-modal';
import {
  ESTADO_RUTA,
  TONO_FONDO,
  TONO_TEXTO,
  duracionEstimadaMin,
  formatDuracion,
  formatHoraEcuador,
  iniciales,
  puntualidadCorta,
  ventana,
} from '../../core/utils/route-presentation';

export { formatHoraEcuador } from '../../core/utils/route-presentation';

/** Texto y clase completos de puntualidad (se conserva para otras vistas y pruebas). */
export function puntualidadInfo(punt?: ResultadoPuntualidadDto | null): { texto: string; clase: string } {
  if (!punt || !punt.estado) return { texto: 'Sin estimación', clase: 'bg-[#F2F2F7] text-[#8E8E93]' };
  const n = punt.retrasoMinutos ?? 0;
  switch (punt.estado) {
    case 'SinCompromiso':
      return { texto: 'Sin intervalo comprometido', clase: 'bg-[#F2F2F7] text-[#8E8E93]' };
    case 'SinEstimacion':
      return { texto: 'Sin estimación', clase: 'bg-[#F2F2F7] text-[#8E8E93]' };
    case 'DentroDelPlazoPrevisto':
      return { texto: 'A tiempo (estimado)', clase: 'bg-[#E8F8EE] text-[#34C759]' };
    case 'RetrasoPrevisto':
      return { texto: `Retraso previsto: +${n} min`, clase: 'bg-[#FFF9F2] text-[#FF9500]' };
    case 'PlazoVencido':
      return { texto: `Plazo vencido hace ${n} min`, clase: 'bg-[#FFF2F2] text-[#FF3B30]' };
    case 'EntregadoEnIntervalo':
      return { texto: 'Entregado a tiempo', clase: 'bg-[#E8F8EE] text-[#34C759]' };
    case 'EntregadoConRetraso':
      return { texto: `Entregado con ${n} min de retraso`, clase: 'bg-[#FFF2F2] text-[#FF3B30]' };
    case 'EntregadoAntesDelIntervalo':
      return { texto: 'Entregado antes del intervalo', clase: 'bg-[#E8F1FF] text-[#007AFF]' };
    case 'NoAplica':
      return { texto: 'No aplica (cancelado)', clase: 'bg-[#F2F2F7] text-[#8E8E93]' };
    default:
      return { texto: punt.estado, clase: 'bg-[#F2F2F7] text-[#8E8E93]' };
  }
}

export interface PendingOrder {
  raw: PedidoDto;
  code: string;
  zone: string;
  window: string;
  client: string;
  address: string;
}

export interface RouteStop {
  pedidoId: string;
  num: number;
  title: string;
  client: string;
  schedule: string;
  status: 'delivered' | 'in_transit' | 'pending';
  puntualidadTexto: string;
  puntualidadClase: string;
}

export interface RouteCardItem {
  raw: RutaDto;
  id: string;
  shortId: string;
  zone: string;
  driverName: string;
  initials: string;
  statusText: string;
  statusClass: string;
  used: number;
  capacity: number;
  free: number;
  progressPercent: number;
  stops: RouteStop[];
  editable: boolean;
  alertasCount: number;
  estimadoHora: string | null;
  estimadoFinal: string | null;
}

export interface GlobalAlertItem {
  rutaId: string;
  pedidoId: string;
  orden: number;
  estado: 'RetrasoPrevisto' | 'PlazoVencido';
  retrasoMinutos: number | null;
  rutaNumero: string;
  clienteNombre: string;
}

const AVATARES = ['bg-primary text-on-primary', 'bg-surface-container-high text-on-surface', 'bg-status-in-transit/15 text-status-in-transit'];

@Component({
  selector: 'app-rutas-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PlanningMap, RouteDetailModal],
  templateUrl: './rutas.page.html',
  styleUrl: './rutas.page.css',
})
export class RutasPage implements OnDestroy {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);
  readonly assignment = inject(RouteAssignmentService);
  readonly order = inject(RouteOrderService);
  readonly pendingSearch = signal('');
  /** Mapa a pantalla completa (por defecto) o lista de tarjetas. */
  readonly viewMode = signal<'mosaico' | 'mapa'>('mapa');
  @ViewChild(PlanningMap) private mapa?: PlanningMap;
  readonly colores = COLORES_PLAN;
  /** Ruta resaltada en el mapa y mostrada en el panel lateral. */
  readonly rutaSel = signal<string | null>(this.operations.selected()?.id ?? null);
  readonly paradaSel = signal<string | null>(null);
  readonly panelAbierto = signal(true);
  readonly panelTab = signal<'ruta' | 'rutas' | 'pendientes'>('ruta');
  /** Búsqueda de la cabecera: filtra rutas por repartidor o zona. */
  readonly busqueda = signal('');
  readonly optimizing = this.operations.saving;
  readonly toastMessage = signal<string | null>(null);
  /** Ruta abierta en el modal de detalle (se lee en vivo desde operations.rutas). */
  readonly detailId = signal<string | null>(null);
  readonly detailRoute = computed(() => this.operations.rutas().find((r) => r.id === this.detailId()) ?? null);
  readonly avatarClases = AVATARES;
  private timer?: ReturnType<typeof setTimeout>;

  readonly pendingOrders = computed<PendingOrder[]>(() =>
    this.operations
      .pedidos()
      .filter((p) => p.estado === 'Pendiente' && !p.rutaId)
      .map((p) => ({
        raw: p,
        code: '#' + this.operations.short(p.id),
        zone: this.operations.zoneName(p.zonaId),
        window: ventana(p.compromisoInicioEn, p.compromisoFinEn) ?? 'Flexible · ' + p.horaEntrega.slice(0, 5),
        client: p.clienteNombre,
        address: p.direccion,
      })),
  );
  readonly batchCount = computed(() => this.pendingOrders().length);
  readonly filteredPendingOrders = computed(() => {
    const q = this.pendingSearch().toLocaleLowerCase().trim();
    return this.pendingOrders().filter(
      (p) => !q || [p.client, p.address, p.code, p.zone].join(' ').toLocaleLowerCase().includes(q),
    );
  });

  readonly routeCards = computed<RouteCardItem[]>(() =>
    this.operations
      .rutas()
      // Las rutas canceladas no son operativas: se ocultan de Rutas Activas.
      .filter((r) => r.estado !== 'Cancelada' && (!this.operations.zona || r.zonaId === this.operations.zona))
      .map((r) => {
        const driver = this.operations.driver(r.repartidorId);
        const estado = ESTADO_RUTA[r.estado] ?? { texto: r.estado, clase: 'bg-surface-container-high text-on-surface-variant' };
        return {
          raw: r,
          id: r.id,
          shortId: '#' + this.operations.short(r.id),
          zone: this.operations.zoneName(r.zonaId),
          driverName: driver,
          initials: iniciales(driver),
          statusText: estado.texto,
          statusClass: estado.clase,
          used: r.paradas.length,
          capacity: r.capacidad,
          free: Math.max(0, r.capacidad - r.paradas.length),
          progressPercent: r.capacidad ? Math.min(100, (r.paradas.length / r.capacidad) * 100) : 0,
          stops: [...r.paradas]
            .sort((a, b) => a.orden - b.orden)
            .map((p) => {
              const punt = puntualidadCorta(p.pedido.puntualidad);
              const v = ventana(p.pedido.compromisoInicioEn, p.pedido.compromisoFinEn);
              const fin = formatHoraEcuador(p.finalizacionEstimadaEn);
              return {
                num: p.orden,
                pedidoId: p.pedido.id,
                title: p.pedido.direccion,
                client: p.pedido.clienteNombre,
                schedule: v ? v + (fin ? ' · fin est. ' + fin : '') : fin ? 'Horario estimado: ' + fin : 'Hora ' + p.pedido.horaEntrega.slice(0, 5),
                puntualidadTexto: punt.texto,
                puntualidadClase: TONO_TEXTO[punt.tono],
                status: p.pedido.estado === 'Entregado' ? 'delivered' : p.pedido.estado === 'EnCamino' ? 'in_transit' : 'pending',
              } satisfies RouteStop;
            }),
          editable: r.estado === 'Planificada' || r.estado === 'EnCurso',
          alertasCount: r.alertas?.length ?? 0,
          estimadoHora: r.estimacionesActualizadasEn ? formatHoraEcuador(r.estimacionesActualizadasEn) : null,
          estimadoFinal: this.finalEstimado(r),
        };
      }),
  );

  /** Indicadores del día calculados solo con datos reales de las rutas visibles. */
  readonly metrics = computed(() => {
    const rutas = this.routeCards().map((c) => c.raw);
    const paradas = rutas.flatMap((r) => r.paradas);
    const km = rutas.reduce((a, r) => a + (r.distanciaEstimadaKm ?? 0), 0);
    const conKm = rutas.some((r) => r.distanciaEstimadaKm != null);
    const traslados = paradas.map((p) => p.trasladoEstimadoMinutos).filter((m): m is number => m != null);
    const capacidad = rutas.reduce((a, r) => a + r.capacidad, 0);
    const comprometidas = paradas.filter((p) => p.pedido.compromisoFinEn);
    const enPlazo = comprometidas.filter(
      (p) => !['RetrasoPrevisto', 'PlazoVencido', 'EntregadoConRetraso'].includes(p.pedido.puntualidad?.estado ?? ''),
    ).length;
    return {
      enPlazo: comprometidas.length ? Math.round((enPlazo / comprometidas.length) * 100) : null,
      enPlazoDetalle: comprometidas.length ? `${enPlazo}/${comprometidas.length}` : 'sin compromisos',
      km: conKm ? km.toFixed(1) : null,
      trasladoPromedio: traslados.length ? Math.round(traslados.reduce((a, m) => a + m, 0) / traslados.length) : null,
      capacidadPct: capacidad ? Math.round((paradas.length / capacidad) * 100) : null,
      capacidadDetalle: `${paradas.length}/${capacidad}`,
    };
  });

  /** Rutas mostradas en la vista Mapa (mismo filtro que el mosaico). */
  readonly mapRoutes = computed(() => this.routeCardsFiltradas().map((c) => c.raw));

  /** Tarjetas filtradas por la búsqueda de la cabecera (repartidor, zona o código). */
  readonly routeCardsFiltradas = computed(() => {
    const q = this.busqueda().toLocaleLowerCase().trim();
    return this.routeCards().filter((c) => !q || [c.driverName, c.zone, c.shortId].join(' ').toLocaleLowerCase().includes(q));
  });
  /** Color de cada ruta (mismo índice que en el mapa). */
  colorRuta(id: string) {
    const i = this.mapRoutes().findIndex((r) => r.id === id);
    return this.colores[(i < 0 ? 0 : i) % this.colores.length];
  }
  /** Ruta activa del panel: la elegida o, si no hay, la primera en curso / primera de la lista. */
  readonly rutaActiva = computed(() => {
    const cards = this.routeCardsFiltradas();
    return (
      cards.find((c) => c.id === this.rutaSel()) ??
      cards.find((c) => c.raw.estado === 'EnCurso') ??
      cards[0] ??
      null
    );
  });
  /** Datos extra del panel de la ruta activa. */
  readonly detalleActiva = computed(() => {
    const card = this.rutaActiva();
    if (!card) return null;
    const r = card.raw;
    const rep = this.operations.repartidores().find((d) => d.id === r.repartidorId);
    const min = duracionEstimadaMin(r);
    return {
      telefono: rep?.telefono || '',
      distancia: r.distanciaEstimadaKm != null ? r.distanciaEstimadaKm.toFixed(1) + ' km' : '—',
      tiempo: min != null ? formatDuracion(min) : '—',
      capacidadPct: card.capacity ? Math.round((card.used / card.capacity) * 100) : 0,
      enCurso: r.paradas.filter((p) => p.pedido.estado !== 'Entregado').length,
      paradas: [...r.paradas]
        .sort((a, b) => a.orden - b.orden)
        .map((p) => {
          const v = ventana(p.pedido.compromisoInicioEn, p.pedido.compromisoFinEn);
          const punt = puntualidadCorta(p.pedido.puntualidad);
          const fin = formatHoraEcuador(p.finalizacionEstimadaEn);
          const estado = p.pedido.estado;
          return {
            pedido: p.pedido,
            orden: p.orden,
            direccion: p.pedido.direccion,
            cliente: p.pedido.clienteNombre,
            hora: fin || p.pedido.horaEntrega.slice(0, 5),
            ventana: v,
            chip:
              estado === 'Entregado'
                ? { texto: 'Entregado', clase: 'bg-status-delivered/10 text-status-delivered' }
                : estado === 'EnCamino'
                  ? { texto: 'En camino', clase: 'bg-status-in-transit/10 text-status-in-transit' }
                  : v
                    ? { texto: 'Intervalo', clase: 'bg-primary/10 text-primary' }
                    : { texto: 'Flexible', clase: 'text-on-surface-variant' },
            punt: punt.texto,
            puntClase: TONO_FONDO[punt.tono],
            alerta: punt.tono === 'aviso' || punt.tono === 'error',
          };
        }),
    };
  });
  /** Indicadores compactos de la cabecera. */
  readonly kpis = computed(() => ({
    rutas: this.routeCards().length,
    repartidores: this.operations.repartidores().length,
    pedidos: this.operations.pedidos().filter((p) => p.estado !== 'Cancelado').length,
    pendientes: this.pendingOrders().length,
    enPlazo: this.metrics().enPlazo,
  }));
  readonly zonasActivas = computed(() => this.operations.zonas().filter((z) => z.activa));

  readonly globalAlerts = computed<GlobalAlertItem[]>(() => {
    const list: GlobalAlertItem[] = [];
    for (const r of this.operations.rutas()) {
      for (const a of r.alertas ?? []) {
        const stop = r.paradas.find((s) => s.pedido.id === a.pedidoId);
        list.push({
          rutaId: r.id,
          pedidoId: a.pedidoId,
          orden: a.orden,
          estado: a.estado,
          retrasoMinutos: a.retrasoMinutos,
          rutaNumero: 'Ruta #' + this.operations.short(r.id),
          clienteNombre: stop?.pedido.clienteNombre || 'Pedido #' + this.operations.short(a.pedidoId),
        });
      }
    }
    return list.sort((a, b) =>
      a.estado !== b.estado ? (a.estado === 'PlazoVencido' ? -1 : 1) : (b.retrasoMinutos ?? 0) - (a.retrasoMinutos ?? 0),
    );
  });

  constructor() {
    this.operations.view.set('Rutas');
    // Si la ruta elegida desaparece (cancelada / otra fecha), se limpia la selección.
    effect(() => {
      const id = this.rutaSel();
      if (id && !this.routeCards().some((c) => c.id === id)) this.rutaSel.set(null);
    });
  }

  // ---- Mapa y panel lateral ----
  elegirRuta(id: string) {
    this.rutaSel.set(id);
    this.paradaSel.set(null);
    this.panelTab.set('ruta');
    this.panelAbierto.set(true);
  }
  elegirParada(e: { rutaId: string; pedidoId: string }) {
    if (e.rutaId !== this.rutaActiva()?.id) this.rutaSel.set(e.rutaId);
    this.paradaSel.set(e.pedidoId);
    this.panelTab.set('ruta');
    this.panelAbierto.set(true);
    setTimeout(() => document.getElementById('parada-' + e.pedidoId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  enfocarParada(pedidoId: string) {
    this.paradaSel.set(null);
    setTimeout(() => this.paradaSel.set(pedidoId));
  }
  elegirZona(id: string) {
    if (this.operations.zona === id) return;
    this.operations.zona = id;
    this.operations.selected.set(null);
    this.rutaSel.set(null);
    void this.operations.refresh(true);
  }
  abrirPanel(tab: 'ruta' | 'rutas' | 'pendientes') {
    this.panelTab.set(tab);
    this.panelAbierto.set(true);
  }
  acercar() { this.mapa?.acercar(); }
  alejar() { this.mapa?.alejar(); }
  centrar() { this.mapa?.centrar(); }
  cambiarFecha() {
    this.rutaSel.set(null);
    void this.operations.changeDate();
  }

  private finalEstimado(r: RutaDto): string | null {
    const fines = r.paradas.map((p) => p.finalizacionEstimadaEn).filter((x): x is string => !!x);
    return fines.length ? formatHoraEcuador(new Date(Math.max(...fines.map((f) => new Date(f).getTime()))).toISOString()) : null;
  }

  async triggerOptimization() {
    // El resultado se muestra en el toast global (operations.message).
    await this.operations.buildRoutes();
  }
  /** Abre el formulario real de alta en Pedidos (fecha de hoy) y vuelve el resultado al panel. */
  registerSameDay() {
    this.operations.fecha = this.operations.today;
    this.operations.abrirNuevoPedido.set(true);
    this.operations.navigate('Pedidos');
  }
  assignPending(order: PendingOrder, routeId = '') {
    void this.assignment.open(order.raw, routeId);
  }
  openDetail(card: RouteCardItem) {
    this.detailId.set(card.id);
  }
  /** Muestra la ruta resaltada en la vista Mapa, donde se transfieren sus paradas. */
  openInMap(route: RutaDto) {
    this.detailId.set(null);
    this.operations.selectRoute(route);
    this.viewMode.set('mapa');
    this.elegirRuta(route.id);
  }
  openDetailRoute(route: RutaDto) {
    this.detailId.set(route.id);
  }
  transferStop(pedido: PedidoDto) {
    void this.assignment.open(pedido);
  }
  startDrag(event: DragEvent, order: PendingOrder) {
    event.dataTransfer?.setData('text/plain', order.raw.id);
  }
  dropOnRoute(event: DragEvent, card: RouteCardItem) {
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer?.getData('text/plain');
    const pedido =
      this.operations.pedidos().find((p) => p.id === id) ||
      this.operations.rutas().flatMap((r) => r.paradas).find((s) => s.pedido.id === id)?.pedido;
    if (pedido && pedido.rutaId !== card.id) void this.assignment.open(pedido, card.id);
  }
  startStopDrag(event: DragEvent, card: RouteCardItem, stop: RouteStop) {
    const p = card.raw.paradas.find((s) => s.pedido.id === stop.pedidoId)?.pedido;
    if (p?.estado === 'AsignadoARuta') event.dataTransfer?.setData('text/plain', p.id);
    else event.preventDefault();
  }
  focusAlert(alert: GlobalAlertItem) {
    this.detailId.set(alert.rutaId);
  }
  async recalcular(rutaId: string) {
    await this.operations.recalcularEstimaciones(rutaId);
  }
  showToast(message: string) {
    clearTimeout(this.timer);
    this.toastMessage.set(message);
    this.timer = setTimeout(() => this.toastMessage.set(null), 3000);
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }
}

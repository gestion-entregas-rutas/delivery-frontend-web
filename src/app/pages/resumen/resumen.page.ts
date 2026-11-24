import { formatHoraEcuador, ventana } from '../../core/utils/route-presentation';
import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { RouteAssignmentService } from '../../core/services/route-assignment.service';
import { RutaDto, PedidoDto } from '../../core/models/logistica.models';
import { initialsAvatar } from '../../core/utils/presentation';
import { OperationsMap } from '../../shared/components/operations-map/operations-map';
export interface RouteManifestItemUI {
  id: string;
  rutaCodigo: string;
  zonaNombre: string;
  zonaColor: string;
  operadorNombre: string;
  vehiculo: string;
  avatarUrl: string;
  capacidadOcupada: number;
  capacidadTotal: number;
  capacidadPct: string;
  paradas: {
    numero: number;
    estado: 'ok' | 'curso' | 'prog' | 'vacio' | 'trafico';
    label: string;
  }[];
  eta: string;
  estadoSla: 'tiempo' | 'riesgo' | 'desconocido';
  estado: string;
  alertas: number;
}

/** Estados de pedido en el panel de zona (mismos colores que el mapa). */
const ZONE_ESTADO: Record<string, { texto: string; clase: string }> = {
  Pendiente: { texto: 'Sin ruta', clase: 'bg-status-urgent/10 text-status-urgent' },
  AsignadoARuta: { texto: 'Asignado', clase: 'bg-surface-container text-primary' },
  EnCamino: { texto: 'En camino', clase: 'bg-status-in-transit/10 text-status-in-transit' },
  Entregado: { texto: 'Entregado', clase: 'bg-status-delivered/10 text-status-delivered' },
};

export interface ZoneOrderUI {
  raw: PedidoDto;
  id: string;
  codigo: string;
  parada: number | null;
  repartidor: string | null;
  rutaCodigo: string | null;
  horario: string;
  estimada: string | null;
  entregadoEn: string | null;
  estado: string;
  estadoTexto: string;
  estadoClase: string;
  sortKey: number;
}

export interface LastMinuteAlertUI {
  raw: PedidoDto;
  id: string;
  codigo: string;
  tiempo: string;
  direccion: string;
  zona: string;
  estado: 'smart-assigned' | 'saturated' | 'auto-batch' | 'vip';
  mensaje: string;
  submensaje?: string;
  etaOInfo: string;
  vipTag?: string;
  descartada?: boolean;
}

@Component({
  selector: 'app-resumen-page',
  standalone: true,
  imports: [CommonModule, FormsModule, OperationsMap],
  templateUrl: './resumen.page.html',
  styleUrl: './resumen.page.css',
})
export class ResumenPage implements OnDestroy {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);
  readonly assignment = inject(RouteAssignmentService);
  readonly selectedZoneChip = signal('todos');
  readonly routeFilterQuery = signal('');
  readonly zoneSearchQuery = signal('');
  readonly zoneDropdownOpen = signal(false);

  readonly filteredZones = computed(() => {
    const q = this.zoneSearchQuery().toLocaleLowerCase().trim();
    const zonas = this.operations.zonas();
    if (!q) return zonas;
    return zonas.filter((z) => z.nombre.toLocaleLowerCase().includes(q));
  });

  onZoneSearchInput(query: string) {
    this.zoneSearchQuery.set(query);
    this.zoneDropdownOpen.set(true);
  }

  selectZoneFromSearch(id: string) {
    this.setZoneChip(id);
    this.zoneSearchQuery.set('');
    this.zoneDropdownOpen.set(false);
  }
  readonly toastVisible = signal(false);
  readonly toastTitle = signal('');
  readonly toastMessage = signal('');
  private dismissed = signal<string[]>([]);
  private timer?: ReturnType<typeof setTimeout>;
  readonly alerts = computed<LastMinuteAlertUI[]>(() =>
    this.operations
      .pedidos()
      .filter(
        (p) =>
          p.fechaEntrega === this.operations.today &&
          p.estado !== 'Cancelado' &&
          p.estado !== 'Entregado',
      )
      .map((p) => ({
        raw: p,
        id: p.id,
        codigo: '#' + this.operations.short(p.id),
        tiempo: new Date(p.registradoEn).toLocaleTimeString('es-EC'),
        direccion: p.direccion,
        zona: this.operations.zoneName(p.zonaId),
        estado: p.rutaId ? 'smart-assigned' : 'saturated',
        mensaje: p.rutaId
          ? 'Asignado a ruta #' + this.operations.short(p.rutaId)
          : 'Pendiente de asignación; no se ha confirmado una causa',
        etaOInfo: 'ETA no informada',
      })),
  );
  readonly activeAlerts = computed(() =>
    this.alerts().filter(
      (a) =>
        !this.dismissed().includes(a.id) &&
        (this.selectedZoneChip() === 'todos' || a.raw.zonaId === this.selectedZoneChip()),
    ),
  );
  readonly manifestRoutes = computed<RouteManifestItemUI[]>(() =>
    this.operations.rutas().map((r) => {
      const paradas: RouteManifestItemUI['paradas'] = [...r.paradas]
        .sort((a, b) => a.orden - b.orden)
        .map((s) => ({
          numero: s.orden,
          estado:
            s.pedido.estado === 'Entregado'
              ? 'ok'
              : s.pedido.estado === 'EnCamino'
                ? 'curso'
                : 'prog',
          label: s.orden + '. ' + this.operations.label(s.pedido.estado),
        }));
      while (paradas.length < 4)
        paradas.push({
          numero: paradas.length + 1,
          estado: 'vacio',
          label: paradas.length >= r.capacidad ? 'No aplica' : 'Sin parada',
        });
      return {
        id: r.id,
        rutaCodigo: 'Ruta #' + this.operations.short(r.id),
        zonaNombre: this.operations.zoneName(r.zonaId),
        zonaColor: 'text-primary',
        operadorNombre: this.operations.driver(r.repartidorId),
        vehiculo: 'Vehículo no informado',
        avatarUrl: initialsAvatar(this.operations.driver(r.repartidorId)),
        capacidadOcupada: r.paradas.length,
        capacidadTotal: r.capacidad,
        capacidadPct: (r.capacidad ? Math.round((r.paradas.length / r.capacidad) * 100) : 0) + '%',
        paradas,
        eta: this.finEstimado(r) ?? 'Sin estimación',
        estadoSla: r.alertas?.length ? 'riesgo' : this.finEstimado(r) ? 'tiempo' : 'desconocido',
        estado: r.estado,
        alertas: r.alertas?.length ?? 0,
      };
    }),
  );
  readonly filteredRoutes = computed(() => {
    const q = this.routeFilterQuery().toLocaleLowerCase().trim();
    const zone = this.selectedZoneChip();
    return this.manifestRoutes().filter(
      (r) =>
        (zone === 'todos' || this.operations.rutas().find((x) => x.id === r.id)?.zonaId === zone) &&
        (!q ||
          [r.rutaCodigo, r.operadorNombre, r.zonaNombre].join(' ').toLocaleLowerCase().includes(q)),
    );
  });
  /** Pedido resaltado en el mapa y en la lista de la zona. */
  readonly focusPedido = signal('');
  /** Filtro del panel de zona. */
  readonly zoneTab = signal<'pendientes' | 'entregados' | 'todos'>('pendientes');

  /** Pedidos de la fecha consultada en la zona elegida, con su parada y repartidor. */
  readonly zoneOrders = computed<ZoneOrderUI[]>(() => {
    const zone = this.selectedZoneChip();
    if (zone === 'todos') return [];
    const fecha = this.operations.fecha;
    const pedidos = new Map(this.operations.pedidos().map((p) => [p.id, p]));
    for (const r of this.operations.rutas())
      for (const s of r.paradas ?? []) if (s?.pedido && !pedidos.has(s.pedido.id)) pedidos.set(s.pedido.id, s.pedido);
    const orden: Record<string, number> = { EnCamino: 0, AsignadoARuta: 1, Pendiente: 2, Entregado: 3 };
    return [...pedidos.values()]
      .filter((p) => p.zonaId === zone && p.fechaEntrega === fecha && p.estado !== 'Cancelado')
      .map((p) => {
        const ruta = p.rutaId ? this.operations.rutas().find((r) => r.id === p.rutaId) : undefined;
        const parada = ruta?.paradas.find((s) => s.pedido?.id === p.id);
        const inicio = p.compromisoInicioEn ?? null;
        return {
          raw: p,
          id: p.id,
          codigo: '#' + this.operations.short(p.id),
          parada: parada?.orden ?? null,
          repartidor: ruta ? this.operations.driver(ruta.repartidorId) : null,
          rutaCodigo: p.rutaId ? 'Ruta #' + this.operations.short(p.rutaId) : null,
          horario: ventana(p.compromisoInicioEn, p.compromisoFinEn) ?? (p.horaEntrega || '').slice(0, 5),
          estimada: parada?.finalizacionEstimadaEn ? formatHoraEcuador(parada.finalizacionEstimadaEn) : null,
          entregadoEn: p.entregadoEn ? formatHoraEcuador(p.entregadoEn) : null,
          estado: p.estado,
          estadoTexto: ZONE_ESTADO[p.estado]?.texto ?? this.operations.label(p.estado),
          estadoClase: ZONE_ESTADO[p.estado]?.clase ?? 'bg-surface-container-high text-on-surface-variant',
          sortKey: (orden[p.estado] ?? 9) * 1e13 + (inicio ? new Date(inicio).getTime() : 0) + (parada?.orden ?? 0),
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  });
  readonly zoneStats = computed(() => {
    const list = this.zoneOrders();
    return {
      total: list.length,
      porEntregar: list.filter((o) => o.estado !== 'Entregado').length,
      sinRuta: list.filter((o) => o.estado === 'Pendiente').length,
      enCamino: list.filter((o) => o.estado === 'EnCamino').length,
      entregados: list.filter((o) => o.estado === 'Entregado').length,
    };
  });
  readonly zoneOrdersVisible = computed(() => {
    const tab = this.zoneTab();
    return this.zoneOrders().filter((o) =>
      tab === 'todos' ? true : tab === 'entregados' ? o.estado === 'Entregado' : o.estado !== 'Entregado',
    );
  });

  constructor() {
    this.operations.view.set('Resumen');
  }
  /** Clic en una zona del mapa: filtra toda la página por esa zona. */
  onMapZone(id: string) {
    if (id === this.selectedZoneChip()) return;
    this.setZoneChip(id);
  }
  /** Clic en un punto del mapa: resalta el pedido en la lista. */
  onMapPedido(id: string) {
    this.focusPedido.set(id);
    if (!this.zoneOrdersVisible().some((x) => x.id === id)) this.zoneTab.set('todos');
    setTimeout(() => document.getElementById('zona-pedido-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  /** Clic en un pedido de la lista: centra el mapa en él. */
  focusOrder(id: string) {
    this.focusPedido.set('');
    setTimeout(() => this.focusPedido.set(id));
  }
  assignOrder(o: ZoneOrderUI) {
    void this.assignment.open(o.raw);
  }
  clearZone() {
    this.focusPedido.set('');
    this.setZoneChip('todos');
  }
  /** Hora estimada de la última entrega de la ruta (dato del backend, zona horaria del negocio). */
  private finEstimado(r: RutaDto): string | null {
    const fines = r.paradas.map((p) => p.finalizacionEstimadaEn).filter((x): x is string => !!x);
    return fines.length ? formatHoraEcuador(new Date(Math.max(...fines.map((f) => new Date(f).getTime()))).toISOString()) : null;
  }
  readonly enCurso = computed(() => this.operations.rutas().filter((r) => r.estado === 'EnCurso').length);
  readonly sinAsignarHoy = computed(() => this.alerts().filter((a) => !a.raw.rutaId).length);
  setZoneChip(id: string) {
    this.selectedZoneChip.set(id);
    this.operations.zona=id==='todos'?'':id;
    void this.operations.refresh(true);
  }
  activeFleet() {
    return this.operations.repartidores().filter((d) => d.estado !== 'NoDisponible').length;
  }
  currentZone() {
    const id = this.selectedZoneChip();
    return id === 'todos' ? null : this.operations.zonas().find((z) => z.id === id);
  }
  currentZoneName() {
    return this.currentZone()?.nombre ?? '';
  }
  currentZoneOrders() {
    return this.zoneOrderCount(this.selectedZoneChip());
  }
  currentZoneCapacity() {
    return this.currentZone()?.maxPedidosPorRuta ?? 4;
  }
  zoneOrderCount(id: string | undefined) {
    return this.operations.resumen()?.porZona?.find(p=>p.zonaId===id)?.cantidad ?? 0;
  }
  createExpressRoute(alert: LastMinuteAlertUI) {
    void this.assignment.open(alert.raw);
  }
  dismissAlert(id: string) {
    this.dismissed.update((v) => [...v, id]);
  }
  reassignStop(route: RouteManifestItemUI) {
    this.operations.showOrderRoute(route.id);
  }
  viewRoute(route: RouteManifestItemUI) {
    this.operations.showOrderRoute(route.id);
  }
  exportCsv() {
    const quote = (value: unknown) => {
      let text = String(value ?? '');
      if (/^[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [
      ['Ruta', 'Zona', 'Repartidor', 'Paradas', 'Capacidad'],
      ...this.filteredRoutes().map((r) => [
        r.rutaCodigo,
        r.zonaNombre,
        r.operadorNombre,
        r.capacidadOcupada,
        r.capacidadTotal,
      ]),
    ];
    const blob = new Blob(['\ufeff' + rows.map((row) => row.map(quote).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = 'manifiesto-' + this.operations.fecha + '.csv';
    link.click();
    URL.revokeObjectURL(url);
    this.operations.message.set('Manifiesto CSV generado con las rutas consultadas.');
  }
  showToast(title: string, message: string) {
    clearTimeout(this.timer);
    this.toastTitle.set(title);
    this.toastMessage.set(message);
    this.toastVisible.set(true);
    this.timer = setTimeout(() => this.toastVisible.set(false), 3500);
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }
}

import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { RouteAssignmentService } from '../../core/services/route-assignment.service';
import { PedidoDto } from '../../core/models/logistica.models';
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
        eta: 'No informada',
        estadoSla: 'desconocido',
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
  constructor() {
    this.operations.view.set('Resumen');
  }
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
    return this.operations.resumen()?.porZona.find(p=>p.zonaId===id)?.cantidad ?? 0;
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
    this.showToast('Manifiesto generado', 'CSV generado con las rutas consultadas.');
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

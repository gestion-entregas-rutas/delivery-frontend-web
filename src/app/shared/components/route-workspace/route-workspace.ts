import { Component, inject, signal, afterNextRender, effect, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../../core/services/operations.service';
import type * as Leaflet from 'leaflet';
import { cargarLeaflet } from '../../../core/utils/leaflet-loader';
import { mapPalette } from '../../../core/utils/map-palette';
import { drawGpsMarkers } from '../../../core/utils/gps-markers';
import { RouteOrderService } from '../../../core/services/route-order.service';
import { RouteAssignmentService } from '../../../core/services/route-assignment.service';
@Component({
  selector: 'app-route-workspace',
  imports: [FormsModule],
  templateUrl: './route-workspace.html',
  host: { class: 'legacy-ui block' },
})
export class RouteWorkspace implements OnDestroy {
  readonly operations = inject(OperationsService);
  readonly order = inject(RouteOrderService);
  readonly assignment = inject(RouteAssignmentService);
  readonly mapError = signal('');
  private readonly ready = signal(false);
  private map?: Leaflet.Map;
  private L?: typeof Leaflet;
  private layers?: Leaflet.LayerGroup;
  private destroyed = false;
  private timer?: ReturnType<typeof setInterval>;
  constructor() {
    afterNextRender(() => void this.initMap().then(() => this.ready.set(true)));
    effect(() => {
      this.operations.zonas();
      this.operations.rutas();
      this.operations.pedidos();
      this.operations.selected();
      this.operations.ubicaciones();
      if (this.ready()) this.draw();
    });
  }
  visibleRoutes() {
    return this.operations
      .rutas()
      .filter((r) => !this.operations.zona || r.zonaId === this.operations.zona);
  }
  async initMap() {
    try {
      this.L = await cargarLeaflet();
      if (this.destroyed) return;
      this.map = this.L.map('delivery-map', { zoomControl: false }).setView([-2.175, -79.9], 13);
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
      this.L.control.zoom({ position: 'bottomright' }).addTo(this.map);
      this.layers = this.L.layerGroup().addTo(this.map);
      this.timer=setInterval(()=>this.draw(),30000);

      this.draw();
      setTimeout(() => {
        if (!this.destroyed && this.map) {
          this.map.invalidateSize();
          this.fitMap();
        }
      }, 100);
    } catch {
      this.mapError.set('No se pudo cargar el mapa. Puedes continuar con la gestión de datos.');
    }
  }
  draw() {
    if (!this.L || !this.layers || !this.map) return;
    const L = this.L;
    const palette = mapPalette();
    this.layers.clearLayers();
    this.operations
      .zonas()
      .filter((z) => z.activa && (!this.operations.zona || z.id === this.operations.zona))
      .forEach((z) =>
        L.polygon(
          z.poligono.map((p) => [p.latitud, p.longitud] as [number, number]),
          { color: palette.primary, weight: 1, fillOpacity: 0.05, dashArray: '5 6' },
        )
          .bindTooltip(() => {
            const label = document.createElement('span');
            label.textContent = z.nombre;
            return label;
          })
          .addTo(this.layers!),
      );
    const routes = this.operations.selected()
      ? [this.operations.selected()!]
      : this.visibleRoutes();
    routes
      .filter((r) => r.estado !== 'Cancelada')
      .forEach((r, i) => {
        const points = [...(r.paradas || [])]
          .filter((p) => p?.pedido?.ubicacion?.latitud != null && p?.pedido?.ubicacion?.longitud != null)
          .sort((a, b) => a.orden - b.orden)
          .map(
            (p) => [p.pedido.ubicacion.latitud, p.pedido.ubicacion.longitud] as [number, number],
          );
        if (points.length)
          L.polyline(points, {
            color: [palette.primary, palette.teal, palette.secondary][i % 3],
            weight: 4,
            opacity: 0.8,
            dashArray: '8 5',
          }).addTo(this.layers!);
      });
    this.operations
      .pedidos()
      .filter(
        (p) =>
          p &&
          p.estado !== 'Cancelado' &&
          (!this.operations.selected() || p.rutaId === this.operations.selected()?.id) &&
          p.ubicacion?.latitud != null &&
          p.ubicacion?.longitud != null,
      )
      .forEach((p, i) => {
        const el = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = p.clienteNombre;
        el.append(strong, document.createElement('br'), document.createTextNode(p.direccion));
        L.marker([p.ubicacion.latitud, p.ubicacion.longitud], {
          icon: L.divIcon({
            className: 'delivery-pin',
            html: `<span>${i + 1}</span>`,
            iconSize: [30, 30],
          }),
        })
          .bindPopup(el)
          .addTo(this.layers!);
      });
    drawGpsMarkers(L,this.layers,this.operations.ubicaciones(),this.operations.rutas(),id=>this.operations.driver(id),palette.teal,this.operations.zona,this.operations.selected()?.id || '');
    this.fitMap();
  }
  fitMap() {
    if (!this.map || !this.L || !this.layers) return;
    this.map.invalidateSize();
    const bounds = this.L.featureGroup(this.layers.getLayers()).getBounds();
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
  }

  ngOnDestroy() {
    this.destroyed = true;
    clearInterval(this.timer);
    this.map?.remove();
  }
}

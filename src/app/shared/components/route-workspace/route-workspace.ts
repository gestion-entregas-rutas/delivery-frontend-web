import { Component, inject, signal, afterNextRender, effect, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../../core/services/operations.service';
import type * as Leaflet from 'leaflet';
import { mapPalette } from '../../../core/utils/map-palette';
@Component({
  selector: 'app-route-workspace',
  imports: [FormsModule],
  templateUrl: './route-workspace.html',
})
export class RouteWorkspace implements OnDestroy {
  readonly operations = inject(OperationsService);
  readonly mapError = signal('');
  private readonly ready = signal(false);
  private map?: Leaflet.Map;
  private L?: typeof Leaflet;
  private layers?: Leaflet.LayerGroup;
  private destroyed = false;
  constructor() {
    afterNextRender(() => void this.initMap().then(() => this.ready.set(true)));
    effect(() => {
      this.operations.zonas();
      this.operations.rutas();
      this.operations.pedidos();
      this.operations.selected();
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
      this.L = await import('leaflet');
      if (this.destroyed) return;
      this.map = this.L.map('delivery-map', { zoomControl: false }).setView([-2.175, -79.9], 13);
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
      this.L.control.zoom({ position: 'bottomright' }).addTo(this.map);
      this.layers = this.L.layerGroup().addTo(this.map);

      this.draw();
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
        const points = [...r.paradas]
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
          p.estado !== 'Cancelado' &&
          (!this.operations.selected() || p.rutaId === this.operations.selected()?.id),
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
    this.fitMap();
  }
  fitMap() {
    if (!this.map || !this.L || !this.layers) return;
    const bounds = this.L.featureGroup(this.layers.getLayers()).getBounds();
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.map?.remove();
  }
}

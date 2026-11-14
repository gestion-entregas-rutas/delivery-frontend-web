import {
  Component,
  Input,
  ElementRef,
  inject,
  afterNextRender,
  effect,
  OnDestroy,
  signal,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { OperationsService } from '../../../core/services/operations.service';
import { mapPalette } from '../../../core/utils/map-palette';
import { drawGpsMarkers } from '../../../core/utils/gps-markers';
@Component({
  selector: 'app-operations-map',
  template: `<div
      class="map-canvas"
      role="region"
      aria-label="Destinos de pedidos y recorridos por orden de parada"
    ></div>
    @if (error() || operations.gpsError() || !operations.ubicaciones().length) {
      <p role="status">{{ error() || operations.gpsError() || 'Sin ubicación de repartidores para esta fecha. Se muestran los destinos.' }}</p>
    }`,
  styles: [
    `
      :host {
        display: block;
        position: absolute;
        inset: 0;
        z-index: 0;
      }
      .map-canvas {
        width: 100%;
        height: 100%;
        min-height: 500px;
      }
      p {
        position: absolute;
        bottom: 80px;
        left: 20px;
        z-index: 400;
        padding: 10px;
        background: var(--color-surface-container-lowest);
        font-size: 11px;
        border-radius: 8px;
      }
    `,
  ],
})
export class OperationsMap implements OnDestroy {
  @Input() zoneId = '';
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly operations = inject(OperationsService);
  readonly error = signal('');
  private ready = signal(false);
  private map?: Leaflet.Map;
  private L?: typeof Leaflet;
  private layers?: Leaflet.LayerGroup;
  private destroyed = false;
  private resize?: ResizeObserver;
  private timer?: ReturnType<typeof setInterval>;
  constructor() {
    afterNextRender(() => void this.init());
    effect(() => {
      this.operations.pedidos();
      this.operations.rutas();
      this.operations.zonas();
      this.operations.ubicaciones();
      if (this.ready()) this.draw();
    });
  }
  ngOnChanges() {
    this.draw();
  }
  async init() {
    try {
      this.L = await import('leaflet');
      if (this.destroyed) return;
      const container = this.host.nativeElement.querySelector<HTMLElement>('.map-canvas')!;
      this.map = this.L.map(container, { zoomControl: false }).setView([-2.1894, -79.8891], 12);
      this.L.control.zoom({ position: 'bottomright' }).addTo(this.map);
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
      this.layers = this.L.layerGroup().addTo(this.map);
      this.ready.set(true);
      this.timer=setInterval(()=>this.draw(),30000);
      this.draw();
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.map?.invalidateSize());
        this.resize.observe(container);
      }
    } catch {
      this.error.set('No se pudo cargar el mapa. Verifica tu conexión.');
    }
  }
  draw() {
    if (!this.L || !this.map || !this.layers) return;
    const L = this.L,
      colors = mapPalette();
    this.layers.clearLayers();
    this.operations
      .zonas()
      .filter((z) => z.activa && (!this.zoneId || z.id === this.zoneId))
      .forEach((z) => {
        const title = document.createElement('span');
        title.textContent = z.nombre;
        L.polygon(
          z.poligono.map((p) => [p.latitud, p.longitud] as [number, number]),
          { color: colors.primary, weight: 1, fillOpacity: 0.04 },
        )
          .bindTooltip(title)
          .addTo(this.layers!);
      });
    this.operations
      .rutas()
      .filter((r) => r.estado !== 'Cancelada' && (!this.zoneId || r.zonaId === this.zoneId))
      .forEach((r, i) => {
        const stops = [...r.paradas].sort((a, b) => a.orden - b.orden);
        if (stops.length)
          L.polyline(
            stops.map(
              (s) => [s.pedido.ubicacion.latitud, s.pedido.ubicacion.longitud] as [number, number],
            ),
            {
              color: [colors.primary, colors.secondary, colors.teal][i % 3],
              weight: 3,
              dashArray: '6 6',
            },
          ).addTo(this.layers!);
      });
    const pedidos = new Map(this.operations.pedidos().map((p) => [p.id, p]));
    this.operations
      .rutas()
      .flatMap((r) => r.paradas)
      .forEach((s) => pedidos.set(s.pedido.id, s.pedido));
    [...pedidos.values()]
      .filter((p) => p.estado !== 'Cancelado' && (!this.zoneId || p.zonaId === this.zoneId))
      .forEach((p) => {
        const title = document.createElement('span');
        title.textContent = p.clienteNombre + ' · ' + p.direccion;
        L.circleMarker([p.ubicacion.latitud, p.ubicacion.longitud], {
          radius: 6,
          color: colors.primary,
          fillOpacity: 0.9,
          weight: 2,
        })
          .bindPopup(title)
          .addTo(this.layers!);
      });
    drawGpsMarkers(L,this.layers,this.operations.ubicaciones(),this.operations.rutas(),id=>this.operations.driver(id),colors.teal,this.zoneId);
    const bounds = L.featureGroup(this.layers.getLayers()).getBounds();
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearInterval(this.timer);
    this.resize?.disconnect();
    this.map?.remove();
  }
}

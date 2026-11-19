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
        min-height: 100%;
      }
      p {
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 400;
        margin: 0;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid #e5e5ea;
        font-size: 11px;
        font-weight: 500;
        color: #1c1c1e;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        pointer-events: none;
      }
      ::ng-deep .carto-zone-div-icon {
        background: transparent !important;
        border: none !important;
      }
      ::ng-deep .carto-zone-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(8px);
        border: 1.5px solid rgba(0, 122, 255, 0.45);
        border-radius: 9999px;
        padding: 3px 10px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 600;
        color: #1c1c1e;
        white-space: nowrap;
        pointer-events: auto;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        transform: translate(-50%, -50%);
      }
      ::ng-deep .carto-zone-badge:hover {
        transform: translate(-50%, -50%) scale(1.08);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
        background: #ffffff;
      }
      ::ng-deep .carto-zone-badge.active-zone {
        background: #007aff !important;
        color: #ffffff !important;
        border-color: #007aff !important;
        box-shadow: 0 4px 16px rgba(0, 122, 255, 0.4) !important;
      }
      ::ng-deep .badge-dot {
        width: 7px;
        height: 7px;
        border-radius: 9999px;
        flex-shrink: 0;
      }
      ::ng-deep .active-zone .badge-dot {
        background-color: #ffffff !important;
      }
      ::ng-deep .badge-count {
        background: rgba(0, 122, 255, 0.12);
        color: #007aff;
        font-size: 10px;
        font-weight: 700;
        padding: 0 5px;
        border-radius: 9999px;
      }
      ::ng-deep .active-zone .badge-count {
        background: rgba(255, 255, 255, 0.25) !important;
        color: #ffffff !important;
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

    const ZONE_COLORS = [
      '#007AFF', // Azul RouteOS
      '#5856D6', // Índigo / Púrpura
      '#34C759', // Verde Esmeralda
      '#FF9500', // Naranja
      '#AF52DE', // Magenta
      '#30B0C7', // Turquesa
    ];

    const activeZones = this.operations.zonas().filter((z) => z.activa);
    const isAll = !this.zoneId;

    activeZones.forEach((z, i) => {
      const color = ZONE_COLORS[i % ZONE_COLORS.length];
      const isSelected = this.zoneId === z.id;

      if (isAll || isSelected) {
        // Dynamic styled polygon matching Stitch cartography
        const poly = L.polygon(
          z.poligono.map((p) => [p.latitud, p.longitud] as [number, number]),
          {
            color: isSelected ? '#007AFF' : color,
            weight: isSelected ? 3 : 2,
            dashArray: isSelected ? '6 3' : '5 3',
            fillColor: color,
            fillOpacity: isSelected ? 0.18 : 0.08,
          },
        ).addTo(this.layers!);

        poly.on('click', () => {
          this.operations.zona = z.id;
          void this.operations.refresh(true);
        });

        // Dynamic Cartographic Label on Centroid
        if (z.poligono.length >= 3) {
          let latSum = 0, lngSum = 0;
          for (const p of z.poligono) {
            latSum += p.latitud;
            lngSum += p.longitud;
          }
          const lat = latSum / z.poligono.length;
          const lng = lngSum / z.poligono.length;

          const count = this.operations.resumen()?.porZona.find((p) => p.zonaId === z.id)?.cantidad ?? 0;

          const badgeHtml = `
            <div class="carto-zone-badge ${isSelected ? 'active-zone' : ''}">
              <span class="badge-dot" style="background-color: ${color}"></span>
              <span class="badge-text">${z.nombre}</span>
              ${count > 0 ? `<span class="badge-count">${count}</span>` : ''}
            </div>
          `;

          const icon = L.divIcon({
            className: 'carto-zone-div-icon',
            html: badgeHtml,
            iconSize: [0, 0],
          });

          L.marker([lat, lng], { icon, interactive: true })
            .on('click', () => {
              this.operations.zona = z.id;
              void this.operations.refresh(true);
            })
            .addTo(this.layers!);
        }
      } else {
        // Context outline for non-selected zones
        L.polygon(
          z.poligono.map((p) => [p.latitud, p.longitud] as [number, number]),
          {
            color: '#8E8E93',
            weight: 1,
            dashArray: '4 4',
            fillColor: '#8E8E93',
            fillOpacity: 0.02,
            opacity: 0.35,
          },
        ).addTo(this.layers!);
      }
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

    if (!isAll) {
      const selectedPoly = activeZones.find((z) => z.id === this.zoneId);
      if (selectedPoly && selectedPoly.poligono.length) {
        const polyBounds = L.latLngBounds(
          selectedPoly.poligono.map((p) => [p.latitud, p.longitud] as [number, number]),
        );
        if (polyBounds.isValid()) {
          this.map.fitBounds(polyBounds, { padding: [55, 55], maxZoom: 15 });
          return;
        }
      }
    }
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

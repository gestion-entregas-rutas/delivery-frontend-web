import {
  Component,
  Input,
  ElementRef,
  inject,
  afterNextRender,
  effect,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter,
  signal,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { OperationsService } from '../../../core/services/operations.service';
import { mapPalette } from '../../../core/utils/map-palette';
import { drawGpsMarkers } from '../../../core/utils/gps-markers';
import { PedidoDto } from '../../../core/models/logistica.models';
import { ventana } from '../../../core/utils/route-presentation';

/** Color y texto de cada estado de pedido en el mapa (coincide con la leyenda). */
const ESTADO_MAPA: Record<string, { color: string; texto: string }> = {
  Pendiente: { color: '#D93025', texto: 'Sin ruta' },
  AsignadoARuta: { color: '#6A1B9A', texto: 'Asignado' },
  EnCamino: { color: '#B26A00', texto: 'En camino' },
  Entregado: { color: '#1E8E4E', texto: 'Entregado' },
};
@Component({
  selector: 'app-operations-map',
  template: `<div
      class="map-canvas"
      role="region"
      aria-label="Destinos de pedidos y recorridos por orden de parada"
    ></div>
    @if (error() || operations.gpsError() || !operations.ubicaciones().length) {
      <p role="status">{{ error() || operations.gpsError() || 'Sin ubicación de repartidores para esta fecha. Se muestran los destinos.' }}</p>
    }
    <div class="map-legend" aria-label="Leyenda del mapa">
      @for (e of leyenda; track e.texto) {
        <span><i [style.background]="e.color"></i>{{ e.texto }}</span>
      }
      <span class="hint">{{ zoneId ? 'Toca un punto para ver el pedido' : 'Toca una zona para ver sus entregas' }}</span>
    </div>`,
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
      .map-legend {
        position: absolute;
        left: 12px;
        bottom: 12px;
        z-index: 400;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
        max-width: calc(100% - 80px);
        padding: 6px 10px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(8px);
        border: 1px solid #e5e5ea;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        font-size: 11px;
        font-weight: 500;
        color: #1c1c1e;
        pointer-events: none;
      }
      .map-legend span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .map-legend i {
        width: 9px;
        height: 9px;
        border-radius: 9999px;
        display: inline-block;
      }
      .map-legend .hint {
        color: #6e6e73;
      }
      ::ng-deep .pedido-popup {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        line-height: 1.35;
        min-width: 180px;
      }
      ::ng-deep .pedido-popup strong {
        display: block;
        font-size: 13px;
      }
      ::ng-deep .pedido-popup .estado {
        display: inline-block;
        margin-top: 4px;
        padding: 1px 8px;
        border-radius: 9999px;
        color: #fff;
        font-size: 11px;
        font-weight: 600;
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
        background: #6A1B9A !important;
        color: #ffffff !important;
        border-color: #6A1B9A !important;
        box-shadow: 0 4px 16px rgba(106, 27, 154, 0.4) !important;
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
        background: rgba(106, 27, 154, 0.12);
        color: #7E23DF;
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
export class OperationsMap implements OnDestroy, OnChanges {
  @Input() zoneId = '';
  /** Pedido a resaltar (centra el mapa y abre su ficha). */
  @Input() focusPedidoId = '';
  /** Se emite al tocar una zona (polígono o etiqueta). */
  @Output() zoneSelected = new EventEmitter<string>();
  /** Se emite al tocar el punto de un pedido. */
  @Output() pedidoSelected = new EventEmitter<string>();
  readonly leyenda = Object.values(ESTADO_MAPA);
  private markers = new Map<string, Leaflet.CircleMarker>();
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
  ngOnChanges(changes: SimpleChanges) {
    if (Object.keys(changes).every((k) => k === 'focusPedidoId')) this.focus();
    else this.draw();
  }
  /** Centra el mapa en el pedido resaltado y abre su ficha. */
  private focus() {
    const m = this.focusPedidoId ? this.markers.get(this.focusPedidoId) : undefined;
    if (!m || !this.map) return;
    this.map.setView(m.getLatLng(), Math.max(this.map.getZoom(), 16), { animate: true });
    m.openPopup();
  }
  /** Ficha del pedido (solo textContent: los datos vienen de clientes). */
  private popup(p: PedidoDto): HTMLElement {
    const info = ESTADO_MAPA[p.estado] ?? { color: '#8E8E93', texto: this.operations.label(p.estado) };
    const box = document.createElement('div');
    box.className = 'pedido-popup';
    const add = (tag: string, text: string) => {
      const el = document.createElement(tag);
      el.textContent = text;
      box.appendChild(el);
      return el;
    };
    add('strong', p.clienteNombre);
    add('div', p.direccion);
    const intervalo = ventana(p.compromisoInicioEn, p.compromisoFinEn);
    add('div', 'Entrega: ' + (intervalo ?? (p.horaEntrega || '').slice(0, 5)));
    if (p.rutaId) {
      const ruta = this.operations.rutas().find((r) => r.id === p.rutaId);
      const parada = ruta?.paradas.find((s) => s.pedido?.id === p.id);
      add(
        'div',
        'Ruta #' + this.operations.short(p.rutaId) +
          (parada ? ' · parada ' + parada.orden : '') +
          (ruta ? ' · ' + this.operations.driver(ruta.repartidorId) : ''),
      );
    }
    const estado = add('span', info.texto);
    estado.className = 'estado';
    estado.style.background = info.color;
    return box;
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
      this.error.set('');
      this.timer = setInterval(() => this.draw(), 30000);
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.map?.invalidateSize());
        this.resize.observe(container);
      }
    } catch (err) {
      console.error('[OperationsMap] Error inicializando Leaflet:', err);
      this.error.set('No se pudo cargar el mapa. Verifica tu conexión.');
      return;
    }
    this.draw();
  }
  draw() {
    if (!this.L || !this.map || !this.layers) return;
    try {
      const L = this.L,
        colors = mapPalette();
      this.layers.clearLayers();
      this.markers.clear();

      const ZONE_COLORS = [
        '#6A1B9A', // Morado Marca
        '#7E23DF', // Acción viva
        '#1E8E4E', // Verde Esmeralda
        '#B26A00', // Naranja / Ámbar
        '#4A1273', // Profundo
        '#30B0C7', // Turquesa
      ];

      const activeZones = (this.operations.zonas() || []).filter(
        (z) => z.activa && z.poligono && z.poligono.length >= 3,
      );
      const isAll = !this.zoneId;

      activeZones.forEach((z, i) => {
        const color = ZONE_COLORS[i % ZONE_COLORS.length];
        const isSelected = this.zoneId === z.id;

        if (isAll || isSelected) {
          // Dynamic styled polygon matching Stitch cartography
          const poly = L.polygon(
            z.poligono.map((p) => [p.latitud, p.longitud] as [number, number]),
            {
              color: isSelected ? '#7E23DF' : color,
              weight: isSelected ? 3 : 2,
              dashArray: isSelected ? '6 3' : '5 3',
              fillColor: color,
              fillOpacity: isSelected ? 0.18 : 0.08,
            },
          ).addTo(this.layers!);

          poly.on('click', () => this.zoneSelected.emit(z.id));

          // Dynamic Cartographic Label on Centroid
          if (z.poligono.length >= 3) {
            let latSum = 0, lngSum = 0;
            for (const p of z.poligono) {
              latSum += p.latitud;
              lngSum += p.longitud;
            }
            const lat = latSum / z.poligono.length;
            const lng = lngSum / z.poligono.length;

            const count = this.operations.resumen()?.porZona?.find((p) => p.zonaId === z.id)?.cantidad ?? 0;

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
              .on('click', () => this.zoneSelected.emit(z.id))
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
          )
            .on('click', () => this.zoneSelected.emit(z.id))
            .addTo(this.layers!);
        }
      });

      this.operations
        .rutas()
        .filter((r) => r.estado !== 'Cancelada' && (!this.zoneId || r.zonaId === this.zoneId))
        .forEach((r, i) => {
          const stops = [...(r.paradas || [])]
            .filter((s) => s?.pedido?.ubicacion?.latitud != null && s?.pedido?.ubicacion?.longitud != null)
            .sort((a, b) => a.orden - b.orden);
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
        .flatMap((r) => r.paradas || [])
        .filter((s) => s?.pedido)
        .forEach((s) => pedidos.set(s.pedido.id, s.pedido));
      [...pedidos.values()]
        .filter((p) => p && p.estado !== 'Cancelado' && (!this.zoneId || p.zonaId === this.zoneId) && p.ubicacion?.latitud != null && p.ubicacion?.longitud != null)
        .forEach((p) => {
          const marker = L.circleMarker([p.ubicacion.latitud, p.ubicacion.longitud], {
            radius: this.zoneId ? 8 : 6,
            color: '#ffffff',
            fillColor: ESTADO_MAPA[p.estado]?.color ?? colors.primary,
            fillOpacity: 0.95,
            weight: 2,
          })
            .bindPopup(() => this.popup(p))
            .on('click', () => this.pedidoSelected.emit(p.id))
            .addTo(this.layers!);
          this.markers.set(p.id, marker);
        });
      drawGpsMarkers(L,this.layers,this.operations.ubicaciones(),this.operations.rutas(),id=>this.operations.driver(id),colors.teal,this.zoneId);

      if (!isAll) {
        const selectedPoly = activeZones.find((z) => z.id === this.zoneId);
        if (selectedPoly && selectedPoly.poligono && selectedPoly.poligono.length) {
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
    } catch (err) {
      console.error('[OperationsMap] Error dibujando capas:', err);
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearInterval(this.timer);
    this.resize?.disconnect();
    this.map?.remove();
  }
}

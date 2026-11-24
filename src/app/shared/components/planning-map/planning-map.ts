import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  afterNextRender,
  effect,
  inject,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { OperationsService } from '../../../core/services/operations.service';
import { RutaDto } from '../../../core/models/logistica.models';
import { cargarLeaflet } from '../../../core/utils/leaflet-loader';
import { formatHoraEcuador, ventana } from '../../../core/utils/route-presentation';

/** Un color por ruta (mismo orden que la lista de rutas del panel). */
export const COLORES_PLAN = ['#6A1B9A', '#1E8E4E', '#B26A00', '#0E7490', '#C62828', '#4A1273', '#7E23DF', '#2563EB'];

const TINTA = '#1B1230';
const VERDE = '#1E8E4E';
const MARCA = '#6A1B9A';

/** Clave de ubicación (~10 m) para separar paradas que caen en el mismo lugar. */
const clave = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

const esc = (t: string) => {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
};

/**
 * Mapa de planificación a pantalla completa (Armado y Optimización): zonas, local, recorridos,
 * paradas numeradas y última señal GPS. La ruta seleccionada se resalta; el resto queda de fondo.
 */
@Component({
  selector: 'app-planning-map',
  standalone: true,
  template: `<div #mapa class="absolute inset-0 z-0" role="region" aria-label="Mapa de planificación de rutas"></div>
    @if (error) {
      <p class="absolute inset-0 flex items-center justify-center text-sm text-on-surface-variant">No se pudo cargar el mapa.</p>
    }`,
  styles: [':host{position:absolute;inset:0;display:block}'],
})
export class PlanningMap implements OnChanges, OnDestroy {
  private readonly operations = inject(OperationsService);
  @Input() rutas: RutaDto[] = [];
  @Input() rutaId: string | null = null;
  @Input() paradaId: string | null = null;
  @Input() zonaId = '';
  @Output() rutaSeleccionada = new EventEmitter<string>();
  @Output() paradaSeleccionada = new EventEmitter<{ rutaId: string; pedidoId: string }>();

  @ViewChild('mapa') private mapaEl?: ElementRef<HTMLDivElement>;
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private base?: Leaflet.LayerGroup;
  private capa?: Leaflet.LayerGroup;
  private marcadores = new Map<string, Leaflet.Marker>();
  private ultimoEncuadre = '';
  private dibujando = false;
  private destruido = false;
  private resize?: ResizeObserver;
  error = false;

  constructor() {
    afterNextRender(() => void this.iniciar());
    effect(() => {
      this.operations.zonas();
      this.operations.local.location();
      this.dibujarBase();
    });
    effect(() => {
      this.operations.ubicaciones();
      this.dibujar(false);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (Object.keys(changes).every((k) => k === 'paradaId')) {
      this.dibujar(false);
      this.enfocarParada();
      return;
    }
    if (changes['zonaId']) this.dibujarBase();
    this.dibujar(true);
  }

  // ---- Controles públicos (botones flotantes de la página) ----
  acercar() { this.map?.zoomIn(); }
  alejar() { this.map?.zoomOut(); }
  centrar() {
    this.ultimoEncuadre = '';
    this.dibujar(true);
  }

  private async iniciar() {
    if (this.destruido || this.map || !this.mapaEl) return;
    try {
      this.L = await cargarLeaflet();
      if (this.destruido || !this.mapaEl) return;
      this.map = this.L.map(this.mapaEl.nativeElement, { zoomControl: false }).setView([-1.2416, -78.6197], 13);
      // Mismo mapa base que el resto del panel (OpenStreetMap, sin API key).
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
      this.base = this.L.layerGroup().addTo(this.map);
      this.capa = this.L.layerGroup().addTo(this.map);
      // La separación de paradas coincidentes es en píxeles: se recalcula al cambiar el zoom.
      this.map.on('zoomend', () => {
        if (!this.dibujando) this.dibujar(false);
      });
      this.dibujarBase();
      this.dibujar(true);
      setTimeout(() => this.map?.invalidateSize(), 60);
      // Al abrir/cerrar el panel lateral cambia el ancho del mapa.
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.map?.invalidateSize());
        this.resize.observe(this.mapaEl.nativeElement);
      }
    } catch {
      this.error = true;
    }
  }

  private dibujarBase() {
    const L = this.L, capa = this.base;
    if (!L || !capa) return;
    capa.clearLayers();
    for (const z of this.operations.zonas().filter((x) => x.activa && x.poligono.length >= 3)) {
      const activa = this.zonaId === z.id;
      L.polygon(z.poligono.map((p) => [p.latitud, p.longitud] as [number, number]), {
        color: activa ? '#7E23DF' : '#8E8E93',
        weight: activa ? 1.5 : 1,
        opacity: activa ? 0.9 : 0.45,
        fillColor: activa ? '#7E23DF' : '#8E8E93',
        fillOpacity: activa ? 0.06 : 0.02,
        dashArray: '4 4',
        interactive: false,
      })
        .bindTooltip(esc(z.nombre.toUpperCase()), {
          permanent: true,
          direction: 'center',
          className: 'planning-zone-label' + (activa ? ' activa' : ''),
        })
        .addTo(capa);
    }
    const local = this.operations.local.location();
    if (local)
      L.marker([local.ubicacion.latitud, local.ubicacion.longitud], {
        title: local.nombre,
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: '',
          html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;background:${TINTA};color:#fff;font:16px/1 'Material Symbols Outlined';box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff">storefront</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      })
        .bindTooltip(esc(local.nombre))
        .addTo(capa);
  }

  private dibujar(encuadrar: boolean) {
    const L = this.L, map = this.map, capa = this.capa;
    if (!L || !map || !capa) return;
    capa.clearLayers();
    this.marcadores.clear();
    const sel = this.rutaId;

    // 1) Encuadre con posiciones reales (solo cuando cambia lo que se mira).
    const clavesEncuadre = `${sel ?? ''}|${this.zonaId}|${this.rutas.map((r) => r.id).join(',')}`;
    if (encuadrar && clavesEncuadre !== this.ultimoEncuadre) {
      const puntos: [number, number][] = [];
      for (const r of this.rutas) {
        if (sel && r.id !== sel) continue;
        if (r.origen) puntos.push([r.origen.latitud, r.origen.longitud]);
        for (const p of r.paradas) puntos.push([p.pedido.ubicacion.latitud, p.pedido.ubicacion.longitud]);
      }
      if (!puntos.length && this.zonaId) {
        const z = this.operations.zonas().find((x) => x.id === this.zonaId);
        z?.poligono.forEach((p) => puntos.push([p.latitud, p.longitud]));
      }
      const local = this.operations.local.location();
      if (!sel && local) puntos.push([local.ubicacion.latitud, local.ubicacion.longitud]);
      if (puntos.length) {
        this.dibujando = true;
        try {
          map.fitBounds(L.latLngBounds(puntos), { padding: [70, 70], maxZoom: 16, animate: false });
        } finally {
          this.dibujando = false;
        }
        this.ultimoEncuadre = clavesEncuadre;
      }
    }

    // 2) Paradas en el mismo lugar: abanico alrededor del punto real.
    const grupos = new Map<string, number>();
    for (const r of this.rutas)
      for (const p of r.paradas) {
        const k = clave(p.pedido.ubicacion.latitud, p.pedido.ubicacion.longitud);
        grupos.set(k, (grupos.get(k) ?? 0) + 1);
      }
    const usados = new Map<string, number>();
    const posicion = (lat: number, lng: number): [number, number] => {
      const k = clave(lat, lng);
      const total = grupos.get(k) ?? 1;
      if (total < 2) return [lat, lng];
      const n = usados.get(k) ?? 0;
      usados.set(k, n + 1);
      const ang = (2 * Math.PI * n) / total - Math.PI / 2;
      const radio = 18 + total * 2;
      const c = map.latLngToContainerPoint([lat, lng]);
      const d = map.containerPointToLatLng([c.x + radio * Math.cos(ang), c.y + radio * Math.sin(ang)]);
      return [d.lat, d.lng];
    };

    // Las rutas de fondo se dibujan primero; la seleccionada encima.
    const orden = [...this.rutas.map((r, i) => ({ r, i }))].sort((a, b) => Number(a.r.id === sel) - Number(b.r.id === sel));
    for (const { r, i } of orden) {
      const color = COLORES_PLAN[i % COLORES_PLAN.length];
      const activa = sel === r.id;
      const fondo = !!sel && !activa;
      const paradas = [...r.paradas].sort((a, b) => a.orden - b.orden);
      const posiciones = paradas.map((p) => posicion(p.pedido.ubicacion.latitud, p.pedido.ubicacion.longitud));
      const linea: [number, number][] = [];
      if (r.origen) linea.push([r.origen.latitud, r.origen.longitud]);
      linea.push(...posiciones);

      if (linea.length > 1) {
        if (activa) {
          L.polyline(linea, { color: '#7E23DF', weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' })
            .on('click', () => this.rutaSeleccionada.emit(r.id))
            .addTo(capa);
          L.polyline(linea, { color: '#ffffff', weight: 2, dashArray: '8 10', lineCap: 'round', interactive: false }).addTo(capa);
        } else {
          L.polyline(linea, { color, weight: fondo ? 2 : 4, opacity: fondo ? 0.35 : 0.85, dashArray: '8 6' })
            .on('click', () => this.rutaSeleccionada.emit(r.id))
            .addTo(capa);
        }
      }

      paradas.forEach((p, idx) => {
        const entregada = p.pedido.estado === 'Entregado';
        const elegida = activa && this.paradaId === p.pedido.id;
        const v = ventana(p.pedido.compromisoInicioEn, p.pedido.compromisoFinEn);
        const hora = v ?? (formatHoraEcuador(p.finalizacionEstimadaEn) || p.pedido.horaEntrega.slice(0, 5));
        let html: string, size: number;
        if (fondo) {
          size = 24;
          html = `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#fff;color:${TINTA};font:700 11px/1 Inter,sans-serif;border:2px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,.25);opacity:.85">${p.orden}</span>`;
        } else {
          size = 32;
          const bg = entregada ? VERDE : elegida ? MARCA : activa ? TINTA : color;
          const ring = elegida ? 'box-shadow:0 0 0 5px rgba(106,27,154,.22),0 4px 10px rgba(0,0,0,.3);' : 'box-shadow:0 4px 10px rgba(0,0,0,.3);';
          html = `<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${bg};color:#fff;font:700 12px/1 Inter,sans-serif;border:2px solid #fff;${ring}">${p.orden}</span>`;
        }
        const m = L.marker(posiciones[idx], {
          zIndexOffset: activa ? 600 : fondo ? 0 : 200,
          icon: L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        })
          .bindTooltip(
            `<strong>Parada ${p.orden}:</strong> ${esc(p.pedido.direccion)} <span style="opacity:.7">(${esc(hora)})</span><br><span style="opacity:.7">${esc(this.operations.driver(r.repartidorId))} · ${esc(p.pedido.clienteNombre)}</span>`,
            { direction: 'right', offset: [size / 2, 0] },
          )
          .on('click', () => this.paradaSeleccionada.emit({ rutaId: r.id, pedidoId: p.pedido.id }))
          .addTo(capa);
        if (activa) this.marcadores.set(p.pedido.id, m);
      });

      // Última señal GPS del repartidor de esta ruta.
      const gps = this.operations.ubicaciones().find((u) => u.rutaId === r.id);
      if (gps && (!sel || activa)) {
        const vivo = r.estado === 'EnCurso';
        const nombre = esc(this.operations.driver(r.repartidorId).split(' ')[0]);
        L.marker([gps.latitud, gps.longitud], {
          zIndexOffset: 900,
          icon: L.divIcon({
            className: '',
            html: `<span style="position:relative;display:flex;flex-direction:column;align-items:center">
              <span style="position:absolute;bottom:42px;white-space:nowrap;background:${TINTA};color:#fff;font:700 10px/1 Inter,sans-serif;padding:3px 7px;border-radius:5px;box-shadow:0 1px 4px rgba(0,0,0,.3)">${nombre} · ${formatHoraEcuador(gps.capturadaEn)}</span>
              <span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${vivo ? VERDE : '#8E8E93'};color:#fff;font:18px/1 'Material Symbols Outlined';border:2px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,.3)">two_wheeler</span>
            </span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
        })
          .bindTooltip(vivo ? 'Última señal GPS' : 'Última ubicación conocida')
          .on('click', () => this.rutaSeleccionada.emit(r.id))
          .addTo(capa);
      }
    }
  }

  private enfocarParada() {
    const m = this.paradaId ? this.marcadores.get(this.paradaId) : undefined;
    if (!m || !this.map) return;
    this.map.setView(m.getLatLng(), Math.max(this.map.getZoom(), 15), { animate: true });
    m.openTooltip();
  }

  ngOnDestroy() {
    this.destruido = true;
    this.resize?.disconnect();
    this.map?.remove();
  }
}

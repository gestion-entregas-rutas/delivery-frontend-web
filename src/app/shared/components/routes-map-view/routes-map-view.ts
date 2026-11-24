import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type * as Leaflet from 'leaflet';
import { cargarLeaflet } from '../../../core/utils/leaflet-loader';
import { OperationsService } from '../../../core/services/operations.service';
import { PedidoDto, RutaDto } from '../../../core/models/logistica.models';
import { ESTADO_RUTA, formatHoraEcuador, iniciales, puntualidadCorta, TONO_TEXTO, ventana } from '../../../core/utils/route-presentation';

/** Clave de ubicación con ~10 m de precisión para detectar paradas en el mismo lugar. */
const clave = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

/** Un color por ruta para distinguirlas en el mapa y en la lista. */
export const COLORES_RUTA = ['#6A1B9A', '#1E8E4E', '#B26A00', '#0E7490', '#C62828', '#4A1273', '#7E23DF', '#2563EB'];

/**
 * Vista de mapa de las rutas del día: todas las rutas sobre OpenStreetMap, con su orden de
 * visita (línea recta, aproximado), el local, las zonas activas y la última señal GPS.
 */
@Component({
  selector: 'app-routes-map-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './routes-map-view.html',
})
export class RoutesMapView implements OnDestroy {
  private readonly operations = inject(OperationsService);
  private readonly rutasSig = signal<RutaDto[]>([]);
  readonly seleccion = signal<string | null>(null);

  @Input({ required: true }) set rutas(value: RutaDto[]) { this.rutasSig.set(value); }
  @Input() set seleccionada(id: string | null | undefined) { this.seleccion.set(id ?? null); }
  @Output() detalle = new EventEmitter<RutaDto>();
  @Output() transferir = new EventEmitter<PedidoDto>();

  readonly items = computed(() =>
    this.rutasSig().map((r, i) => {
      const nombre = this.operations.driver(r.repartidorId);
      const fines = r.paradas.map((p) => p.finalizacionEstimadaEn).filter((x): x is string => !!x);
      const gps = this.operations.ubicaciones().find((u) => u.repartidorId === r.repartidorId && u.rutaId === r.id);
      return {
        ruta: r,
        color: COLORES_RUTA[i % COLORES_RUTA.length],
        nombre,
        iniciales: iniciales(nombre),
        zona: this.operations.zoneName(r.zonaId),
        corto: '#' + this.operations.short(r.id),
        estado: ESTADO_RUTA[r.estado] ?? { texto: r.estado, clase: 'bg-surface-container-high text-on-surface-variant' },
        final: fines.length ? formatHoraEcuador(new Date(Math.max(...fines.map((f) => new Date(f).getTime()))).toISOString()) : null,
        gps,
        paradas: [...r.paradas].sort((a, b) => a.orden - b.orden).map((p) => {
          const punt = puntualidadCorta(p.pedido.puntualidad);
          return {
            pedido: p.pedido,
            orden: p.orden,
            direccion: p.pedido.direccion,
            cliente: p.pedido.clienteNombre,
            ventana: ventana(p.pedido.compromisoInicioEn, p.pedido.compromisoFinEn) ?? 'Flexible',
            punt: punt.texto,
            puntClase: TONO_TEXTO[punt.tono],
            transferible: p.pedido.estado === 'AsignadoARuta' && (r.estado === 'Planificada' || r.estado === 'EnCurso'),
          };
        }),
      };
    }),
  );
  readonly activa = computed(() => this.items().find((i) => i.ruta.id === this.seleccion()) ?? null);

  // ---------- Mapa ----------
  @ViewChild('mapa') private mapaEl?: ElementRef<HTMLDivElement>;
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private capaZonas?: Leaflet.LayerGroup;
  private capaRutas?: Leaflet.LayerGroup;
  private destruido = false;
  private dibujando = false;
  readonly mapaError = signal(false);

  constructor() {
    afterNextRender(() => void this.iniciar());
    effect(() => {
      const items = this.items();
      const sel = this.seleccion();
      if (this.map) this.dibujarRutas(items, sel);
    });
    effect(() => {
      const zonas = this.operations.zonas();
      const local = this.operations.local.location();
      if (this.map) this.dibujarBase(zonas, local);
    });
  }

  seleccionar(id: string) {
    this.seleccion.set(this.seleccion() === id ? null : id);
  }

  private async iniciar() {
    if (this.destruido || this.map || !this.mapaEl) return;
    try {
      this.L = await cargarLeaflet();
      if (this.destruido || !this.mapaEl) return;
      this.map = this.L.map(this.mapaEl.nativeElement).setView([-1.2416, -78.6197], 13);
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
      this.capaZonas = this.L.layerGroup().addTo(this.map);
      this.capaRutas = this.L.layerGroup().addTo(this.map);
      this.dibujarBase(this.operations.zonas(), this.operations.local.location());
      this.dibujarRutas(this.items(), this.seleccion());
      // La separación de puntos coincidentes es en píxeles: se recalcula al cambiar el zoom.
      // (Se ignora el zoomend que dispara el propio fitBounds durante un dibujo.)
      this.map.on('zoomend', () => {
        if (!this.dibujando) this.dibujarRutas(this.items(), this.seleccion(), false);
      });
      setTimeout(() => this.map?.invalidateSize(), 60);
    } catch {
      this.mapaError.set(true);
    }
  }

  private dibujarBase(zonas: ReturnType<OperationsService['zonas']>, local: ReturnType<OperationsService['local']['location']>) {
    const L = this.L, capa = this.capaZonas;
    if (!L || !capa) return;
    capa.clearLayers();
    for (const z of zonas.filter((x) => x.activa && x.poligono.length >= 3))
      L.polygon(z.poligono.map((p) => [p.latitud, p.longitud] as [number, number]), {
        color: '#6A1B9A', weight: 1, opacity: 0.35, fillOpacity: 0.04, dashArray: '4 4',
      }).bindTooltip(z.nombre).addTo(capa);
    if (local)
      L.marker([local.ubicacion.latitud, local.ubicacion.longitud], {
        title: local.nombre,
        icon: L.divIcon({
          className: '',
          html: '<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;background:#1B1230;color:#fff;font:16px/1 \'Material Symbols Outlined\';box-shadow:0 2px 6px rgba(0,0,0,.35)">storefront</span>',
          iconSize: [30, 30], iconAnchor: [15, 15],
        }),
        zIndexOffset: 1000,
      }).bindTooltip(local.nombre).addTo(capa);
  }

  /**
   * Pedidos de distintas paradas que caen en el mismo lugar (≈10 m). Se usan para separar
   * visualmente sus marcadores y avisar de direcciones distintas con la misma ubicación.
   */
  readonly coincidencias = computed(() => {
    const grupos = new Map<string, { nombre: string; orden: number; direccion: string; rutaId: string }[]>();
    for (const it of this.items())
      for (const p of it.paradas) {
        const k = clave(p.pedido.ubicacion.latitud, p.pedido.ubicacion.longitud);
        const g = grupos.get(k) ?? [];
        g.push({ nombre: it.nombre, orden: p.orden, direccion: p.direccion, rutaId: it.ruta.id });
        grupos.set(k, g);
      }
    return grupos;
  });
  /** Grupos con pedidos de rutas diferentes en el mismo punto (para el aviso del mapa). */
  readonly puntosCompartidos = computed(() =>
    [...this.coincidencias().values()].filter((g) => new Set(g.map((x) => x.rutaId)).size > 1),
  );

  resumenGrupo(g: { nombre: string; direccion: string }[]) {
    return g.map((x) => `${x.nombre} (${x.direccion})`).join(' · ');
  }

  private dibujarRutas(items: ReturnType<RoutesMapView['items']>, sel: string | null, ajustar = true) {
    const L = this.L, map = this.map, capa = this.capaRutas;
    if (!L || !map || !capa) return;
    capa.clearLayers();
    // 1) Encuadre con las posiciones reales (antes de calcular separaciones en píxeles).
    const visibles: [number, number][] = [];
    for (const it of items) {
      if (sel && sel !== it.ruta.id) continue;
      if (it.ruta.origen) visibles.push([it.ruta.origen.latitud, it.ruta.origen.longitud]);
      for (const p of it.paradas) visibles.push([p.pedido.ubicacion.latitud, p.pedido.ubicacion.longitud]);
    }
    const local = this.operations.local.location();
    if (!sel && local) visibles.push([local.ubicacion.latitud, local.ubicacion.longitud]);
    if (ajustar && visibles.length) {
      this.dibujando = true;
      try {
        map.fitBounds(L.latLngBounds(visibles), { padding: [44, 44], maxZoom: 16, animate: false });
      } finally {
        this.dibujando = false;
      }
    }

    // 2) Paradas en el mismo lugar: se reparten en abanico alrededor del punto real.
    const grupos = this.coincidencias();
    const usados = new Map<string, number>();
    const posicion = (lat: number, lng: number): [number, number] => {
      const k = clave(lat, lng);
      const total = grupos.get(k)?.length ?? 1;
      if (total < 2) return [lat, lng];
      const n = usados.get(k) ?? 0;
      usados.set(k, n + 1);
      const ang = (2 * Math.PI * n) / total - Math.PI / 2;
      const radio = 16 + total * 2;
      const c = map.latLngToContainerPoint([lat, lng]);
      const d = map.containerPointToLatLng([c.x + radio * Math.cos(ang), c.y + radio * Math.sin(ang)]);
      return [d.lat, d.lng];
    };
    const dibujados = new Set<string>();

    for (const it of items) {
      const activa = !sel || sel === it.ruta.id;
      const puntos: [number, number][] = [];
      if (it.ruta.origen) puntos.push([it.ruta.origen.latitud, it.ruta.origen.longitud]);
      const posiciones = it.paradas.map((p) => posicion(p.pedido.ubicacion.latitud, p.pedido.ubicacion.longitud));
      puntos.push(...posiciones);
      // Punto real de los grupos separados: pequeño ancla con las líneas guía hacia cada marcador.
      it.paradas.forEach((p, idx) => {
        const lat = p.pedido.ubicacion.latitud, lng = p.pedido.ubicacion.longitud;
        const k = clave(lat, lng);
        if ((grupos.get(k)?.length ?? 1) < 2) return;
        L.polyline([[lat, lng], posiciones[idx]], { color: '#1B1230', weight: 1, opacity: 0.5, interactive: false }).addTo(capa);
        if (!dibujados.has(k)) {
          dibujados.add(k);
          const g = grupos.get(k)!;
          const tip = document.createElement('div');
          const t = document.createElement('strong');
          t.textContent = `${g.length} pedidos en la misma ubicación`;
          tip.appendChild(t);
          for (const x of g) {
            const l = document.createElement('div');
            l.textContent = `${x.nombre} · ${x.orden}. ${x.direccion}`;
            tip.appendChild(l);
          }
          L.circleMarker([lat, lng], { radius: 4, color: '#ffffff', weight: 1.5, fillColor: '#1B1230', fillOpacity: 1 })
            .bindTooltip(tip)
            .addTo(capa);
        }
      });
      if (puntos.length > 1)
        L.polyline(puntos, { color: it.color, weight: activa ? 4 : 2, opacity: activa ? 0.9 : 0.25, dashArray: '8 6' })
          .on('click', () => this.seleccionar(it.ruta.id))
          .addTo(capa);
      it.paradas.forEach((p, idx) => {
        const fondo = p.pedido.estado === 'Entregado' ? '#1E8E4E' : it.color;
        const tip = document.createElement('div');
        const t = document.createElement('strong');
        t.textContent = it.nombre;
        tip.appendChild(t);
        const d = document.createElement('div');
        d.textContent = `${p.orden}. ${p.direccion} · ${p.ventana}`;
        tip.appendChild(d);
        L.marker(posiciones[idx], {
          title: `${it.nombre} · ${p.orden}. ${p.direccion}`,
          opacity: activa ? 1 : 0.35,
          zIndexOffset: activa && sel ? 500 : 0,
          icon: L.divIcon({
            className: '',
            html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${fondo};color:#fff;font:700 12px/1 Inter,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${p.orden}</span>`,
            iconSize: [26, 26], iconAnchor: [13, 13],
          }),
        })
          .bindTooltip(tip)
          .on('click', () => this.seleccionar(it.ruta.id))
          .addTo(capa);
      });
      if (it.gps)
        L.marker([it.gps.latitud, it.gps.longitud], {
          title: `${it.nombre} · GPS ${formatHoraEcuador(it.gps.capturadaEn)}`,
          opacity: activa ? 1 : 0.4,
          zIndexOffset: 900,
          icon: L.divIcon({
            className: '',
            html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#fff;color:${it.color};font:20px/1 'Material Symbols Outlined';border:2px solid ${it.color};box-shadow:0 1px 4px rgba(0,0,0,.35)">two_wheeler</span>`,
            iconSize: [30, 30], iconAnchor: [15, 15],
          }),
        }).addTo(capa);
    }
  }

  ngOnDestroy() {
    this.destruido = true;
    this.map?.remove();
  }
}

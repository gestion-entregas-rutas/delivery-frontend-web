import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
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
import type * as Leaflet from 'leaflet';
import { CommonModule } from '@angular/common';
import { OperationsService } from '../../../core/services/operations.service';
import { ParadaDto, PuntoDto, RutaDto } from '../../../core/models/logistica.models';
import {
  ESTADO_RUTA,
  TONO_FONDO,
  duracionEstimadaMin,
  esperaMinutos,
  formatDuracion,
  formatHoraEcuador,
  iniciales,
  puntualidadCorta,
  ventana,
} from '../../../core/utils/route-presentation';

interface ParadaDetalle {
  pedidoId: string;
  orden: number;
  codigo: string;
  direccion: string;
  cliente: string;
  telefono: string;
  ventana: string | null;
  llegada: string;
  fin: string;
  espera: number | null;
  inicioVentana: string;
  traslado: number | null;
  puntualidad: { texto: string; clase: string };
  entregada: boolean;
  enCamino: boolean;
  carga: string;
  observaciones: string;
}

interface PuntoMapa { punto: PuntoDto; etiqueta: string; titulo: string; tipo: 'origen' | 'parada' | 'entregada'; }

/** Detalle de una ruta: métricas, itinerario, trazado aproximado y datos del repartidor. */
@Component({
  selector: 'app-route-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './route-detail-modal.html',
})
export class RouteDetailModal implements OnDestroy {
  private readonly operations = inject(OperationsService);
  readonly saving = this.operations.saving;
  private readonly rutaSig = signal<RutaDto | null>(null);
  @Input({ required: true }) set ruta(value: RutaDto) { this.rutaSig.set(value); }
  get ruta(): RutaDto { return this.rutaSig()!; }

  @Output() cerrar = new EventEmitter<void>();
  @Output() recalcular = new EventEmitter<RutaDto>();
  @Output() ordenar = new EventEmitter<RutaDto>();
  @Output() verEnMapa = new EventEmitter<RutaDto>();

  @HostListener('document:keydown.escape') onEscape() { this.cerrar.emit(); }

  readonly vista = computed(() => {
    const r = this.rutaSig()!;
    const ops = this.operations;
    const repartidor = ops.repartidores().find((d) => d.id === r.repartidorId);
    const nombre = repartidor?.nombre ?? ops.driver(r.repartidorId);
    const paradas = [...r.paradas].sort((a, b) => a.orden - b.orden);
    const usados = paradas.length;
    const conCompromiso = paradas.filter((p) => p.pedido.compromisoInicioEn && p.pedido.compromisoFinEn);
    const inicios = conCompromiso.map((p) => new Date(p.pedido.compromisoInicioEn!).getTime());
    const fines = conCompromiso.map((p) => new Date(p.pedido.compromisoFinEn!).getTime());
    // Holgura: el menor margen entre la finalización estimada y el límite comprometido.
    const holguras = conCompromiso
      .filter((p) => p.finalizacionEstimadaEn && p.pedido.estado !== 'Entregado')
      .map((p) => Math.round((new Date(p.pedido.compromisoFinEn!).getTime() - new Date(p.finalizacionEstimadaEn!).getTime()) / 60000));
    const enPlazo = conCompromiso.filter((p) => !['RetrasoPrevisto', 'PlazoVencido', 'EntregadoConRetraso'].includes(p.pedido.puntualidad?.estado ?? '')).length;
    const local = ops.local.location();
    const gps = ops.ubicaciones().find((u) => u.repartidorId === r.repartidorId && u.rutaId === r.id);
    const estado = ESTADO_RUTA[r.estado] ?? { texto: r.estado, clase: 'bg-surface-container-high text-on-surface-variant' };
    return {
      corto: ops.short(r.id),
      zona: ops.zoneName(r.zonaId),
      estado,
      nombre,
      iniciales: iniciales(nombre),
      telefono: repartidor?.telefono ?? '',
      estadoRepartidor: repartidor ? ops.label(repartidor.estado) : 'No informado',
      capacidadRepartidor: repartidor?.capacidadMaxima ?? null,
      usados,
      capacidad: r.capacidad,
      porcentaje: r.capacidad ? Math.min(100, Math.round((usados / r.capacidad) * 100)) : 0,
      distancia: r.distanciaEstimadaKm != null ? r.distanciaEstimadaKm.toFixed(1) + ' km' : null,
      duracion: formatDuracion(duracionEstimadaMin(r)),
      ventanaGeneral: inicios.length ? `${formatHoraEcuador(new Date(Math.min(...inicios)).toISOString())} – ${formatHoraEcuador(new Date(Math.max(...fines)).toISOString())}` : null,
      holgura: holguras.length ? Math.min(...holguras) : null,
      cumplimiento: conCompromiso.length ? `${enPlazo} de ${conCompromiso.length} en plazo` : 'Sin entregas comprometidas',
      estimadoEn: formatHoraEcuador(r.estimacionesActualizadasEn),
      salida: formatHoraEcuador(r.salidaProgramadaEn),
      origenNombre: local?.nombre || (r.origen ? 'Local' : 'Origen no informado'),
      origenDireccion: local?.direccion || (r.origen ? `${r.origen.latitud.toFixed(5)}, ${r.origen.longitud.toFixed(5)}` : 'Arma la ruta con la ubicación del local para estimar tiempos'),
      gps: gps
        ? { hora: formatHoraEcuador(gps.capturadaEn), reciente: gps.esReciente, precision: gps.precisionMetros }
        : null,
      llena: usados >= r.capacidad,
      editable: r.estado === 'Planificada' || r.estado === 'EnCurso',
      paradas: paradas.map((p) => this.detalle(p)),
      mapa: this.puntosMapa(r, paradas, local?.nombre),
    };
  });

  private detalle(p: ParadaDto): ParadaDetalle {
    const d = p.pedido.detalles;
    const punt = puntualidadCorta(p.pedido.puntualidad);
    const carga = [
      d?.pesoKg != null ? `${d.pesoKg} kg` : '',
      d?.tipoCarga && d.tipoCarga !== 'General' ? d.tipoCarga : '',
      d?.fragil ? 'Frágil' : '',
      d?.prioridad && d.prioridad !== 'Normal' ? 'Prioridad ' + d.prioridad.toLowerCase() : '',
    ].filter(Boolean).join(' · ');
    return {
      pedidoId: p.pedido.id,
      orden: p.orden,
      codigo: '#' + this.operations.short(p.pedido.id),
      direccion: p.pedido.direccion,
      cliente: p.pedido.clienteNombre,
      telefono: p.pedido.clienteTelefono,
      ventana: ventana(p.pedido.compromisoInicioEn, p.pedido.compromisoFinEn),
      llegada: formatHoraEcuador(p.llegadaEstimadaEn),
      fin: formatHoraEcuador(p.finalizacionEstimadaEn),
      espera: esperaMinutos(p.llegadaEstimadaEn, p.inicioAtencionEstimadoEn),
      inicioVentana: formatHoraEcuador(p.pedido.compromisoInicioEn),
      traslado: p.trasladoEstimadoMinutos != null ? Math.round(p.trasladoEstimadoMinutos) : null,
      puntualidad: { texto: punt.texto, clase: TONO_FONDO[punt.tono] },
      entregada: p.pedido.estado === 'Entregado',
      enCamino: p.pedido.estado === 'EnCamino',
      carga,
      observaciones: d?.observaciones ?? '',
    };
  }

  /** Salida y paradas con coordenadas reales, en orden de visita. */
  private puntosMapa(r: RutaDto, paradas: ParadaDto[], local?: string): PuntoMapa[] {
    const puntos: PuntoMapa[] = [];
    if (r.origen) puntos.push({ punto: r.origen, etiqueta: '', titulo: local || 'Salida', tipo: 'origen' });
    for (const s of paradas)
      puntos.push({
        punto: s.pedido.ubicacion,
        etiqueta: String(s.orden),
        titulo: `${s.orden}. ${s.pedido.direccion}`,
        tipo: s.pedido.estado === 'Entregado' ? 'entregada' : 'parada',
      });
    return puntos;
  }

  // ---------- Mapa (Leaflet + OpenStreetMap) ----------
  @ViewChild('mapa') private mapaEl?: ElementRef<HTMLDivElement>;
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private capa?: Leaflet.LayerGroup;
  private destruido = false;

  constructor() {
    afterNextRender(() => void this.iniciarMapa());
    // Redibuja cuando la ruta cambia (SignalR, recálculo, reordenamiento).
    effect(() => {
      const puntos = this.vista().mapa;
      if (this.map) this.dibujar(puntos);
    });
  }

  private async iniciarMapa() {
    if (this.destruido || this.map || !this.mapaEl) return;
    try {
      this.L = await import('leaflet');
      if (this.destruido || !this.mapaEl) return;
      this.map = this.L.map(this.mapaEl.nativeElement, { zoomControl: true, attributionControl: true });
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
      this.capa = this.L.layerGroup().addTo(this.map);
      this.dibujar(this.vista().mapa);
      setTimeout(() => this.map?.invalidateSize(), 50);
    } catch {
      this.mapaError.set(true);
    }
  }
  readonly mapaError = signal(false);

  private dibujar(puntos: PuntoMapa[]) {
    const L = this.L, map = this.map, capa = this.capa;
    if (!L || !map || !capa) return;
    capa.clearLayers();
    if (!puntos.length) { map.setView([-1.2416, -78.6197], 13); return; }
    const latlngs = puntos.map((p) => [p.punto.latitud, p.punto.longitud] as [number, number]);
    L.polyline(latlngs, { color: '#7E23DF', weight: 4, opacity: 0.8, dashArray: '8 6' }).addTo(capa);
    for (const p of puntos) {
      const color = p.tipo === 'origen' ? '#1B1230' : p.tipo === 'entregada' ? '#1E8E4E' : '#6A1B9A';
      const tam = p.tipo === 'origen' ? 18 : 26;
      const html = p.tipo === 'origen'
        ? `<span style="display:block;width:${tam}px;height:${tam}px;border-radius:50%;background:${color};border:4px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`
        : `<span style="display:flex;align-items:center;justify-content:center;width:${tam}px;height:${tam}px;border-radius:50%;background:${color};color:#fff;font:700 12px/1 Inter,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${p.etiqueta}</span>`;
      L.marker([p.punto.latitud, p.punto.longitud], {
        title: p.titulo,
        icon: L.divIcon({ className: '', html, iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] }),
      }).addTo(capa);
    }
    map.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28], maxZoom: 16 });
  }

  ngOnDestroy() {
    this.destruido = true;
    this.map?.remove();
  }

  readonly hayObservacion = (p: ParadaDetalle) => !!p.observaciones;

  holguraTexto(min: number | null) {
    if (min == null) return 'Sin estimación';
    return min >= 0 ? `Holgura: +${min} min` : `Excede: ${-min} min`;
  }
}

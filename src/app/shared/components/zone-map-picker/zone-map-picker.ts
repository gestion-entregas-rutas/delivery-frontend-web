import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  inject,
  signal,
  afterNextRender,
  OnChanges,
  OnDestroy,
  effect,
} from '@angular/core';
import { PuntoDto } from '../../../core/models/logistica.models';
import type * as Leaflet from 'leaflet';
import { mapPalette } from '../../../core/utils/map-palette';
import type { LineString, MultiLineString, Polygon, MultiPolygon } from 'geojson';
import { LocalLocationService } from '../../../core/services/local-location.service';
import { localMapMarker } from '../../../core/utils/local-map-marker';
import { zoneGeometryError } from '../../../core/utils/zone-geometry';
import { MapSearch } from '../map-search/map-search';
import { Subscription } from 'rxjs';
import { AddressResult } from '../../../core/models/address-result.model';
import { PlaceBoundaryPreview } from '../../../core/models/place-boundary.models';
import { PlaceBoundaryService } from '../../../core/services/place-boundary.service';
import {
  MAX_VERTICES_ZONA,
  distanciaKm,
  simplificarPoligono,
} from '../../../core/utils/simplify-polygon';

/** A partir de cuántos vértices se dibujan como puntos pequeños (no arrastrables). */
const UMBRAL_COMPACTO = 30;
/** Un clic a más de esta distancia (km) del contorno pide confirmación. */
const DISTANCIA_LEJANA_KM = 3;

@Component({
  selector: 'app-zone-map-picker',
  imports: [MapSearch],
  templateUrl: './zone-map-picker.html',
  styleUrl: './zone-map-picker.css',
})
export class ZoneMapPicker implements OnChanges, OnDestroy {
  @Input() points: PuntoDto[] = [];
  @Input() disabled = false;
  @Output() pointsChange = new EventEmitter<PuntoDto[]>();
  readonly selected = signal<number | null>(null);
  readonly error = signal('');
  readonly tileWarning = signal(false);
  readonly local = inject(LocalLocationService);
  private readonly boundaries = inject(PlaceBoundaryService);
  readonly boundaryPreview = signal<PlaceBoundaryPreview | null>(null);
  readonly boundaryBusy = signal(false);
  readonly boundaryError = signal('');
  readonly boundaryNotice = signal('');
  readonly boundaryPlace = signal<AddressResult | null>(null);
  readonly replaceConfirmed = signal(false);
  readonly previousContour = signal<PuntoDto[] | null>(null);
  private boundaryRequest?: Subscription;
  private boundaryLayer?: Leaflet.GeoJSON;
  private boundaryGeneration = 0;
  /** Punto lejano pendiente de confirmar (clic accidental al mover el mapa). */
  readonly pendingFar = signal<{ point: PuntoDto; km: number } | null>(null);
  readonly maxVertices = MAX_VERTICES_ZONA;
  /** Muchos vértices: se dibujan como puntos pequeños y solo el seleccionado se arrastra. */
  get compacto() {
    return this.points.length > UMBRAL_COMPACTO;
  }
  get geometryError() {
    return this.points.length >= 3 ? zoneGeometryError(this.points) : '';
  }
  private localMarker?: Leaflet.Marker;
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private vertices?: Leaflet.LayerGroup;
  private shape?: Leaflet.Polyline<LineString | MultiLineString | Polygon | MultiPolygon>;
  private resize?: ResizeObserver;
  private destroyed = false;
  constructor() {
    effect(() => {
      this.local.location();
      this.drawLocal();
    });
    afterNextRender(() => void this.init());
  }
  ngOnChanges() {
    if (this.selected() !== null && this.selected()! >= this.points.length) this.selected.set(null);
    this.draw();
  }
  async init() {
    try {
      this.L = await import('leaflet');
      if (this.destroyed) return;
      const container = this.host.nativeElement.querySelector<HTMLElement>('.zone-map')!;
      this.map = this.L.map(container, { doubleClickZoom: false, worldCopyJump: true }).setView(
        [-2.1894, -79.8891],
        13,
      );
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      })
        .on('tileerror', () => this.tileWarning.set(true))
        .addTo(this.map);
      this.vertices = this.L.layerGroup().addTo(this.map);
      this.map.on('click', (e) => {
        const p = e.latlng.wrap();
        this.requestPoint({ latitud: p.lat, longitud: p.lng });
      });
      this.draw();
      this.fit();
      this.drawLocal();
      this.drawBoundaryPreview();
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.map?.invalidateSize());
        this.resize.observe(container);
      }
    } catch {
      this.error.set('No se pudo cargar el mapa. Cierra el formulario y vuelve a intentarlo.');
    }
  }
  /** Clic en el mapa: si cae muy lejos del contorno, pide confirmación antes de agregarlo. */
  requestPoint(point: PuntoDto) {
    if (this.disabled) return;
    if (this.points.length >= 3) {
      const km = Math.min(...this.points.map((p) => distanciaKm(p, point)));
      if (km > DISTANCIA_LEJANA_KM) {
        this.pendingFar.set({ point, km: Math.round(km * 10) / 10 });
        return;
      }
    }
    this.pendingFar.set(null);
    this.addPoint(point);
  }
  confirmFar() {
    const pending = this.pendingFar();
    this.pendingFar.set(null);
    if (pending) this.addPoint(pending.point);
  }
  /** Reduce un contorno con demasiados vértices; el dibujo anterior se puede recuperar. */
  simplify() {
    if (this.disabled || this.points.length <= MAX_VERTICES_ZONA) return;
    const antes = this.points.length;
    const simple = simplificarPoligono(this.points);
    if (simple.length >= antes) {
      this.error.set('No se pudo simplificar el contorno sin deformarlo.');
      return;
    }
    this.previousContour.set(this.points.map((p) => ({ ...p })));
    this.selected.set(null);
    this.commit(simple);
    this.fit();
    this.boundaryNotice.set(`Contorno simplificado de ${antes} a ${simple.length} vértices. Revisa el área y guarda la zona.`);
  }
  addPoint(point: PuntoDto) {
    if (this.disabled) return;
    if (
      !Number.isFinite(point.latitud) ||
      !Number.isFinite(point.longitud) ||
      Math.abs(point.latitud) > 90 ||
      Math.abs(point.longitud) > 180
    ) {
      this.error.set('Selecciona un punto válido en el mapa.');
      return;
    }
    if (this.points.some((p) => p.latitud === point.latitud && p.longitud === point.longitud)) {
      this.error.set('Ese punto ya pertenece a la zona. El borde se cierra automáticamente.');
      return;
    }
    this.selected.set(this.points.length);
    this.commit([...this.points, { ...point }]);
  }
  movePoint(index: number, point: PuntoDto) {
    if (this.disabled || !this.points[index]) return;
    if (
      !Number.isFinite(point.latitud) ||
      !Number.isFinite(point.longitud) ||
      Math.abs(point.latitud) > 90 ||
      Math.abs(point.longitud) > 180
    ) {
      this.error.set('Selecciona un punto válido en el mapa.');
      this.draw();
      return;
    }
    if (
      this.points.some(
        (p, i) => i !== index && p.latitud === point.latitud && p.longitud === point.longitud,
      )
    ) {
      this.error.set('Dos vértices no pueden ocupar el mismo lugar.');
      this.draw();
      return;
    }
    this.commit(this.points.map((p, i) => (i === index ? { ...point } : { ...p })));
  }
  removeSelected() {
    const index = this.selected();
    if (this.disabled || index === null) return;
    this.selected.set(null);
    this.commit(this.points.filter((_, i) => i !== index));
  }
  insertAfterSelected() {
    const index = this.selected();
    if (this.disabled || index == null || this.points.length < 2) return;
    const a = this.points[index],
      b = this.points[(index + 1) % this.points.length];
    const next = this.points.map((p) => ({ ...p }));
    next.splice(index + 1, 0, {
      latitud: (a.latitud + b.latitud) / 2,
      longitud: (a.longitud + b.longitud) / 2,
    });
    this.selected.set(index + 1);
    this.commit(next);
  }
  undo() {
    if (this.disabled || !this.points.length) return;
    this.selected.set(null);
    this.commit(this.points.slice(0, -1));
  }
  clear() {
    if (this.disabled) return;
    this.selected.set(null);
    this.commit([]);
  }
  private commit(points: PuntoDto[]) {
    this.discardBoundary();
    this.pendingFar.set(null);
    this.boundaryNotice.set('');
    this.points = points;
    this.error.set('');
    this.draw();
    this.pointsChange.emit(points.map((p) => ({ ...p })));
  }
  private latLngs(points = this.points): [number, number][] {
    return points.map((p) => [p.latitud, p.longitud]);
  }
  private draw() {
    if (!this.L || !this.map || !this.vertices) return;
    this.vertices.clearLayers();
    this.shape?.remove();
    const style = {
      color: mapPalette().primary,
      weight: 3,
      fillColor: mapPalette().primary,
      fillOpacity: 0.18,
      interactive: false,
    };
    this.shape =
      this.points.length >= 3
        ? this.L.polygon(this.latLngs(), style)
        : this.L.polyline(this.latLngs(), { ...style, dashArray: '6 5' });
    this.shape!.addTo(this.map);
    const compacto = this.compacto;
    this.points.forEach((p, i) => {
      if (compacto && this.selected() !== i) {
        // Punto pequeño: no se arrastra al mover el mapa; un clic lo selecciona para editarlo.
        this.L!.circleMarker([p.latitud, p.longitud], {
          radius: 4,
          color: '#ffffff',
          weight: 1.5,
          fillColor: mapPalette().primary,
          fillOpacity: 1,
          bubblingMouseEvents: false,
        })
          .on('click', () => {
            if (this.disabled) return;
            this.selected.set(i);
            this.draw();
          })
          .addTo(this.vertices!);
        return;
      }
      const marker = this.L!.marker([p.latitud, p.longitud], {
        draggable: !this.disabled,
        autoPan: true,
        bubblingMouseEvents: false,
        title: `Vértice ${i + 1}: arrastra para ajustar`,
        alt: `Vértice ${i + 1}`,
        icon: this.L!.divIcon({
          className: 'delivery-pin',
          html: `<span>${i + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(this.vertices!);
      marker.on('click', () => {
        if (!this.disabled) this.selected.set(i);
      });
      marker.on('dragstart', () => this.selected.set(i));
      marker.on('drag', () => {
        const position = marker.getLatLng().wrap();
        const preview = this.points.map((p, j) =>
          j === i ? { latitud: position.lat, longitud: position.lng } : p,
        );
        this.shape?.setLatLngs(this.latLngs(preview));
      });
      marker.on('dragend', () => {
        const position = marker.getLatLng().wrap();
        this.movePoint(i, { latitud: position.lat, longitud: position.lng });
      });
    });
  }
  fit() {
    if (!this.L || !this.map || !this.points.length) return;
    const bounds = this.L.latLngBounds(this.latLngs());
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
  }
  focusPoint(point: PuntoDto) {
    this.map?.setView([point.latitud, point.longitud], 15);
  }
  focusLocal() {
    const local = this.local.location();
    if (local) this.focusPoint(local.ubicacion);
  }
  loadBoundary(place: AddressResult) {
    if (this.disabled) return;
    this.discardBoundary();
    this.boundaryPlace.set(place);
    this.boundaryNotice.set('');
    this.boundaryBusy.set(true);
    const generation = this.boundaryGeneration;
    this.boundaryRequest = this.boundaries.load(place).subscribe({
      next: (preview) => {
        if (this.destroyed || generation !== this.boundaryGeneration) return;
        this.boundaryBusy.set(false);
        this.boundaryPreview.set(preview);
        this.drawBoundaryPreview();
      },
      error: (e) => {
        if (this.destroyed || generation !== this.boundaryGeneration) return;
        this.boundaryBusy.set(false);
        this.boundaryError.set(
          e?.status === 429
            ? 'El proveedor está limitando las consultas. Espera antes de reintentar; tu dibujo sigue intacto.'
            : e?.status === 0
              ? 'No se pudo conectar con el servicio de contornos. Tu dibujo sigue intacto.'
              : e?.name === 'TimeoutError'
                ? 'La consulta tardó demasiado. Puedes seguir dibujando manualmente.'
                : e?.message || 'No se pudo consultar el contorno. Tu dibujo sigue intacto.',
        );
      },
    });
  }
  discardBoundary() {
    this.boundaryGeneration++;
    this.boundaryRequest?.unsubscribe();
    this.boundaryLayer?.remove();
    this.boundaryLayer = undefined;
    this.boundaryBusy.set(false);
    this.boundaryPreview.set(null);
    this.boundaryPlace.set(null);
    this.boundaryError.set('');
    this.replaceConfirmed.set(false);
  }
  dismissBoundary() {
    this.discardBoundary();
    this.fit();
  }
  importBoundary() {
    const preview = this.boundaryPreview();
    if (this.disabled || this.boundaryBusy() || !preview?.points) return;
    if (this.points.length && !this.replaceConfirmed()) {
      this.boundaryError.set('Confirma que deseas reemplazar el dibujo actual.');
      return;
    }
    this.previousContour.set(this.points.map((p) => ({ ...p })));
    this.selected.set(null);
    // Los contornos de OpenStreetMap traen cientos de vértices: se reducen para poder editarlos.
    const importados = simplificarPoligono(preview.points);
    this.commit(importados);
    this.fit();
    this.boundaryNotice.set(
      (importados.length < preview.points.length
        ? `Contorno cargado y simplificado de ${preview.points.length} a ${importados.length} vértices. `
        : 'Contorno cargado como dibujo editable. ') +
        'Revisa el área y guarda la zona para enviarla al sistema.',
    );
  }
  restorePreviousContour() {
    const previous = this.previousContour();
    if (this.disabled || previous == null) return;
    this.previousContour.set(null);
    this.selected.set(null);
    this.commit(previous.map((p) => ({ ...p })));
    this.fit();
    this.boundaryNotice.set('Se restauró el dibujo anterior.');
  }
  private drawBoundaryPreview() {
    if (!this.L || !this.map) return;
    this.boundaryLayer?.remove();
    this.boundaryLayer = undefined;
    const geometry = this.boundaryPreview()?.geometry;
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return;
    this.boundaryLayer = this.L.geoJSON(geometry, {
      interactive: false,
      style: { color: mapPalette().secondary, weight: 3, dashArray: '8 6', fillOpacity: 0.12 },
    }).addTo(this.map);
    const bounds = this.boundaryLayer.getBounds();
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
  }
  private drawLocal() {
    if (!this.L || !this.map) return;
    this.localMarker?.remove();
    const local = this.local.location();
    if (local) {
      this.localMarker = localMapMarker(this.L, this.map, local);
      if (!this.points.length) this.focusLocal();
    }
  }
  ngOnDestroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.discardBoundary();
    this.resize?.disconnect();
    this.map?.remove();
  }
}

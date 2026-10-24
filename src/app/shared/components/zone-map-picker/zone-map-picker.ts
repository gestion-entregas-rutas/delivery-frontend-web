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
} from '@angular/core';
import { PuntoDto } from '../../../core/models/logistica.models';
import type * as Leaflet from 'leaflet';
import { mapPalette } from '../../../core/utils/map-palette';
import type { LineString, MultiLineString, Polygon, MultiPolygon } from 'geojson';

@Component({
  selector: 'app-zone-map-picker',
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
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private vertices?: Leaflet.LayerGroup;
  private shape?: Leaflet.Polyline<LineString | MultiLineString | Polygon | MultiPolygon>;
  private resize?: ResizeObserver;
  private destroyed = false;
  constructor() {
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
        this.addPoint({ latitud: p.lat, longitud: p.lng });
      });
      this.draw();
      this.fit();
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.map?.invalidateSize());
        this.resize.observe(container);
      }
    } catch {
      this.error.set('No se pudo cargar el mapa. Cierra el formulario y vuelve a intentarlo.');
    }
  }
  addPoint(point: PuntoDto) {
    if (this.disabled) return;
    if (this.points.some((p) => p.latitud === point.latitud && p.longitud === point.longitud)) {
      this.error.set('Ese punto ya pertenece a la zona. El borde se cierra automáticamente.');
      return;
    }
    this.selected.set(this.points.length);
    this.commit([...this.points, { ...point }]);
  }
  movePoint(index: number, point: PuntoDto) {
    if (this.disabled || !this.points[index]) return;
    this.commit(this.points.map((p, i) => (i === index ? { ...point } : { ...p })));
  }
  removeSelected() {
    const index = this.selected();
    if (this.disabled || index === null) return;
    this.selected.set(null);
    this.commit(this.points.filter((_, i) => i !== index));
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
    this.points.forEach((p, i) => {
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
  ngOnDestroy() {
    this.destroyed = true;
    this.resize?.disconnect();
    this.map?.remove();
  }
}

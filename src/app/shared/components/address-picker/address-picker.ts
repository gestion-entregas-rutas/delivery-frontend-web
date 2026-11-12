import {
  Component,
  Input,
  Output,
  EventEmitter,
  afterNextRender,
  inject,
  signal,
  OnChanges,
  OnDestroy,
  ElementRef,
  SimpleChanges,
} from '@angular/core';
import { AddressSearchService } from '../../../core/services/address-search.service';
import { AddressResult } from '../../../core/models/address-result.model';
import { Subscription } from 'rxjs';
import type * as Leaflet from 'leaflet';
import { PuntoDto, ZonaDto } from '../../../core/models/logistica.models';
import { LocalLocation } from '../../../core/models/local.models';
import { deliveryCoverage } from '../../../core/utils/delivery-coverage';
import { localMapMarker } from '../../../core/utils/local-map-marker';
import { mapPalette } from '../../../core/utils/map-palette';
@Component({
  selector: 'app-address-picker',
  template: `
    <div class="location-heading">
      <strong>Ubicación de entrega</strong
      ><button
        type="button"
        class="button"
        [disabled]="disabled || busy() || address.trim().length < 3"
        (click)="search()"
      >
        {{ busy() ? 'Buscando…' : '⌕ Buscar dirección en el mapa' }}
      </button>
    </div>
    <p class="hint">
      Busca la dirección escrita arriba o haz clic en el mapa para indicar dónde entregar.
    </p>
    @if (message()) {
      <p role="status" class="feedback">{{ message() }}</p>
    }
    @if (results().length) {
      <div class="results" aria-label="Direcciones encontradas">
        @for (result of results(); track $index) {
          <button type="button" [disabled]="disabled" (click)="choose(result)">
            <span>⌖</span>{{ result.label }}
          </button>
        }
      </div>
    }
    <div class="picker-map" #container></div>
    @if (coverageZones !== null) {
      <p class="hint">
        Las áreas sombreadas corresponden a nuestras zonas activas de entrega.
        {{
          shopLocation
            ? 'El marcador ⌂ identifica el local.'
            : 'Configura nuestro local en Zonas para mostrar su ubicación y calcular distancias.'
        }}
      </p>
      <button
        type="button"
        class="button"
        (click)="fitCoverage()"
        [disabled]="!activeZones.length && !shopLocation"
      >
        Ver todas las zonas de entrega
      </button>
      @if (!activeZones.length) {
        <p class="feedback" role="status">No hay zonas activas de entrega disponibles.</p>
      }
      @if (point()) {
        <p
          class="feedback"
          [style.color]="coverage.covered ? 'var(--color-primary)' : 'var(--color-status-urgent)'"
          [attr.role]="coverage.covered ? 'status' : 'alert'"
        >
          {{ coverage.message }}
        </p>
        @if (coverage.miles !== null) {
          <p class="hint">
            Distancia en línea recta desde el local: {{ coverage.miles!.toFixed(2) }} mi.
          </p>
        }
      }
    }
    <div class="location-status" role="status">
      {{
        selected()
          ? coverageZones === null || coverage.covered
            ? '✓ Punto seleccionado. Puedes ajustarlo haciendo clic en el mapa.'
            : 'Elige un punto dentro de las zonas sombreadas para continuar.'
          : 'Selecciona el punto de entrega antes de guardar.'
      }}
    </div>
    <small
      >Búsqueda: Photon · Datos © OpenStreetMap. Se envía solo el texto de dirección al
      buscador.</small
    >
  `,
  styleUrl: './address-picker.css',
})
export class AddressPicker implements OnChanges, OnDestroy {
  @Input() address = '';
  @Input() initialPoint: { latitud: number; longitud: number } | null = null;
  @Input() coverageZones: ZonaDto[] | null = null;
  @Input() shopLocation: LocalLocation | null = null;
  @Input() disabled = false;
  readonly point = signal<PuntoDto | null>(null);
  get activeZones() {
    return (this.coverageZones || []).filter((z) => z.activa && z.poligono.length >= 3);
  }
  get coverage() {
    return deliveryCoverage(
      this.point(),
      this.coverageZones || [],
      this.shopLocation?.ubicacion || null,
    );
  }
  private seed: { latitud: number; longitud: number } | null = null;
  @Output() locationChange = new EventEmitter<{ latitud: number; longitud: number } | null>();
  readonly busy = signal(false);
  readonly results = signal<AddressResult[]>([]);
  readonly message = signal('');
  readonly selected = signal(false);
  private service = inject(AddressSearchService);
  private host = inject(ElementRef<HTMLElement>);
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private marker?: Leaflet.Marker;
  private shopMarker?: Leaflet.Marker;
  private zoneLayers?: Leaflet.LayerGroup;
  private resize?: ResizeObserver;
  private request?: Subscription;
  private destroyed = false;
  constructor() {
    afterNextRender(() => void this.init());
  }
  ngOnChanges(changes: SimpleChanges = {}) {
    this.drawCoverage();
    if (this.disabled) this.marker?.dragging?.disable();
    else this.marker?.dragging?.enable();
    if (Object.keys(changes).length && !changes['address'] && !changes['initialPoint']) {
      if (!this.point()) this.fitCoverage();
      return;
    }
    this.seed = changes['initialPoint'] ? this.initialPoint : null;
    this.request?.unsubscribe();
    this.busy.set(false);
    this.results.set([]);
    this.message.set('');
    this.selected.set(false);
    this.point.set(null);
    this.marker?.remove();
    this.marker = undefined;
    if (this.seed) {
      this.point.set({ ...this.seed });
      this.selected.set(true);
      this.locationChange.emit(this.seed);
      if (this.map) this.setPoint(this.seed.latitud, this.seed.longitud);
    } else this.locationChange.emit(null);
  }
  async init() {
    if (this.destroyed || this.map) return;
    try {
      this.L = await import('leaflet');
      if (this.destroyed || this.map) return;
      this.map = this.L.map(this.host.nativeElement.querySelector('.picker-map')).setView(
        [-2.1894, -79.8891],
        13,
      );
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
      this.zoneLayers = this.L.layerGroup().addTo(this.map);
      this.drawCoverage();
      this.map.on('click', (e) => this.setPoint(e.latlng.lat, e.latlng.lng));
      if (this.seed) {
        this.setPoint(this.seed.latitud, this.seed.longitud);
        this.map.setView([this.seed.latitud, this.seed.longitud], 16);
      } else this.fitCoverage();
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.map?.invalidateSize());
        this.resize.observe(this.host.nativeElement.querySelector('.picker-map')!);
      }
    } catch {
      this.message.set('No se pudo cargar el mapa. Cierra el formulario e inténtalo de nuevo.');
    }
  }
  search() {
    if (this.disabled || this.busy() || this.address.trim().length < 3) return;
    this.results.set([]);
    this.message.set('');
    this.busy.set(true);
    this.request = this.service.search(this.address).subscribe({
      next: (results) => {
        this.results.set(results);
        this.busy.set(false);
        if (!results.length)
          this.message.set(
            'No encontramos esa dirección. Agrega la ciudad o selecciona el punto directamente en el mapa.',
          );
      },
      error: () => {
        this.busy.set(false);
        this.message.set(
          'El buscador no está disponible. Puedes seleccionar el punto directamente en el mapa.',
        );
      },
    });
  }
  choose(result: AddressResult) {
    if (this.disabled) return;
    this.setPoint(result.latitud, result.longitud);
    this.map?.setView([result.latitud, result.longitud], 17);
    this.results.set([]);
  }
  setPoint(latitud: number, longitud: number) {
    if (
      this.disabled ||
      !Number.isFinite(latitud) ||
      !Number.isFinite(longitud) ||
      Math.abs(latitud) > 90 ||
      Math.abs(longitud) > 180
    )
      return;
    if (!this.L || !this.map) return;
    this.marker?.remove();
    this.marker = this.L.marker([latitud, longitud], {
      draggable: !this.disabled,
      icon: this.L.divIcon({
        className: 'delivery-pin',
        html: '<span>⌖</span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    }).addTo(this.map);
    this.marker.on('dragend', () => {
      const p = this.marker!.getLatLng();
      if (!this.disabled) this.emit(p.lat, p.lng);
    });
    this.emit(latitud, longitud);
  }
  private emit(latitud: number, longitud: number) {
    this.selected.set(true);
    const point = { latitud, longitud };
    this.point.set(point);
    this.locationChange.emit({ ...point });
  }
  private drawCoverage() {
    if (!this.L || !this.map || !this.zoneLayers) return;
    this.zoneLayers.clearLayers();
    this.shopMarker?.remove();
    this.shopMarker = undefined;
    const colors = mapPalette();
    for (const zone of this.activeZones) {
      const label = document.createElement('span');
      label.textContent = zone.nombre;
      this.L.polygon(
        zone.poligono.map((p) => [p.latitud, p.longitud] as [number, number]),
        { color: colors.primary, fillOpacity: 0.12, weight: 2 },
      )
        .bindTooltip(label)
        .addTo(this.zoneLayers);
    }
    if (this.coverageZones !== null && this.shopLocation)
      this.shopMarker = localMapMarker(this.L, this.map, this.shopLocation);
  }
  fitCoverage() {
    if (!this.L || !this.map || this.coverageZones === null) return;
    const points = this.activeZones.flatMap((z) =>
      z.poligono.map((p) => [p.latitud, p.longitud] as [number, number]),
    );
    if (this.shopLocation)
      points.push([this.shopLocation.ubicacion.latitud, this.shopLocation.ubicacion.longitud]);
    if (points.length)
      this.map.fitBounds(this.L.latLngBounds(points), { padding: [25, 25], maxZoom: 15 });
  }
  ngOnDestroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.resize?.disconnect();
    this.request?.unsubscribe();
    this.map?.remove();
  }
}

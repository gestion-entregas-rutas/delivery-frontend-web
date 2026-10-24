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
} from '@angular/core';
import { AddressSearchService } from '../../../core/services/address-search.service';
import { AddressResult } from '../../../core/models/address-result.model';
import { Subscription } from 'rxjs';
import type * as Leaflet from 'leaflet';
@Component({
  selector: 'app-address-picker',
  template: `
    <div class="location-heading">
      <strong>Ubicación de entrega</strong
      ><button
        type="button"
        class="button"
        [disabled]="busy() || address.trim().length < 3"
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
          <button type="button" (click)="choose(result)"><span>⌖</span>{{ result.label }}</button>
        }
      </div>
    }
    <div class="picker-map" #container></div>
    <div class="location-status" role="status">
      {{
        selected()
          ? '✓ Punto seleccionado. Puedes ajustarlo haciendo clic en el mapa.'
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
  private request?: Subscription;
  private destroyed = false;
  constructor() {
    afterNextRender(() => void this.init());
  }
  ngOnChanges() {
    this.request?.unsubscribe();
    this.busy.set(false);
    this.results.set([]);
    this.message.set('');
    this.selected.set(false);
    this.marker?.remove();
    this.marker = undefined;
    this.locationChange.emit(null);
  }
  async init() {
    try {
      this.L = await import('leaflet');
      if (this.destroyed) return;
      this.map = this.L.map(this.host.nativeElement.querySelector('.picker-map')).setView(
        [-2.1894, -79.8891],
        13,
      );
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
      this.map.on('click', (e) => this.setPoint(e.latlng.lat, e.latlng.lng));
    } catch {
      this.message.set('No se pudo cargar el mapa. Cierra el formulario e inténtalo de nuevo.');
    }
  }
  search() {
    if (this.busy() || this.address.trim().length < 3) return;
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
    this.setPoint(result.latitud, result.longitud);
    this.map?.setView([result.latitud, result.longitud], 17);
    this.results.set([]);
  }
  setPoint(latitud: number, longitud: number) {
    if (!this.L || !this.map) return;
    this.marker?.remove();
    this.marker = this.L.marker([latitud, longitud], {
      draggable: true,
      icon: this.L.divIcon({
        className: 'delivery-pin',
        html: '<span>⌖</span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    }).addTo(this.map);
    this.marker.on('dragend', () => {
      const p = this.marker!.getLatLng();
      this.emit(p.lat, p.lng);
    });
    this.emit(latitud, longitud);
  }
  private emit(latitud: number, longitud: number) {
    this.selected.set(true);
    this.locationChange.emit({
      latitud: Number(latitud.toFixed(6)),
      longitud: Number(longitud.toFixed(6)),
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request?.unsubscribe();
    this.map?.remove();
  }
}

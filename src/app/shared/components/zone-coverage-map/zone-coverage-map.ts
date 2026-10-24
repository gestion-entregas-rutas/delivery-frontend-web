import {
  Component,
  Input,
  inject,
  ElementRef,
  afterNextRender,
  OnChanges,
  OnDestroy,
  signal,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { ZonaDto } from '../../../core/models/logistica.models';
import { mapPalette } from '../../../core/utils/map-palette';
@Component({
  selector: 'app-zone-coverage-map',
  template: `<div class="coverage-map" role="region" aria-label="Mapa de zonas geográficas"></div>
    <div class="coverage-tools">
      <select
        aria-label="Zona para centrar el mapa"
        [value]="selected"
        (change)="focusZone($any($event.target).value)"
      >
        <option value="">Ver todas las zonas</option>
        @for (zone of zones; track zone.id) {
          <option [value]="zone.id">{{ zone.nombre }} {{ zone.activa ? '' : '(inactiva)' }}</option>
        }</select
      ><button type="button" class="button" (click)="focusZone('')" [disabled]="!zones.length">
        Centrar
      </button>
    </div>
    @if (error()) {
      <p class="coverage-note" role="alert">{{ error() }}</p>
    }
    <p class="coverage-note">
      {{
        zones.length
          ? 'Contornos registrados. Las zonas inactivas se muestran con borde discontinuo.'
          : 'Registra una zona para ver su cobertura en el mapa.'
      }}
    </p>`,
  styles: [
    `
      :host {
        display: block;
      }
      .coverage-map {
        height: 440px;
        z-index: 0;
        background: var(--color-surface-container-low);
      }
      .coverage-tools {
        display: flex;
        gap: 8px;
        padding: 15px 17px 0;
      }
      .coverage-tools select {
        flex: 1;
        width: 100%;
        font-size: 12px;
      }
      .coverage-note {
        padding: 12px 17px 16px;
        color: var(--color-outline);
        font-size: 11px;
        line-height: 1.7;
      }
      @media (max-width: 600px) {
        .coverage-map {
          height: 310px;
        }
      }
    `,
  ],
})
export class ZoneCoverageMap implements OnChanges, OnDestroy {
  @Input() zones: ZonaDto[] = [];
  selected = '';
  readonly error = signal('');
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private layers?: Leaflet.LayerGroup;
  private destroyed = false;
  private resize?: ResizeObserver;
  constructor() {
    afterNextRender(() => void this.init());
  }
  ngOnChanges() {
    this.draw();
  }
  async init() {
    try {
      this.L = await import('leaflet');
      if (this.destroyed) return;
      const container = this.host.nativeElement.querySelector<HTMLElement>('.coverage-map')!;
      this.map = this.L.map(container).setView([-2.1894, -79.8891], 12);
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
      this.layers = this.L.layerGroup().addTo(this.map);
      this.draw();
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.map?.invalidateSize());
        this.resize.observe(container);
      }
    } catch {
      this.error.set('No se pudo cargar el mapa. Puedes continuar administrando las zonas.');
    }
  }
  draw() {
    if (!this.L || !this.map || !this.layers) return;
    this.layers.clearLayers();
    const colors = mapPalette();
    this.zones.forEach((zone, i) => {
      if (zone.poligono.length < 3) return;
      const label = document.createElement('span');
      label.textContent = zone.nombre;
      this.L!.polygon(
        zone.poligono.map((p) => [p.latitud, p.longitud] as [number, number]),
        {
          color: zone.activa
            ? [colors.primary, colors.teal, colors.secondary][i % 3]
            : colors.outline,
          weight: this.selected === zone.id ? 4 : 2,
          fillOpacity: zone.activa ? 0.12 : 0.04,
          dashArray: zone.activa ? undefined : '6 6',
        },
      )
        .bindTooltip(label)
        .on('click', () => this.focusZone(zone.id))
        .addTo(this.layers!);
    });
    this.fit();
  }
  focusZone(id: string) {
    this.selected = id;
    this.draw();
  }
  private fit() {
    if (!this.L || !this.map) return;
    const points = this.zones
      .filter((z) => !this.selected || z.id === this.selected)
      .flatMap((z) => z.poligono.map((p) => [p.latitud, p.longitud] as [number, number]));
    if (points.length)
      this.map.fitBounds(this.L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.resize?.disconnect();
    this.map?.remove();
  }
}

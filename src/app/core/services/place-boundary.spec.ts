import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import type { Polygon, MultiPolygon } from 'geojson';
import { PlaceBoundaryService, OVERPASS_URL } from './place-boundary.service';
import { AddressSearchService } from './address-search.service';
import { AddressResult } from '../models/address-result.model';
import { editableBoundary, MAX_IMPORTED_VERTICES } from '../utils/boundary-geometry';
import { ZoneMapPicker } from '../../shared/components/zone-map-picker/zone-map-picker';
import { MapSearch } from '../../shared/components/map-search/map-search';

const url = 'https://overpass.example.test/api/interpreter';
const place: AddressResult = {
  label: 'Barrio de prueba',
  latitud: -2.19,
  longitud: -79.9,
  osm: { type: 'way', id: 42 },
};
const geometry: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-79.900123456789, -2.18],
      [-79.88, -2.18],
      [-79.88, -2.2],
      [-79.900123456789, -2.2],
      [-79.900123456789, -2.18],
    ],
  ],
};
const raw = {
  elements: [
    {
      type: 'way',
      id: 42,
      nodes: [1, 2, 3, 4, 1],
      tags: { name: 'Barrio de prueba', landuse: 'residential' },
      geometry: geometry.coordinates[0].map(([lon, lat]) => ({ lon, lat })),
    },
  ],
};

describe('Búsqueda e importación de contornos OSM', () => {
  let http: HttpTestingController, service: PlaceBoundaryService, picker: ZoneMapPicker | undefined;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OVERPASS_URL, useValue: url },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PlaceBoundaryService);
  });
  afterEach(() => {
    picker?.ngOnDestroy();
    picker = undefined;
    http.verify();
  });
  it('convierte GeoJSON longitud/latitud sin redondear y elimina únicamente el cierre', () => {
    const converted = editableBoundary(geometry);
    expect(converted.points).toHaveLength(4);
    expect(converted.points?.[0]).toEqual({ latitud: -2.18, longitud: -79.900123456789 });
    expect(geometry.coordinates[0]).toHaveLength(5);
  });
  it('bloquea áreas múltiples, huecos, anillos abiertos y contornos demasiado detallados', () => {
    const multi: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [geometry.coordinates, geometry.coordinates],
    };
    expect(editableBoundary(multi).reason).toContain('varias áreas');
    expect(
      editableBoundary({
        ...geometry,
        coordinates: [geometry.coordinates[0], geometry.coordinates[0]],
      }).reason,
    ).toContain('huecos');
    expect(
      editableBoundary({ ...geometry, coordinates: [geometry.coordinates[0].slice(0, -1)] }).reason,
    ).toContain('cerrado');
    const ring = Array.from({ length: MAX_IMPORTED_VERTICES + 1 }, (_, i) => [
      i / 10000,
      Math.sin(i) / 1000,
    ]);
    ring.push(ring[0]);
    expect(editableBoundary({ type: 'Polygon', coordinates: [ring] }).points).toBeNull();
    expect(editableBoundary({ type: 'Point', coordinates: [0, 0] }).reason).toContain('no tiene');
  });
  it('obtiene la geometría real por id OSM exacto y reutiliza la caché', async () => {
    const task = firstValueFrom(service.load(place));
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('data')).toContain('way(42);out geom;');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(raw);
    const preview = await task;
    expect(preview.geometry?.type).toBe('Polygon');
    expect(preview.points).toHaveLength(4);
    const cached = await firstValueFrom(service.load(place));
    expect(cached.points).toEqual(preview.points);
    http.expectNone((r) => r.url === url);
  });
  it('conserva una relación de varias áreas en la vista previa sin aplanarla', async () => {
    const relationPlace = { ...place, osm: { type: 'relation' as const, id: 99 } };
    const shifted = geometry.coordinates[0].map(([lon, lat]) => ({ lon: lon + 1, lat }));
    const task = firstValueFrom(service.load(relationPlace));
    http
      .expectOne((r) => r.url === url)
      .flush({
        elements: [
          {
            type: 'relation',
            id: 99,
            tags: { type: 'multipolygon', name: 'Dos áreas' },
            members: [
              { type: 'way', ref: 1, role: 'outer', geometry: raw.elements[0].geometry },
              { type: 'way', ref: 2, role: 'outer', geometry: shifted },
            ],
          },
        ],
      });
    const preview = await task;
    expect(preview.geometry?.type).toBe('MultiPolygon');
    expect(preview.points).toBeNull();
    expect(preview.reason).toContain('varias áreas');
  });
  it('un lugar sin referencia o nodo no provoca consultas de contornos', async () => {
    const preview = await firstValueFrom(service.load({ ...place, osm: { type: 'node', id: 1 } }));
    expect(preview.points).toBeNull();
    expect(preview.reason).toContain('manualmente');
    http.expectNone((r) => r.url === url);
  });
  it('no ejecuta ids inválidos ni consultas arbitrarias en Overpass', async () => {
    await expect(
      firstValueFrom(service.load({ ...place, osm: { type: 'way', id: -1 } })),
    ).rejects.toThrow('identificador');
    http.expectNone((r) => r.url === url);
  });
  it('respeta la limitación del proveedor sin reintentar automáticamente', async () => {
    const task = firstValueFrom(service.load(place));
    const rejected = expect(task).rejects.toMatchObject({ status: 429 });
    http
      .expectOne((r) => r.url === url)
      .flush(
        {},
        { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '120' } },
      );
    await rejected;
    await expect(
      firstValueFrom(service.load({ ...place, osm: { type: 'way', id: 43 } })),
    ).rejects.toThrow('Espera');
    http.expectNone((r) => r.url === url);
  });
  it('rechaza respuestas parciales sin convertirlas en un contorno válido', async () => {
    const task = firstValueFrom(service.load(place));
    const rejected = expect(task).rejects.toThrow('completar');
    http.expectOne((r) => r.url === url).flush({ elements: [], remark: 'timeout' });
    await rejected;
  });
  it('muestra una vista previa y exige confirmación antes de reemplazar; permite recuperar el dibujo', async () => {
    picker = TestBed.createComponent(ZoneMapPicker).componentInstance;
    const original = [
      { latitud: 1, longitud: 1 },
      { latitud: 1, longitud: 2 },
      { latitud: 2, longitud: 1 },
    ];
    picker.points = original;
    const emit = vi.spyOn(picker.pointsChange, 'emit');
    picker.loadBoundary(place);
    http.expectOne((r) => r.url === url).flush(raw);
    await vi.waitFor(() => expect(picker!.boundaryBusy()).toBe(false));
    expect(picker.points).toBe(original);
    expect(emit).not.toHaveBeenCalled();
    expect(picker.boundaryPreview()?.points).toHaveLength(4);
    picker.importBoundary();
    expect(picker.points).toBe(original);
    expect(picker.boundaryError()).toContain('Confirma');
    picker.replaceConfirmed.set(true);
    picker.importBoundary();
    expect(picker.points).toHaveLength(4);
    expect(emit).toHaveBeenCalledOnce();
    expect(picker.boundaryPreview()).toBeNull();
    picker.movePoint(0, { latitud: -2.17, longitud: -79.91 });
    picker.restorePreviousContour();
    expect(picker.points).toEqual(original);
    expect(original[0]).toEqual({ latitud: 1, longitud: 1 });
    const cached = await firstValueFrom(service.load(place));
    expect(cached.points?.[0].latitud).toBe(-2.18);
  });
  it('descarta consultas pendientes cuando el usuario edita el dibujo manualmente', () => {
    picker = TestBed.createComponent(ZoneMapPicker).componentInstance;
    picker.loadBoundary(place);
    const req = http.expectOne((r) => r.url === url);
    picker.addPoint({ latitud: 1, longitud: 1 });
    expect(req.cancelled).toBe(true);
    expect(picker.boundaryPreview()).toBeNull();
    expect(picker.boundaryBusy()).toBe(false);
  });
  it('bloquea la importación mientras el formulario se guarda', () => {
    picker = TestBed.createComponent(ZoneMapPicker).componentInstance;
    picker.boundaryPreview.set({ place, geometry, ...editableBoundary(geometry) });
    picker.disabled = true;
    picker.importBoundary();
    picker.loadBoundary(place);
    expect(picker.points).toEqual([]);
    http.expectNone((r) => r.url === url);
  });
  it('mantiene la referencia OSM del resultado sin enviar el nombre del lugar a Overpass', async () => {
    const task = firstValueFrom(TestBed.inject(AddressSearchService).search('Barrio de prueba'));
    http
      .expectOne((r) => r.url === 'https://photon.komoot.io/api/')
      .flush({
        features: [
          {
            geometry: { coordinates: [-79.9, -2.19] },
            properties: { name: 'Barrio de prueba', osm_type: 'R', osm_id: 99 },
          },
        ],
      });
    expect((await task)[0].osm).toEqual({ type: 'relation', id: 99 });
  });
  it('buscar requiere una acción explícita; escribir solo cancela resultados anteriores', () => {
    const search = TestBed.runInInjectionContext(() => new MapSearch());
    search.query = 'Guayaquil';
    search.resetSearch();
    http.expectNone((r) => r.url === 'https://photon.komoot.io/api/');
    search.search();
    const req = http.expectOne((r) => r.url === 'https://photon.komoot.io/api/');
    search.query = 'Cuenca';
    search.resetSearch();
    expect(req.cancelled).toBe(true);
    search.ngOnDestroy();
  });
});

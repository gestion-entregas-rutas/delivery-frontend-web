import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  Observable,
  catchError,
  defer,
  from,
  map,
  of,
  switchMap,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { AddressResult } from '../models/address-result.model';
import { PlaceBoundaryPreview } from '../models/place-boundary.models';
import { editableBoundary, validAreaGeometry } from '../utils/boundary-geometry';

export const OVERPASS_URL = new InjectionToken<string>('OVERPASS_URL', {
  providedIn: 'root',
  factory: () => 'https://overpass-api.de/api/interpreter',
});
const CACHE_TTL = 15 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PlaceBoundaryService {
  private readonly http = inject(HttpClient);
  private readonly url = inject(OVERPASS_URL);
  private readonly cache = new Map<string, { at: number; preview: PlaceBoundaryPreview }>();
  private nextRequestAt = 0;
  load(place: AddressResult): Observable<PlaceBoundaryPreview> {
    return defer(() => {
      const osm = place.osm;
      if (!osm || osm.type === 'node')
        return of({ place, geometry: null, ...editableBoundary(null) });
      if (!['way', 'relation'].includes(osm.type) || !Number.isSafeInteger(osm.id) || osm.id <= 0)
        return throwError(() => new Error('El identificador del lugar no es válido.'));
      const key = `${osm.type}/${osm.id}`;
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.at < CACHE_TTL) return of({ ...cached.preview, place });
      if (Date.now() < this.nextRequestAt)
        return throwError(
          () => new Error('Espera unos segundos antes de consultar otro contorno.'),
        );
      this.nextRequestAt = Date.now() + 2000;
      const data = `[out:json][timeout:20][maxsize:33554432];${osm.type}(${osm.id});out geom;`;
      // Exact OSM element only. No arbitrary query text, bulk requests or automatic retries.
      return this.http
        .get<{ elements: unknown[]; remark?: string }>(this.url, {
          params: new HttpParams().set('data', data),
        })
        .pipe(
          timeout(45000),
          switchMap((raw) => {
            if (raw.remark || !Array.isArray(raw.elements))
              throw new Error(
                'El proveedor no pudo completar el contorno. Puedes reintentar la consulta manualmente.',
              );
            return from(import('osmtogeojson')).pipe(
              map((module) => {
                const convert = module.default;
                const collection = convert(raw as any, { flatProperties: true });
                const feature = collection.features.find((f) => f.id === key);
                if (feature?.properties?.['tainted'])
                  throw new Error(
                    'El contorno está incompleto. No se importará una geometría parcial.',
                  );
                const geometry = feature?.geometry || null;
                if (
                  geometry &&
                  ['Polygon', 'MultiPolygon'].includes(geometry.type) &&
                  !validAreaGeometry(geometry)
                )
                  throw new Error(
                    'El proveedor devolvió un contorno incompleto o con coordenadas inválidas.',
                  );
                return {
                  place,
                  geometry,
                  ...editableBoundary(geometry),
                } satisfies PlaceBoundaryPreview;
              }),
            );
          }),
          tap((preview) => {
            if (this.cache.size >= 30) this.cache.delete(this.cache.keys().next().value!);
            this.cache.set(key, { at: Date.now(), preview });
          }),
          catchError((e) => {
            if (e?.status === 429) {
              const retryAfter = e.headers?.get('Retry-After');
              const seconds = Number(retryAfter);
              const retryAt =
                retryAfter && Number.isFinite(seconds)
                  ? Date.now() + seconds * 1000
                  : Date.parse(retryAfter || '');
              this.nextRequestAt = Math.max(
                Date.now() + 60000,
                Number.isFinite(retryAt) ? retryAt : 0,
              );
            }
            return throwError(() => e);
          }),
        );
    });
  }
}

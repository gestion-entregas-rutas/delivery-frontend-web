import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { AddressResult } from '../models/address-result.model';
export const GEOCODING_URL = new InjectionToken<string>('GEOCODING_URL', {
  providedIn: 'root',
  factory: () => 'https://photon.komoot.io/api/',
});
@Injectable({ providedIn: 'root' })
export class AddressSearchService {
  private http = inject(HttpClient);
  private url = inject(GEOCODING_URL);
  search(query: string): Observable<AddressResult[]> {
    return this.http
      .get<{
        features: { geometry: { coordinates: number[] }; properties: Record<string, string> }[];
      }>(this.url, { params: { q: query.trim(), limit: 5, lat: -2.1894, lon: -79.8891 } })
      .pipe(
        map((data) =>
          data.features
            .filter(
              (f) =>
                f.geometry?.coordinates?.length >= 2 &&
                f.geometry.coordinates.slice(0, 2).every(Number.isFinite),
            )
            .map((f) => ({
              label: [
                f.properties['name'],
                f.properties['street'],
                f.properties['housenumber'],
                f.properties['district'],
                f.properties['city'],
                f.properties['state'],
                f.properties['country'],
              ]
                .filter(Boolean)
                .join(', '),
              longitud: f.geometry.coordinates[0],
              latitud: f.geometry.coordinates[1],
              ...this.osmReference(f.properties),
            })),
        ),
      );
  }
  /**
   * Dirección aproximada de un punto (Photon /reverse). Envía solo las coordenadas.
   * Devuelve null si no hay resultado.
   */
  reverse(latitud: number, longitud: number): Observable<string | null> {
    const url = this.url.replace(/api\/?$/, 'reverse');
    return this.http
      .get<{ features?: { properties: Record<string, string> }[] }>(url, {
        params: { lat: latitud, lon: longitud, limit: 1 },
      })
      .pipe(
        map((data) => {
          const p = data.features?.[0]?.properties;
          if (!p) return null;
          const calle = [p['street'], p['housenumber']].filter(Boolean).join(' ');
          const partes = [p['name'] !== p['street'] ? p['name'] : '', calle, p['district'], p['city'] || p['county']]
            .filter((x, i, a) => !!x && a.indexOf(x) === i);
          return partes.length ? partes.join(', ') : null;
        }),
      );
  }
  private osmReference(properties: Record<string, string>): Pick<AddressResult, 'osm'> {
    const type = ({ N: 'node', W: 'way', R: 'relation' } as const)[properties['osm_type']];
    const id = Number(properties['osm_id']);
    return type && Number.isSafeInteger(id) && id > 0 ? { osm: { type, id } } : {};
  }
}

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
            })),
        ),
      );
  }
}

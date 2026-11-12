import type { Geometry } from 'geojson';
import { AddressResult } from './address-result.model';
import { PuntoDto } from './logistica.models';

export interface PlaceBoundaryPreview {
  place: AddressResult;
  geometry: Geometry | null;
  points: PuntoDto[] | null;
  reason: string;
}

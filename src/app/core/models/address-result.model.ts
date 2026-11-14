export interface AddressResult {
  label: string;
  latitud: number;
  longitud: number;
  osm?: { type: 'node' | 'way' | 'relation'; id: number };
}

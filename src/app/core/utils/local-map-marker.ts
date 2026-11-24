import type * as Leaflet from 'leaflet';
import { LocalLocation } from '../models/local.models';

export function localMapMarker(
  L: typeof Leaflet,
  map: Leaflet.Map,
  local: LocalLocation,
): Leaflet.Marker {
  const label = document.createElement('div');
  label.textContent = `${local.nombre} · ${local.direccion}`;
  return L.marker([local.ubicacion.latitud, local.ubicacion.longitud], {
    title: local.nombre,
    icon: L.divIcon({
      className: 'delivery-pin',
      html: '<span aria-hidden="true">⌂</span>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    }),
  })
    .bindPopup(label)
    .addTo(map);
}

import type * as Leaflet from 'leaflet';
import { RutaDto, UbicacionRepartidorDto } from '../models/logistica.models';

export function recentLocation(p: UbicacionRepartidorDto, now = Date.now()): boolean {
  const age = now - Date.parse(p.capturadaEn);
  return Number.isFinite(age) && age >= 0 && age <= 120000;
}

export function drawGpsMarkers(
  L: typeof Leaflet,
  layers: Leaflet.LayerGroup,
  positions: UbicacionRepartidorDto[],
  routes: RutaDto[],
  driver: (id: string) => string,
  color: string,
  zoneId = '',
  routeId = '',
) {
  for (const p of positions) {
    const route = routes.find((r) => r.id === p.rutaId);
    if (!route || (zoneId && route.zonaId !== zoneId) || (routeId && route.id !== routeId))
      continue;
    const recent = recentLocation(p) && route.estado === 'EnCurso';
    const text = document.createElement('div');
    text.textContent = `${driver(p.repartidorId)} · ${recent ? 'Ubicación reciente' : 'Última ubicación conocida'} · Captura: ${new Date(p.capturadaEn).toLocaleString('es-EC')} · Precisión: ${p.precisionMetros == null ? 'No informada' : p.precisionMetros + ' m'}`;
    L.circleMarker([p.latitud, p.longitud], {
      radius: 10,
      color,
      weight: 3,
      fillOpacity: recent ? 0.9 : 0.25,
    })
      .bindPopup(text)
      .bindTooltip(recent ? 'Repartidor · GPS' : 'Repartidor · Última ubicación conocida')
      .addTo(layers);
  }
}

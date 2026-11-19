import { PuntoDto, ZonaDto } from '../models/logistica.models';
export function containsPoint(p: PuntoDto, vertices: PuntoDto[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i],
      b = vertices[j];
    if (
      a.latitud > p.latitud !== b.latitud > p.latitud &&
      p.longitud <
        ((b.longitud - a.longitud) * (p.latitud - a.latitud)) / (b.latitud - a.latitud) + a.longitud
    )
      inside = !inside;
  }
  return inside;
}
export function zoneForPoint(point: PuntoDto | null, zones: ZonaDto[]) {
  return point ? zones.find((z) => z.activa && containsPoint(point, z.poligono)) : undefined;
}
export function initialsAvatar(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .replace(/[^a-zA-ZÀ-ÿ]/g, '')
    .toUpperCase();
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#F1E6F8"/><text x="32" y="38" text-anchor="middle" font-family="Arial" font-size="20" fill="#6A1B9A">${initials}</text></svg>`,
    )
  );
}

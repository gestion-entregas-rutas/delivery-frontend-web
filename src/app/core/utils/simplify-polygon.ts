import { PuntoDto } from '../models/logistica.models';
import { zoneGeometryError } from './zone-geometry';

/** Máximo de vértices recomendado para editar una zona a mano. */
export const MAX_VERTICES_ZONA = 60;

interface Xy {
  x: number;
  y: number;
}

/** Proyección equirectangular local en metros (suficiente para zonas de pocos km). */
function proyectar(points: PuntoDto[]): Xy[] {
  const lat0 = (points.reduce((a, p) => a + p.latitud, 0) / points.length) * (Math.PI / 180);
  const k = 111_320;
  return points.map((p) => ({ x: p.longitud * k * Math.cos(lat0), y: p.latitud * k }));
}

function distanciaSegmento(p: Xy, a: Xy, b: Xy): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Douglas-Peucker sobre el tramo [inicio, fin] (índices de `xy`); marca en `keep` los vértices conservados. */
function dp(xy: Xy[], inicio: number, fin: number, tol: number, keep: boolean[]) {
  const pila: [number, number][] = [[inicio, fin]];
  while (pila.length) {
    const [i, j] = pila.pop()!;
    let max = -1,
      idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distanciaSegmento(xy[k], xy[i], xy[j]);
      if (d > max) {
        max = d;
        idx = k;
      }
    }
    if (idx >= 0 && max > tol) {
      keep[idx] = true;
      pila.push([i, idx], [idx, j]);
    }
  }
}

/** Simplifica un anillo cerrado (sin repetir el primer punto) con una tolerancia en metros. */
export function simplificarConTolerancia(points: PuntoDto[], toleranciaM: number): PuntoDto[] {
  if (points.length <= 3) return points.map((p) => ({ ...p }));
  const xy = proyectar(points);
  // Se parte el anillo en el vértice 0 y el más lejano a él para que ambos queden fijos.
  let lejano = 1;
  for (let k = 1; k < xy.length; k++)
    if (Math.hypot(xy[k].x - xy[0].x, xy[k].y - xy[0].y) > Math.hypot(xy[lejano].x - xy[0].x, xy[lejano].y - xy[0].y))
      lejano = k;
  const cerrado = [...xy, xy[0]];
  const keep = new Array(cerrado.length).fill(false);
  keep[0] = keep[lejano] = keep[cerrado.length - 1] = true;
  dp(cerrado, 0, lejano, toleranciaM, keep);
  dp(cerrado, lejano, cerrado.length - 1, toleranciaM, keep);
  const out = points.filter((_, i) => keep[i]).map((p) => ({ ...p }));
  return out.length >= 3 ? out : points.map((p) => ({ ...p }));
}

/**
 * Reduce el contorno a `max` vértices o menos conservando la forma y sin crear cruces.
 * Si no puede simplificarlo sin invalidar el polígono, devuelve el original.
 */
export function simplificarPoligono(points: PuntoDto[], max = MAX_VERTICES_ZONA): PuntoDto[] {
  if (points.length <= max) return points.map((p) => ({ ...p }));
  // Búsqueda binaria de la menor tolerancia que deja <= max vértices.
  let lo = 0,
    hi = 1;
  while (simplificarConTolerancia(points, hi).length > max && hi < 1e6) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (simplificarConTolerancia(points, mid).length > max) lo = mid;
    else hi = mid;
  }
  // Si el resultado se cruza, se relaja la tolerancia (más vértices) hasta que sea válido.
  for (let tol = hi; tol > 0.01; tol /= 1.5) {
    const candidato = simplificarConTolerancia(points, tol);
    if (!zoneGeometryError(candidato)) return candidato;
  }
  return points.map((p) => ({ ...p }));
}

/** Distancia aproximada en km entre dos puntos (Haversine). */
export function distanciaKm(a: PuntoDto, b: PuntoDto): number {
  const r = Math.PI / 180;
  const dLat = (b.latitud - a.latitud) * r,
    dLng = (b.longitud - a.longitud) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitud * r) * Math.cos(b.latitud * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

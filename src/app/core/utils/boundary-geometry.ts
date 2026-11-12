import type { Geometry } from 'geojson';
import { PuntoDto } from '../models/logistica.models';
import { zoneGeometryError } from './zone-geometry';

export const MAX_IMPORTED_VERTICES = 1000;

export function validAreaGeometry(geometry: Geometry | null): boolean {
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return (
    polygons.length > 0 &&
    polygons.every(
      (polygon) =>
        polygon.length > 0 &&
        polygon.every(
          (ring) =>
            ring.length >= 4 &&
            ring.every(
              (p) =>
                p.length >= 2 &&
                Number.isFinite(p[0]) &&
                Number.isFinite(p[1]) &&
                Math.abs(p[0]) <= 180 &&
                Math.abs(p[1]) <= 90,
            ) &&
            ring[0][0] === ring[ring.length - 1][0] &&
            ring[0][1] === ring[ring.length - 1][1],
        ),
    )
  );
}

export function editableBoundary(geometry: Geometry | null): {
  points: PuntoDto[] | null;
  reason: string;
} {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type))
    return {
      points: null,
      reason:
        'Este lugar no tiene un contorno de área disponible. Puedes dibujar la zona manualmente.',
    };
  if (geometry.type === 'MultiPolygon')
    return {
      points: null,
      reason:
        'El lugar contiene varias áreas. Puedes verlas, pero el backend actual solo guarda un polígono sencillo. No se importará una parte de forma automática.',
    };
  if (geometry.type !== 'Polygon') return { points: null, reason: 'Geometría no compatible.' };
  if (geometry.coordinates.length !== 1)
    return {
      points: null,
      reason:
        'El contorno contiene huecos interiores. El backend actual no permite guardarlos; la vista previa los conserva.',
    };
  const ring = geometry.coordinates[0];
  if (
    !ring ||
    ring.length < 4 ||
    ring.some((p) => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))
  )
    return { points: null, reason: 'El proveedor devolvió un contorno incompleto o no válido.' };
  const first = ring[0],
    last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1])
    return {
      points: null,
      reason: 'El contorno recibido no está cerrado. No se modificó el dibujo.',
    };
  if (ring.length - 1 > MAX_IMPORTED_VERTICES)
    return {
      points: null,
      reason: `El contorno tiene ${ring.length - 1} vértices y supera el límite de edición de ${MAX_IMPORTED_VERTICES}. No se simplifica automáticamente; puedes dibujar una zona más pequeña.`,
    };
  const points = ring.slice(0, -1).map(([longitud, latitud]) => ({ latitud, longitud }));
  const error = zoneGeometryError(points);
  return error ? { points: null, reason: error } : { points, reason: '' };
}

import { PuntoDto } from '../models/logistica.models';

const cross = (a: PuntoDto, b: PuntoDto, c: PuntoDto) =>
  (b.longitud - a.longitud) * (c.latitud - a.latitud) -
  (b.latitud - a.latitud) * (c.longitud - a.longitud);
const onSegment = (a: PuntoDto, b: PuntoDto, p: PuntoDto) =>
  Math.abs(cross(a, b, p)) < 1e-12 &&
  p.longitud >= Math.min(a.longitud, b.longitud) - 1e-12 &&
  p.longitud <= Math.max(a.longitud, b.longitud) + 1e-12 &&
  p.latitud >= Math.min(a.latitud, b.latitud) - 1e-12 &&
  p.latitud <= Math.max(a.latitud, b.latitud) + 1e-12;
function intersects(a: PuntoDto, b: PuntoDto, c: PuntoDto, d: PuntoDto) {
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  return (
    (abC * abD < 0 && cdA * cdB < 0) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
export function zoneGeometryError(points: PuntoDto[]): string {
  if (points.length < 3)
    return 'Marca al menos tres puntos válidos en el mapa para definir la zona.';
  if (
    points.some(
      (p) =>
        !Number.isFinite(p.latitud) ||
        !Number.isFinite(p.longitud) ||
        Math.abs(p.latitud) > 90 ||
        Math.abs(p.longitud) > 180,
    )
  )
    return 'El contorno contiene una ubicación no válida.';
  if (new Set(points.map((p) => `${p.latitud},${p.longitud}`)).size !== points.length)
    return 'No repitas vértices. El contorno se cierra automáticamente.';
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (
        intersects(
          points[i],
          points[(i + 1) % points.length],
          points[j],
          points[(j + 1) % points.length],
        )
      )
        return 'Los bordes de la zona se cruzan o se tocan. Ajusta los vértices para formar un contorno simple.';
    }
  const origin = points[0];
  const area = points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length];
    return (
      sum +
      (a.longitud - origin.longitud) * (b.latitud - origin.latitud) -
      (b.longitud - origin.longitud) * (a.latitud - origin.latitud)
    );
  }, 0);
  if (Math.abs(area) < 1e-12)
    return 'Los puntos están alineados o no delimitan un área. Ajusta el contorno.';
  return '';
}

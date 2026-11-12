import { PuntoDto, ZonaDto } from '../models/logistica.models';
import { zoneForPoint } from './presentation';

export function distanceMiles(origin: PuntoDto, destination: PuntoDto): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat = radians(destination.latitud - origin.latitud),
    lon = radians(destination.longitud - origin.longitud);
  const a =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(origin.latitud)) *
      Math.cos(radians(destination.latitud)) *
      Math.sin(lon / 2) ** 2;
  return (
    (6371008.8 *
      2 *
      Math.atan2(Math.sqrt(Math.min(1, Math.max(0, a))), Math.sqrt(Math.max(0, 1 - a)))) /
    1609.344
  );
}

export function deliveryCoverage(point: PuntoDto | null, zones: ZonaDto[], shop: PuntoDto | null) {
  const valid =
    point &&
    Number.isFinite(point.latitud) &&
    Number.isFinite(point.longitud) &&
    Math.abs(point.latitud) <= 90 &&
    Math.abs(point.longitud) <= 180;
  const zone = valid ? zoneForPoint(point, zones) : undefined;
  const miles = valid && shop ? distanceMiles(shop, point) : null;
  const message = !point
    ? 'Selecciona el punto de entrega antes de guardar.'
    : !valid
      ? 'Selecciona una ubicación válida en el mapa.'
      : zone
        ? `Punto dentro de la zona de cobertura «${zone.nombre}».`
        : miles != null
          ? `Este punto está a ${miles.toFixed(2)} mi de la tienda, fuera del área de cobertura real. Por favor elige otro punto más cercano.`
          : 'Este punto está fuera del área de cobertura real. Por favor elige otro punto más cercano. Configura la ubicación del local en Zonas para calcular la distancia a la tienda.';
  return { covered: !!zone, zone, miles, message };
}

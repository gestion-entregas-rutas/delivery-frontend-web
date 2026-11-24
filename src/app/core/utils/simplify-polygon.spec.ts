import { simplificarPoligono, distanciaKm } from './simplify-polygon';
import { zoneGeometryError } from './zone-geometry';
import { PuntoDto } from '../models/logistica.models';

/** Círculo de ~3 km de radio con ruido pequeño, como un contorno de OpenStreetMap. */
function contornoDenso(n: number): PuntoDto[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    const ruido = i % 2 ? 0.00005 : -0.00005;
    return { latitud: -1.27 + 0.027 * Math.sin(a) + ruido, longitud: -78.63 + 0.027 * Math.cos(a) };
  });
}

describe('simplificarPoligono', () => {
  it('reduce un contorno denso a 60 vértices o menos sin crear cruces', () => {
    const original = contornoDenso(351);
    const simple = simplificarPoligono(original);
    expect(simple.length).toBeLessThanOrEqual(60);
    expect(simple.length).toBeGreaterThanOrEqual(3);
    expect(zoneGeometryError(simple)).toBe('');
    // Ningún vértice nuevo: todos pertenecen al original.
    for (const p of simple) expect(original).toContainEqual(p);
  });

  it('conserva la forma: ningún vértice original queda lejos del contorno simplificado', () => {
    const original = contornoDenso(351);
    const simple = simplificarPoligono(original);
    const masCercano = (p: PuntoDto) => Math.min(...simple.map((q) => distanciaKm(p, q)));
    expect(Math.max(...original.map(masCercano))).toBeLessThan(0.5);
  });

  it('no toca contornos que ya son pequeños y no muta la entrada', () => {
    const tri: PuntoDto[] = [
      { latitud: -2.18, longitud: -79.9 },
      { latitud: -2.19, longitud: -79.88 },
      { latitud: -2.2, longitud: -79.9 },
    ];
    const copia = JSON.parse(JSON.stringify(tri));
    expect(simplificarPoligono(tri)).toEqual(tri);
    expect(tri).toEqual(copia);
  });
});

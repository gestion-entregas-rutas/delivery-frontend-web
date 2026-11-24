import type * as Leaflet from 'leaflet';

/**
 * Carga Leaflet de forma diferida y devuelve siempre el objeto `L`.
 *
 * Leaflet se publica como UMD/CommonJS. En `ng serve` el import dinámico entrega el
 * objeto con `map`, `marker`, etc.; en el build de producción puede llegar envuelto
 * en `default` (`{ default: L }`), y entonces `L.map` no es una función. Esta función
 * acepta ambas formas.
 */
export async function cargarLeaflet(): Promise<typeof Leaflet> {
  const mod = (await import('leaflet')) as unknown as typeof Leaflet & { default?: typeof Leaflet };
  const L = typeof mod.map === 'function' ? mod : mod.default;
  if (!L || typeof L.map !== 'function') throw new Error('No se pudo cargar la librería de mapas (Leaflet).');
  return L;
}

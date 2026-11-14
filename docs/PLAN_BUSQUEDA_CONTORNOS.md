# Plan aplicado: buscar un lugar y utilizar su contorno como zona

## Objetivo y alcance

En el formulario de creación o edición de zonas, buscar un lugar por nombre, visualizar su contorno de OpenStreetMap y, cuando el contrato lo permite, convertirlo en un dibujo editable. Mantener las páginas y estilos aprobados, la configuración del local y el dibujo manual.

## Plan y estado

1. **Completado — identificar el lugar.** Se conserva el tipo e id OSM del resultado de Photon. La consulta ocurre al pulsar Buscar; escribir no dispara búsquedas.
2. **Completado — consultar la geometría.** Se consulta por GET el elemento exacto en Overpass y se convierte su respuesta JSON a GeoJSON con osmtogeojson, cargado de forma diferida.
3. **Completado — mostrar una vista previa.** Se dibuja una capa diferenciada, manteniendo el polígono editable actual. Se informa cuando no hay área, la respuesta está incompleta o el servicio falla.
4. **Completado — aplicar explícitamente.** «Usar este contorno como zona» importa un único anillo exterior válido. Si ya hay dibujo, exige marcar la confirmación de reemplazo. Se puede recuperar el dibujo anterior a la importación.
5. **Completado — conservar el contrato.** GeoJSON usa longitud/latitud y repite el inicio al cerrar; el editor convierte a latitud/longitud y elimina solo el cierre. No redondea coordenadas ni guarda hasta confirmar el formulario de zona.
6. **Completado — validar límites y concurrencia de consultas.** Se cancelan consultas al cambiar la búsqueda, editar manualmente o cerrar el formulario. Se bloquean importaciones durante el guardado y se mantiene el dibujo ante cualquier fallo.
7. **Verificación automatizada y de contrato.** Se prueban conversión, caché, resultados sin contorno, geometrías incompatibles, límites, confirmación de reemplazo, restauración, cancelación y rate limiting. Se conserva el comprobador de diseño. La comprobación visual final en navegador con las zonas reales sigue pendiente.

## Reglas de importación

- Se importan polígonos sencillos sin huecos, cerrados, con coordenadas válidas y sin cruces.
- Se muestran las geometrías MultiPolygon y los huecos en la vista previa, pero no se convierten silenciosamente en una sola zona. El contrato actual no permite representarlas íntegramente.
- El límite de importación es 1000 vértices para mantener utilizable la edición de marcadores y la validación geométrica del navegador. Un contorno mayor se puede visualizar, pero no se simplifica ni se recorta automáticamente. El administrador puede dibujar una zona más pequeña.
- Importar el contorno no modifica su nombre ni capacidad automáticamente; se revisan en el formulario. «Guardar zona» usa los endpoints existentes y sus validaciones.
- Un límite administrativo de OSM no equivale necesariamente al área comercial de reparto ni es una certificación oficial. Debe revisarse antes de guardar.

## Servicios externos y configuración

- Photon busca el nombre; solo recibe el texto de búsqueda, sin contactos de pedidos. `GEOCODING_URL` permite sustituir su instancia.
- Overpass recibe únicamente el tipo e id OSM, no el texto de búsqueda, credenciales ni la ubicación del local. `OVERPASS_URL` permite sustituirlo por una instancia o proxy compatible.
- Las consultas son explícitas, sin búsqueda automática al escribir, sin reintentos automáticos y sin extracción masiva. Se utiliza caché en memoria de hasta 30 resultados durante 15 minutos y una separación mínima de dos segundos entre consultas de contornos.
- Ante 429 se respeta Retry-After y un mínimo de 60 segundos antes de otra consulta. Los errores no destruyen el dibujo. El usuario puede reintentar manualmente o dibujar.
- La consulta declara 20 segundos y 32 MiB como límites en Overpass; el cliente cancela a los 45 segundos. La instancia pública puede estar ocupada o no disponible. Para producción, acordar una instancia/proxy y caché compartida adecuados al uso.
- No se utiliza el servidor público de Nominatim. Se mantiene la atribución OpenStreetMap en el mapa.

Referencias: [Overpass: uso compartido y cuotas](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html), [geometrías OSM](https://dev.overpass-api.de/overpass-doc/en/full_data/osm_types.html), [osmtogeojson](https://github.com/tyrasd/osmtogeojson).

## Verificación real y límites pendientes

Resultado final: 73 pruebas aprobadas en 10 archivos; compilación de producción y comprobación TypeScript correctas. Se conservan las 7 hojas de estilo y las clases originales de las 16 plantillas aprobadas.

Se comprobó una búsqueda pública de Guayaquil en Photon y se obtuvo la relación OSM 2403848 desde Overpass por GET: 32 miembros, 31 vías exteriores y ningún miembro interior. Esta prueba confirma acceso y forma de respuesta; no sustituye la revisión visual en navegador ni una escritura autenticada de una zona.

La instalación del conversor introducía una versión antigua de xmldom; se fijó su dependencia a 0.9.12 y se mantuvo minimist 1.2.8 mediante overrides acotados. No se hizo una actualización general de Angular ni de las dependencias ajenas a este cambio.

## Retroalimentación para backend

La importación de un polígono sencillo utiliza el contrato actual de zonas; no requiere un endpoint nuevo. Para guardar un lugar completo con islas o huecos se necesita acordar geometría GeoJSON Polygon/MultiPolygon en lectura y escritura, validación topológica y reglas de inclusión de pedidos. No se envían propuestas de geometría compleja al contrato actual. Sigue pendiente también la persistencia compartida de la ubicación del local descrita en `ZONAS_Y_LOCAL.md`.

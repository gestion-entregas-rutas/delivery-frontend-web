# Estado de integración web · OpenAPI 1.1.0

## Contrato comprobado

Se revisó `ENTREGA_FRONTEND_WEB.md` y se obtuvo el OpenAPI desde `http://localhost:5289/openapi/v1.json`, que informa versión 1.1.0. La instantánea actual está en `openapi-integracion.json`. El archivo adjunto `contratos/openapi-1.1.0.json` y `Ampliaciones_Backend_Integracion.md` enlazados en la entrega no se encontraron en este repositorio; la integración se contrastó con el servidor local disponible.

## Cambios integrados sin rediseñar las páginas

| Área | Implementación web |
| --- | --- |
| Pedido | Los campos clienteNombre/clienteTelefono se envían como destinatario. Remitente, sus correos, observaciones, carga, peso en kg, fragilidad y prioridad se guardan en detalles. Los nulos históricos se muestran como no informados. |
| Formulario | Se habilitaron los campos existentes respaldados por el contrato y se añadieron los controles faltantes usando la paleta y estilos presentes. Los tipos enviados son General, Documento, Alimentos, Medicamentos y Otro; no se inventan categorías fuera del contrato. |
| Edición | Se consulta el pedido antes de abrir el mismo panel lateral. Solo Pendiente con versión disponible; PUT completo preservando detalles. Ante 409 se consulta el estado actual, se conserva el formulario y se exige recargar antes de otro envío. Editar no promete asignación automática. |
| Listado y resumen | Fecha exacta o rango inclusivo, búsqueda textual, estado y zona se envían al servidor. El resumen usa los mismos filtros sin paginación. Los indicadores proceden del agregado y no de las 50 filas cargadas. |
| Porcentaje entregado | Se usa el porcentaje del servidor sobre pedidos no cancelados. Se identifica como porcentaje de entrega, sin presentarlo como SLA ni puntualidad. Los contadores de categorías sin un agregado aplicable muestran un guion en lugar de un total inventado. |
| GPS | Carga REST por fecha y evento directo UbicacionRepartidorActualizada. Se conserva una muestra por repartidor, se ignoran capturas anteriores o iguales y se filtra por ruta/zona. Se recupera REST al reconectar y se limpian posiciones al cambiar de fecha/cerrar sesión. |
| Antigüedad GPS | Marcadores y listado muestran captura, precisión y estado reciente/última ubicación conocida. La antigüedad se recalcula cada 30 segundos usando el umbral de dos minutos. Al terminar una ruta no se presenta la última posición como presencia actual. |
| Transferencia | Arrastrar una parada asignada a otra ruta abre la confirmación existente. Se ejecuta una sola llamada de transferencia con las dos versiones; no se combina retirada y alta. Ante 409 se recargan pedido y rutas y se exige seleccionar/confirmar otra vez. También se puede abrir desde el detalle de ruta. |
| Orden | Desde el detalle de ruta se abre «Ordenar paradas». Se revisa la secuencia con subir/bajar y se confirma el conjunto completo de ids de pedidos más versión. Se bloquea el prefijo iniciado; el servidor realiza la validación definitiva. |
| Errores | Los formularios conservan los cambios rechazados; se muestran errores y traceId cuando se recibe. No hay reintento automático de escrituras. |

Se mantiene retirado el bloque duplicado «Pedidos recientes» del Resumen. La gestión continúa en la página Pedidos.

El listado y los agregados pueden abarcar un rango de fechas. El mapa, rutas y GPS mantienen el alcance de la fecha operativa seleccionada, indicado en la interfaz. La búsqueda no promete encontrar UUID: se respeta el alcance textual descrito por el backend.

## Capacidades que siguen pendientes

- Borradores, vehículos, placa, fotografía y batería.
- ETA, distancias por calles, geometría vial, tráfico e historial GPS.
- Ventanas horarias, SLA, riesgo y retraso.
- Selección de algoritmos, rebalanceo global, mapa de demanda y emisiones.
- Exportación masiva e idempotencia de los POST antiguos.

Estos controles continúan deshabilitados o identificados como no disponibles. Peso, fragilidad y prioridad son informativos y no modifican la capacidad.

## Validación y siguiente paso conjunto

La conservación estructural del diseño se comprueba con `node scripts/verificar-diseno.mjs`: hojas de estilo sin cambios y clases originales preservadas. No equivale a una inspección visual en navegador.

Las pruebas automatizadas cubren DTO y preservación de detalles, nulos, validación de peso/remitente, conflicto de edición, filtros compartidos, agregados independientes de la página, GPS atrasado/caducidad, transferencia atómica, doble clic, conflictos de transferencia y prefijo fijo al reordenar. También se comprueba la entrega directa del evento GPS y la resuscripción/recarga al reconectar.

Resultado: 51 pruebas aprobadas en 8 archivos; compilación Angular de producción y verificación TypeScript correctas. La comprobación del diseño conserva las 7 hojas de estilo y las clases originales de las 16 plantillas.

Se consultó el contrato local; no se hicieron escrituras autenticadas en la base de datos ni publicaciones GPS desde un dispositivo. Falta ejecutar con un administrador y conductor de pruebas: registro/edición, transferencia entre dos rutas, conflicto entre dos sesiones, reordenamiento en curso y GPS real con pérdida/reconexión de señal. Se requiere también revisar visualmente las pantallas en navegador con datos representativos antes de liberar.

## Mensaje para el equipo de backend

Integramos la entrega 1.1.0 en el panel manteniendo los diseños aprobados: detalles del pedido, edición con versión, filtros y resumen del servidor, GPS REST/SignalR, transferencia atómica y reordenamiento completo. Los elementos expresamente pendientes siguen identificados. Solicitamos adjuntar los dos archivos de contrato referenciados que no llegaron al repositorio y coordinar la validación con un administrador y un conductor de pruebas que publique GPS. La exportación actual mantiene su alcance de registros cargados y no se presentan ETA, SLA ni recorrido vial como información disponible.

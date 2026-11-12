# Integración de los diseños aprobados con el backend

> Documento histórico de solicitudes iniciales. El backend respondió mediante `ENTREGA_FRONTEND_WEB.md` (OpenAPI 1.1.0). Consultar [el estado actualizado de la integración](ESTADO_INTEGRACION_1.1.0.md): detalles, edición, agregados, GPS, transferencia y reordenamiento ya cuentan con contrato y se integraron en la web. Las tablas siguientes conservan el diagnóstico previo a esa entrega.

## Alcance realizado

Se conservaron las hojas de estilo y las clases visuales de las plantillas aprobadas. Las páginas Resumen, Pedidos, Rutas y Zonas/Repartidores consumen los servicios existentes. Se añadieron únicamente controles necesarios para ejecutar las operaciones y consultar detalles.

- Pedidos: registro con dirección y selección en mapa, fecha y hora; filtros, paginación, detalle y transiciones permitidas por estado.
- Rutas: armado real, lectura de paradas ordenadas, inicio/cancelación y asignación manual con confirmación. Arrastrar un pedido abre la confirmación de asignación.
- Zonas: consulta, alta y edición con polígono interactivo. Repartidores: consulta, alta y disponibilidad respetando el estado EnRuta.
- Resumen: manifiesto y mapa de destinos reales, filtros y exportación CSV de los registros cargados.
- Se mantiene autenticación JWT, autorización administrativa, cambio obligatorio de credenciales temporales y seguimiento SignalR por fecha.

No se muestran registros de demostración ni se confirma una operación antes de recibir éxito del servidor. Un conflicto no provoca un reintento automático de escritura. Las líneas entre destinos son referencias geométricas; no representan calles ni ubicación GPS del repartidor.

## Contrato existente aprovechado

La instantánea `openapi-integracion.json` se obtuvo de `http://localhost:5289/openapi/v1.json`. La API expone 29 operaciones, incluidas autenticación y usuarios. No se requieren nuevos endpoints para las operaciones básicas ya disponibles.

| Contrato | Uso en el panel |
| --- | --- |
| RegistrarPedidoRequest | clienteNombre, clienteTelefono, direccion, latitud, longitud, fechaEntrega, horaEntrega y zonaId opcional. Las coordenadas se obtienen del mapa. |
| RegistroPedidoDto | Se interpreta pedido y asignacion: RutaExistente, RutaNueva o EnEspera. EnEspera es un registro exitoso pendiente de asignación. Una asignación nula también es válida para pedidos futuros. |
| PedidoDto | Se aprovechan estado, rutaId, zonaId, registradoEn y entregadoEn, además de contacto y destino. |
| RutaDto | Se usan fecha, zonaId, repartidorId, capacidad, estado y paradas ordenadas. |
| ArmarRutas | Se envían fecha y zonaId opcional. Se presentan rutas y pedidosSinAsignar reales; cero rutas es un resultado válido. |
| RepartidorDto | Se muestran nombre, teléfono, capacidadMaxima y estado. EnRuta impide el cambio manual de disponibilidad. |
| ZonaDto | Se utiliza poligono, maxPedidosPorRuta y activa. Se envían al menos tres vértices sin repetir el primero al final. |

La validación definitiva de capacidad, fecha, zona y transiciones pertenece al backend. La elegibilidad mostrada antes de confirmar es orientativa y puede cambiar por concurrencia.

## Información del diseño todavía no disponible

Los siguientes puntos son propuestas de ampliación; no forman parte del contrato actual. Los controles sin soporte permanecen deshabilitados o indican «No informado».

| Prioridad | Necesidad | Contrato a acordar |
| --- | --- | --- |
| Alta | Remitente y destinatario separados, correo, observaciones y carga | Definir campos, obligatoriedad, límites, tipo de carga, peso y su unidad, fragilidad y prioridad. Incluirlos tanto en escritura como en lectura. Actualmente existe un único cliente/contacto. |
| Alta | Edición y borradores de pedidos | Endpoint de actualización con campos y estados editables; contrato independiente para borradores si se mantiene ese control. |
| Alta | Indicadores del resumen y filtros generales | Agregados por fecha/zona/estado y búsqueda/rango de fechas en servidor. Definir población y denominadores. Hoy los contadores derivados y el CSV describen los registros cargados; el total de pedidos proviene de la API paginada. |
| Alta | GPS de repartidores | Lectura inicial REST y evento SignalR con repartidorId, rutaId si aplica, latitud, longitud, instante UTC con offset y precisión en metros. Acordar frecuencia, permisos, caducidad y tratamiento de posiciones antiguas. Requiere también publicación desde la aplicación móvil. |
| Media | Vehículo y telemetría | Modelo para tipo de vehículo, placa, foto y batería con unidad y fecha de medición. No inferir estos datos a partir del estado operativo. |
| Media | ETA, distancia y recorrido por calles | Proveedor o servicio de ruteo; geometría, distancia en metros, duración en segundos, ETA y fecha de cálculo. Definir cuándo se recalcula. |
| Media | SLA y ventanas horarias | HoraEntrega es una hora única. Para intervalos, acordar inicio/fin y zona horaria. Definir qué significa cumplimiento, riesgo y retraso, y sus agregados. |
| Media | Parámetros de optimización y rebalanceo global | ArmarRutas recibe únicamente fecha/zonaId. Acordar algoritmos permitidos, parámetros, restricciones y resultado del rebalanceo antes de habilitar los controles del diseño. |
| Media | Transferencia y reordenamiento de paradas | Operación atómica con validación de capacidad/estado y control de versión. No simular una transferencia con DELETE seguido de POST, porque puede quedar incompleta. |
| Media | Concurrencia y reintentos | Acordar versión/ETag e idempotencia para registro, asignación y armado. El cliente actual evita doble clic y no reintenta automáticamente escrituras fallidas. |
| Baja | Mapa de demanda y emisiones | Definir granularidad espacial/temporal, fórmula, unidades y fuente de datos. No hay información suficiente para calcularlos desde el frontend. |

## Acuerdos y documentación

1. Confirmar nombres, nulabilidad, enumeraciones, reglas y ejemplos de los nuevos DTO antes de implementarlos. Versionar el OpenAPI y compartir ejemplos de errores 400/401/403/409/422 con traceId.
2. Actualizar `docs/README.md`: sus instrucciones de acceso anónimo fueron sustituidas por `Autenticacion_JWT_Integracion.md`. No existe un contrato de refresh token; el panel no lo presupone.
3. Los eventos actuales PedidoActualizado y RutaActualizada permiten recargar la operación. El evento GPS y su canal aún necesitan definición e implementación; una propuesta escrita no equivale a un endpoint disponible.
4. La búsqueda de direcciones usa un proveedor configurable compatible con Photon y permite selección manual si falla. Para producción se debe acordar una instancia/proveedor con disponibilidad y límites adecuados; no es un bloqueo para registrar mediante el mapa.

## Validación y límites

La integración tiene pruebas automatizadas de DTO, errores, doble envío, asignación, conflictos y resultados sin rutas. Se conserva una línea base de estilos y clases en `diseno-aprobado.baseline.json`, verificable con `node scripts/verificar-diseno.mjs`. Esa verificación estructural no sustituye una revisión visual en navegador.

Se consultó el OpenAPI local sin modificar datos. No se efectuaron escrituras autenticadas contra la base de datos ni una prueba integral con credenciales reales. Antes de liberar, realizar conjuntamente los flujos con un administrador de pruebas, SignalR y datos representativos.

## Conclusión para enviar al equipo de backend

El panel conserva los diseños aprobados e integra las operaciones existentes de pedidos, rutas, repartidores, zonas y autenticación. Ya utiliza los estados, capacidades, paradas y marcas de registro/entrega del contrato. Para completar todos los elementos visuales necesitamos acordar principalmente datos ampliados del pedido, edición/borradores, agregados del resumen y seguimiento GPS. ETA, SLA, vehículos, ventanas horarias, algoritmos y rebalanceo también requieren contratos explícitos. Solicitamos confirmar prioridades y entregar DTO, reglas, OpenAPI y ejemplos de respuesta/error para cada ampliación. Mientras tanto, el frontend identifica los datos no disponibles y no muestra información simulada.

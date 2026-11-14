# Contexto del proyecto · Panel administrativo Delivery

**Actualizado:** 13 de noviembre de 2026.  
**Repositorio:** `frontend-web`. **Rama observada:** `develop`.  
**Objetivo de este archivo:** permitir retomar el desarrollo conservando decisiones, funcionalidades y límites del trabajo realizado. Revisar el código y los contratos nuevos si el backend cambia después de esta fecha.

## Propósito y estado

Panel web administrativo de un sistema de gestión de entregas y rutas. Administra pedidos, zonas de reparto, repartidores, rutas y cuentas; representa destinos y posiciones GPS en mapas.

El frontend ya integra la entrega de backend documentada como OpenAPI 1.1.0. El trabajo más reciente se concentró en crear y editar zonas, importar contornos de lugares desde OpenStreetMap, configurar la referencia del local y verificar la cobertura cuando se registra un pedido.

El desarrollo de la aplicación móvil del conductor y la implementación del backend pertenecen a proyectos separados. Integración implementada en el frontend no significa validación integral de producción completada.

## Reglas que deben conservarse

1. **Los diseños existentes están aprobados.** El usuario corrigió expresamente cambios de diseño anteriores: se deben adaptar las funcionalidades al diseño aprobado. Conservar composición, paleta, tipografía y estilos; añadir controles necesarios de forma coherente.
2. No inventar pedidos, conductores, fotografías, vehículos, ETA, SLA, métricas ni posiciones GPS para completar espacios del diseño. Mostrar «No informado», un estado vacío o deshabilitar una acción sin contrato.
3. No pedir al administrador que escriba latitud y longitud. Direcciones y áreas se seleccionan visualmente en el mapa; las coordenadas se generan internamente.
4. No confirmar escrituras antes del éxito HTTP, no reintentar escrituras automáticamente ni simular una transferencia mediante retirada y alta separadas. Conservar el formulario ante errores.
5. El bloque duplicado **«Pedidos recientes» fue retirado del Resumen a petición del usuario**, porque aparecía sin el diseño esperado. La gestión continúa en Pedidos. No reincorporarlo automáticamente.
6. No borrar diseños, documentación ni cambios existentes del usuario al ordenar archivos. No modificar el backend desde este repositorio sin una instrucción y permisos que cubran ese trabajo.
7. Los controles de navegación y las validaciones del navegador ayudan a la operación; el backend conserva la autorización y validación definitivas.

## Tecnologías y ejecución

- Angular 22, componentes standalone, carga diferida por rutas y estado con signals.
- TypeScript 6, RxJS y formularios de Angular.
- Leaflet 1.9 y teselas OpenStreetMap.
- SignalR para eventos operativos y GPS.
- Tailwind CSS 4 y estilos compartidos existentes.
- Vitest con pruebas Angular y respuestas HTTP controladas.
- SSR e hidratación configurados; los mapas se inicializan en navegador y liberan recursos al destruirse.
- `osmtogeojson` se carga de forma diferida para convertir contornos OSM. `package.json` contiene overrides acotados para dependencias del conversor; conservarlos al actualizar y revisar su compatibilidad.

```powershell
npm install
npm start
```

Frontend de desarrollo: `http://localhost:4200`. La configuración actual del servidor es `http://localhost:5289`, mediante `LOGISTICA_SERVER_URL` en [app.config.ts](src/app/app.config.ts). La API se consume bajo `/api` y el hub bajo `/hubs/seguimiento`.

La disponibilidad actual del servidor no se comprobó al redactar este archivo. No hay credenciales predeterminadas que deban agregarse al frontend.

## Arquitectura y archivos principales

```text
src/app/
  app.routes.ts                Rutas y guards
  core/
    auth/                      Sesión, interceptor JWT y guards
    models/                    Contratos DTO y tipos de mapas/local
    services/                  HTTP, estado operativo, formularios y SignalR
    utils/                     Geometría, cobertura, distancias y marcadores
  layout/admin-layout/         Navegación y estructura administrativa
  pages/
    login/  credenciales/  usuarios/
    resumen/  pedidos/  rutas/  zonas/  repartidores/
  shared/components/           Mapas, selectores y diálogos reutilizables
src/styles/                    Paleta y estilos existentes
docs/                          Contratos, referencias visuales y entregas
scripts/verificar-diseno.mjs    Comprobación de estilos y clases originales
```

| Archivo o servicio | Responsabilidad |
| --- | --- |
| `core/models/logistica.models.ts` | Pedidos, detalles, zonas, repartidores, rutas, filtros, agregados, versiones y GPS. |
| `core/services/logistica-api.service.ts` | Transporte HTTP tipado de la operación. |
| `core/services/operations.service.ts` | Estado compartido, consultas, filtros, fecha, paginación, acciones y posiciones conocidas. |
| `core/services/operation-forms.service.ts` | Formularios compartidos de zonas, repartidores y referencia del local; la apertura de pedidos dirige a su panel lateral. |
| `core/services/seguimiento.service.ts` | Conexión autenticada al hub, suscripciones por fecha y recuperación al reconectar. |
| `core/services/route-assignment.service.ts` | Confirmación de asignación y transferencia atómica. |
| `core/services/route-order.service.ts` | Edición y confirmación del orden completo de paradas. |
| `core/services/pedido-detail.service.ts` | Consulta de detalle de un pedido. |
| `core/services/local-location.service.ts` | Referencia del local guardada en este navegador. |
| `core/services/address-search.service.ts` | Búsqueda explícita de direcciones y lugares mediante Photon. |
| `core/services/place-boundary.service.ts` | Consulta y caché de geometrías OSM mediante Overpass. |
| `shared/components/address-picker/` | Selección del destino o local; admite mostrar cobertura en Pedidos. |
| `shared/components/zone-map-picker/` | Dibujo, edición e importación de polígonos. |
| `shared/components/zone-coverage-map/` | Consulta visual de zonas registradas y referencia del local. |
| `shared/components/operations-map/` y `route-workspace/` | Destinos, líneas entre paradas y marcadores GPS. |

Las páginas componen la interfaz y coordinan servicios; mantener el transporte HTTP y el ciclo de conexión SignalR en `core/services`. Las utilidades de geometría deben conservarse independientes de la presentación.

## Funcionalidades implementadas

### Acceso y usuarios

- Login del administrador, restauración de sesión, expiración y cierre de sesión.
- Cambio obligatorio de credenciales temporales.
- JWT con rol `Administrador`; rutas operativas protegidas por guards.
- Interceptor Bearer limitado a la API configurada: no enviar el token a Photon, Overpass ni a los servidores de mapas.
- Gestión de cuentas administrativas y de conductor, activación/desactivación y restablecimiento de contraseña. Los conductores se vinculan a un repartidor.
- Sin refresh tokens; la sesión se conserva en `sessionStorage` por pestaña, con funcionamiento en memoria si el almacenamiento falla.

Rutas: `/login`, `/credenciales`, `/usuarios`, `/resumen`, `/pedidos`, `/rutas`, `/zonas` y `/repartidores`.

### Pedidos y resumen

- Registro en el panel lateral aprobado, dirección escrita y selección de punto en mapa.
- Destinatario obligatorio y detalles opcionales del remitente, correos, observaciones, tipo de carga, peso, fragilidad y prioridad.
- Búsqueda y filtros por estado, zona, fecha exacta o rango; paginación en servidor.
- Detalle con estado, ruta, programación, registro y entrega confirmada.
- Edición de pedidos pendientes mediante PUT completo y versión consultada. Ante 409 se mantienen los cambios locales y se exige recargar antes de guardar otra vez.
- Cancelación y avance de estados según las acciones permitidas por el backend.
- Indicadores del Resumen obtenidos de `/api/resumen/pedidos`, sobre todos los registros filtrados. El porcentaje entregado no se etiqueta como SLA.
- CSV del manifiesto con el alcance de los registros cargados; no es una exportación masiva.

### Rutas y repartidores

- Armado de rutas por fecha y zona, cupos reales, paradas ordenadas, inicio/cancelación y consulta de detalle.
- Agregar o retirar pedidos según estado y reglas de negocio.
- Arrastrar un pedido pendiente abre la confirmación de asignación. Arrastrar una parada asignada a otra ruta abre la confirmación de transferencia.
- Transferencia con una sola operación atómica y versiones de origen/destino.
- Reordenamiento con la lista completa de ids de pedidos y versión; el prefijo ya iniciado permanece fijo.
- Alta y consulta de repartidores y disponibilidad; no se cambia manualmente la disponibilidad de quien está `EnRuta`.

### Seguimiento GPS

- Carga REST inicial por fecha y evento directo `UbicacionRepartidorActualizada`.
- Un marcador por repartidor; capturas anteriores o iguales no sustituyen una más nueva.
- Hora de captura, precisión y distinción entre ubicación reciente y última conocida.
- Antigüedad recalculada cada 30 segundos; umbral de dos minutos, condicionado también por el estado de la ruta.
- Suscripción mediante `SuscribirseAFecha`, cancelación con `CancelarFecha` y nueva consulta REST después de reconectar.
- Eventos `PedidoActualizado` y `RutaActualizada` para actualizar la operación.
- Las posiciones dependen de que la aplicación del conductor publique GPS. Las líneas entre destinos son referencias geométricas, sin trazado vial ni historial del recorrido.

## Contrato e integración con backend

La referencia recibida es [ENTREGA_FRONTEND_WEB.md](docs/ENTREGA_FRONTEND_WEB.md), con instantánea OpenAPI en [openapi-integracion.json](docs/openapi-integracion.json), versión 1.1.0. En el desarrollo anterior se contrastó con el servidor local; no se debe asumir que esa instantánea incorpora cambios posteriores del equipo backend.

Reglas importantes para conservar compatibilidad:

- `clienteNombre` y `clienteTelefono` representan al **destinatario** en escritura. Los alias `destinatarioNombre`/`destinatarioTelefono` de lectura no los sustituyen.
- Remitente y atributos adicionales pertenecen a `detalles`; preservar los campos existentes en una edición completa.
- `fragil: null` significa no informado; no convertirlo a `false`.
- Peso en kilogramos: mayor que cero, máximo 10000 y hasta tres decimales. Peso, fragilidad y prioridad son informativos; la capacidad sigue siendo cantidad de pedidos.
- Registro devuelve `{ pedido, asignacion }`. `EnEspera` es éxito sin ruta y `asignacion: null` es válida para pedidos futuros. Editar la fecha no implica reasignación automática.
- `fechaEntrega` usa `YYYY-MM-DD` y `horaEntrega` usa `HH:mm:ss`. Evitar convertir una fecha local a UTC alterando su día.
- No combinar `fecha` con `desde`/`hasta`. Enviar los mismos filtros al listado y al agregado, omitiendo paginación en el resumen.
- Las versiones son opacas: reenviar las consultadas, sin incrementarlas manualmente. Conflictos 409 requieren revisar datos y nueva confirmación.
- En reordenamiento se envían ids de pedidos, no ids de paradas. El orden recibido empieza en 1; una posición de inserción empieza en 0.
- Conservar `traceId` de los errores cuando el backend lo devuelve. No afirmar éxito ante una respuesta incierta.

La documentación inicial pedía capacidades que después fueron implementadas por backend. No volver a solicitarlas como si faltaran: [RETROALIMENTACION_BACKEND.md](docs/RETROALIMENTACION_BACKEND.md) está identificado como histórico.

## Zonas, contornos y ubicación del local

### Creación y edición

- Nombre, capacidad entera por ruta y polígono con al menos tres vértices.
- Clic para agregar puntos, arrastre para ajustar, eliminación de vértice, inserción en un borde, deshacer último punto, limpiar y centrar.
- Validación de coordenadas, duplicados, área nula y bordes cruzados.
- Antes de editar se consulta la zona vigente; el formulario conserva el dibujo ante un rechazo.
- PUT completo de nombre, polígono, capacidad y estado `activa`. Para retirar cobertura se desactiva; no se implementó una eliminación permanente sin contrato.
- Selección sincronizada entre tarjeta y mapa, y pestañas de zonas/flota/ambos.

### Buscar un lugar e importar su contorno

Flujo: buscar nombre → elegir resultado → revisar vista previa → confirmar reemplazo si existe dibujo → usar contorno → ajustar vértices → guardar zona.

- Photon devuelve nombre y referencia OSM. Overpass consulta por GET el elemento exacto, con conversión a GeoJSON mediante `osmtogeojson`.
- La vista previa es independiente del dibujo y no guarda automáticamente. Se puede descartar o recuperar el dibujo anterior a la importación.
- Se importan únicamente polígonos sencillos sin huecos, válidos y de hasta **1000 vértices**.
- MultiPolygon, áreas con huecos y contornos demasiado detallados pueden visualizarse, pero no se recortan, aplanan ni simplifican silenciosamente para guardarlos.
- GeoJSON llega en longitud/latitud y con anillo cerrado; convertir a latitud/longitud y quitar solo el punto de cierre. El backend recibe `PuntoDto[]` sin repetir el primer vértice al final.
- Consultas explícitas al pulsar Buscar, sin autocompletado ni reintentos automáticos. Caché en memoria de hasta 30 resultados durante 15 minutos y separación mínima de dos segundos entre consultas de contornos.
- Ante 429 se respeta `Retry-After` y al menos 60 segundos de espera. El proveedor público puede fallar; el dibujo manual continúa disponible.
- Configuración: `GEOCODING_URL` para Photon y `OVERPASS_URL` para Overpass. No se utiliza el servidor público de Nominatim.

### Referencia del local

«Ubicar nuestro local» permite escribir una dirección, buscarla y ajustar un marcador, sin teclear coordenadas. El local aparece como referencia en los mapas de zonas y permite centrar el dibujo.

**Limitación vigente del contrato integrado:** la sede no cuenta con persistencia compartida en backend. Se guarda en `localStorage`, clave `delivery.local-location.v1`, solo en ese navegador. No se comparte entre administradores/equipos ni define por sí sola el origen de rutas del backend. No hay una dirección real predeterminada; el administrador debe configurarla.

El local puede estar fuera de las zonas de entrega. Su relación con los polígonos es orientativa y no crea una zona automáticamente.

## Cobertura al registrar pedidos

Este es el último cambio funcional solicitado por el usuario:

1. El mapa del formulario de Pedidos muestra todas las zonas activas, sombreadas, y el local cuando está configurado.
2. Se comprueba el punto seleccionado al buscar, hacer clic, arrastrar y cambiar la cobertura; se comprueba nuevamente al guardar.
3. Solo se admite un punto contenido en algún polígono activo. No se usa un radio arbitrario ni el rectángulo que engloba todas las zonas.
4. Fuera de cobertura se muestra, con distancia calculada para ese punto:

   > Este punto está a 16.10 mi de la tienda, fuera del área de cobertura real. Por favor elige otro punto más cercano.

5. El valor es distancia en línea recta desde el local, en millas y con dos decimales. No está fijado en 16.10 ni representa recorrido por calles.
6. El punto rechazado permanece visible para poder corregirlo. Se bloquea Guardar y también la acción directa de envío hasta elegir un punto cubierto.
7. Si falta el local, se informa que el punto está fuera de cobertura sin inventar distancia. Un punto cubierto puede registrarse aunque el local no esté configurado.
8. El selector del local conserva su funcionamiento independiente: no exige que el propio local esté dentro de una zona de entrega.

Implementación principal: `address-picker`, `pedidos.page.ts`, `core/utils/delivery-coverage.ts` y `core/utils/presentation.ts`. El criterio de inclusión está alineado con el ray casting del dominio de backend revisado durante la implementación; la API conserva la decisión definitiva.

## Verificación y límites de la evidencia

**Última verificación funcional registrada en la conversación:** 81 pruebas aprobadas en 11 archivos, compilación Angular y comprobación TypeScript correctas. Incluye autenticación, navegación, DTO, errores, concurrencia, geometría, importación de contornos, local, GPS y cobertura de pedidos. Es un resultado del desarrollo previo; no se reejecutó la batería al redactar este contexto.

**Comprobado al crear este archivo:** el verificador de diseño sigue pasando con 7 hojas de estilo intactas y clases originales conservadas en 16 plantillas. Esto permite controles adicionales; no demuestra igualdad visual en navegador ni sustituye una revisión de accesibilidad.

Comandos disponibles:

```powershell
npm run build
npm test -- --watch=false
node scripts/verificar-diseno.mjs
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters
git diff --check
```

La línea base se conserva en `docs/diseno-aprobado.baseline.json`. No regenerarla para ocultar un cambio de diseño no aprobado.

Hubo comprobaciones de OpenAPI y consultas externas reales de Photon/Overpass durante el trabajo anterior. No se realizaron escrituras autenticadas de pedidos/zonas contra la base de datos, ni publicación GPS desde un móvil, ni una revisión visual integral en navegador. No presentar las pruebas unitarias como evidencia de esos flujos completos.

## Pendientes y próximos pasos

1. Revisar visualmente el panel con un administrador de pruebas y datos representativos, conservando los diseños aprobados.
2. Probar conjuntamente registro/edición, errores, dos administradores modificando datos, transferencia y reordenamiento de rutas.
3. Validar GPS real del conductor, pérdida de conexión, resuscripción y caducidad de posiciones.
4. Acordar y recibir el contrato de sede/local compartido: una o varias sedes, permisos, versión, propagación y uso como origen/retorno de rutas. Sustituir la persistencia del navegador cuando exista.
5. Si se requiere importar lugares completos con huecos o áreas separadas, ampliar el contrato de zonas a una geometría que pueda representarlos y acordar su validación.
6. Definir proveedores/instancias y caché adecuados para producción de búsqueda, contornos y mapas.
7. Mantener identificadas como pendientes las capacidades sin contrato: borradores, vehículos/placas/fotos/batería, ETA, distancias viales, tráfico, ventanas horarias, SLA/riesgo/retraso, algoritmos configurables, rebalanceo global, demanda, emisiones, exportación masiva e idempotencia de los POST antiguos.

Los documentos de entrega enlazaban archivos adicionales que no llegaron al repositorio en la revisión anterior. Si el equipo envía nuevos contratos o amplía OpenAPI, revisarlos antes de decidir que una capacidad sigue faltando.

## Documentación de referencia

| Documento | Uso |
| --- | --- |
| [README.md](README.md) | Arranque y descripción general; contiene también texto histórico que debe contrastarse con este contexto y el código. |
| [ENTREGA_FRONTEND_WEB.md](docs/ENTREGA_FRONTEND_WEB.md) | Respuesta del equipo backend y contrato de ampliaciones 1.1.0. |
| [Autenticacion_JWT_Integracion.md](docs/Autenticacion_JWT_Integracion.md) | Autenticación y autorización vigentes respecto de la documentación inicial. |
| [ESTADO_INTEGRACION_1.1.0.md](docs/ESTADO_INTEGRACION_1.1.0.md) | Integración de ampliaciones y validación conjunta pendiente. |
| [ZONAS_Y_LOCAL.md](docs/ZONAS_Y_LOCAL.md) | Zonas, referencia del local, cobertura y solicitudes concretas a backend. |
| [PLAN_BUSQUEDA_CONTORNOS.md](docs/PLAN_BUSQUEDA_CONTORNOS.md) | Plan aplicado, proveedores y límites de importación de contornos. |
| [RETROALIMENTACION_BACKEND.md](docs/RETROALIMENTACION_BACKEND.md) | Diagnóstico histórico inicial; varias solicitudes ya se resolvieron en 1.1.0. |
| [openapi-integracion.json](docs/openapi-integracion.json) | Instantánea del contrato que se contrastó durante la integración. |

Las referencias visuales se conservan en `docs/`, entre ellas `CentroControlDespacho.html`, `Armadooptimizacion.html`, `disenoRegistroPedido.html` y `DiseoZonaGeografica.html`.

Advertencias de contexto documental: `docs/README.md` y `docs/verificar-api.mjs` contienen referencias anteriores a JWT; no usarlas como pruebas actuales de acceso anónimo. El README raíz aún describe componentes antiguos como `orders-table`; eso no autoriza a recuperar el bloque retirado del Resumen. Los números de pruebas de documentos anteriores corresponden a su etapa, no al último resultado registrado.

## Cómo retomar el trabajo

1. Leer este archivo y la última petición del usuario; mantener su alcance y las decisiones visuales.
2. Revisar `git status` y las instrucciones locales si aparecen; conservar trabajo existente y evitar limpiezas o restauraciones generales.
3. Consultar el documento específico de la funcionalidad y comprobar modelos/servicios antes de modificar pantallas.
4. Si hay una entrega nueva del backend, contrastar campos, reglas, nulabilidad, estados y endpoints con el frontend; distinguir lo disponible de lo propuesto.
5. Implementar en la capa correspondiente y ejecutar verificaciones proporcionales al cambio. Registrar qué se probó realmente y qué requiere entorno o dispositivos.
6. Actualizar este contexto cuando cambien contratos, persistencia del local, capacidades de mapas o reglas importantes.

Al iniciar esta actualización solo se observó `package-lock.json` modificado en el árbol de trabajo. Este dato es una instantánea, no una autorización para revertirlo. La creación de este contexto no cambia funcionalidad ni configura servicios externos.

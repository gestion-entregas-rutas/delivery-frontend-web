# Delivery · Panel administrativo

Aplicación Angular con Leaflet y OpenStreetMap, basada en los contratos de `docs/`.

## Ejecutar

```powershell
npm install
npm start
```

Abrir http://localhost:4200. El backend debe estar disponible en http://localhost:5289 con PostgreSQL/PostGIS y migraciones configurados según `docs/README.md`.

La URL REST se configura mediante `LOGISTICA_SERVER_URL` en `src/app/app.config.ts`. El hub SignalR usa la misma URL base mediante `LOGISTICA_SERVER_URL`.

## Funcionalidad

- Resumen por fecha, filtros y paginación de pedidos.
- Registro de pedidos y asignación automática según el backend; cancelación, salida y entrega según estado.
- Alta de repartidores y cambio de disponibilidad.
- Creación y edición de zonas mediante un mapa con vértices arrastrables.
- Generación, inicio y cancelación de rutas; agregar y retirar pedidos; consulta de paradas.
- Mapa de ubicaciones, zonas y conexiones entre paradas con atribución OpenStreetMap.
- SignalR por fecha con resuscripción y recarga REST al reconectar.
- Estados vacíos, carga, errores de negocio y conexión; sin datos simulados.

Los indicadores de en camino y entregados corresponden a la página de pedidos cargada (hasta 50), según los filtros. El total corresponde al total filtrado informado por la API.

El backend no expone GPS de repartidores ni trazado por calles. Las líneas del mapa son conexiones referenciales entre destinos, no navegación vial. Los mapas requieren conexión a los servidores de teselas de OpenStreetMap.

El panel requiere JWT y rol Administrador. La documentación de autenticación vigente está en `docs/Autenticacion_JWT_Integracion.md`; reemplaza las indicaciones antiguas de acceso anónimo de `docs/README.md`.

## Verificación

```powershell
npm run build
npm test -- --watch=false
```

`docs/verificar-api.mjs` se conserva como referencia de la integración anterior sin autenticación. No valida la nueva integración JWT: sus comprobaciones de acceso anónimo ya no aplican.

## Selección de dirección de pedidos

Pega la dirección recibida por WhatsApp en el campo de dirección. Usa «Buscar dirección en el mapa», elige una coincidencia y ajusta el marcador si hace falta. También puedes hacer clic directamente sobre el mapa; la dirección escrita se conserva como referencia de entrega. Cambiar la dirección invalida el punto anterior para evitar guardar una ubicación desactualizada. No hay coordenadas predeterminadas para pedidos nuevos.

La búsqueda se realiza solo al pulsar el botón y envía únicamente la dirección a Photon, sin nombre ni teléfono. `GEOCODING_URL` en `src/app/core/services/address-search.service.ts` permite configurar otra instancia compatible mediante un provider. La instancia pública de demostración de Photon admite uso moderado sin garantía de disponibilidad; para producción configura un servicio o instancia propia: https://github.com/komoot/photon. La selección manual continúa disponible si falla la búsqueda.

## Arquitectura

```text
src/app/
  app.ts / app.html          Arranque y router principal
  app.routes.ts             Rutas y carga diferida de páginas
  core/
    auth/                   Sesión, interceptor Bearer y guards
    models/                 Contratos de backend y tipos de direcciones
    services/
      usuarios.service.ts         Gestión de cuentas y contraseñas temporales
      logistica-api.service.ts    Transporte HTTP: los 21 endpoints
      operations.service.ts       Estado compartido de la operación y acciones
      operation-forms.service.ts  Estado, validación y envío de formularios
      seguimiento.service.ts      Conexión SignalR y grupos por fecha
      address-search.service.ts   Geocodificación configurable
  layout/admin-layout/      Navegación, cabecera y estructura administrativa
  pages/
    login/
    credenciales/
    usuarios/
    resumen/
    pedidos/
    repartidores/
    rutas/
    zonas/
  shared/components/
    zone-map-picker/         Dibujo y ajuste visual de zonas
    address-picker/          Búsqueda y selección del destino
    operation-form/          Formulario modal administrativo
    operation-metrics/       Indicadores de operación
    orders-table/            Tabla utilizada en resumen y pedidos
    route-workspace/         Mapa, rutas y paradas
src/styles/admin.css        Estilos visuales compartidos del panel
```

Las páginas componen la interfaz e inyectan los servicios; los servicios HTTP y de seguimiento consumen los contratos de models. El mapa tiene su propio ciclo de vida y se destruye al abandonar su página. El estado compartido permanece al navegar, conservando fecha, filtros y selección. La URL del backend se define una vez en app.config.ts para REST y SignalR.

Rutas disponibles: /resumen, /pedidos, /repartidores, /rutas y /zonas. Cada página se carga de forma diferida y puede abrirse directamente. Los componentes no deben construir peticiones HTTP ni administrar conexiones SignalR: estas responsabilidades pertenecen a core/services. Para una funcionalidad nueva, crea su carpeta en pages y añade los modelos o servicios que necesite; reutiliza shared cuando corresponda.

Las pruebas de estado y operaciones viven junto a los servicios; las de selección de dirección junto al componente; app.routes.spec.ts verifica navegación y conservación de la fecha.

## Autenticación y autorización

- /login: ingreso exclusivo de administradores. No hay registro público ni credenciales predeterminadas.
- /credenciales: cambio de usuario/contraseña, obligatorio con credenciales temporales. El token nuevo reemplaza al anterior.
- /usuarios: listar y crear cuentas Administrador o Conductor, activar/desactivar y restablecer contraseñas. El conductor requiere vínculo a un repartidor sin cuenta. No se ofrece cambio de rol ni reasignación, ni desactivación de la cuenta propia.
- Las rutas operativas requieren sesión de Administrador con credenciales definitivas. Los guards son controles de navegación; el backend aplica la autorización efectiva.
- El interceptor adjunta Bearer únicamente a la base API configurada. El JWT no se envía a Photon ni a los servidores de mapas. SignalR utiliza accessTokenFactory con el token vigente y se detiene al abandonar la sesión.
- El token y su vencimiento se guardan en sessionStorage por pestaña; nunca las contraseñas. Al recargar, se consulta /autenticacion/me antes de permitir el acceso. Si el navegador bloquea el almacenamiento, la sesión funciona en memoria hasta la recarga.
- No hay refresh tokens: al vencer o recibir un 401 operativo se vuelve al login. Cerrar sesión revoca todas las sesiones de la cuenta y requiere confirmación de éxito del backend; si no se pudo conectar, se informa el error sin afirmar que hubo revocación.
- El primer administrador se crea con el script local del backend indicado en la documentación. La clave de firma JWT permanece exclusivamente en el servidor.

La integración se implementó a partir del documento recibido. En esta sesión el backend local no estaba disponible para contrastar OpenAPI ni probar credenciales reales. El alta de cuentas envía nombreUsuario, claveTemporal, rol y repartidorId (solo conductores); debe contrastarse con Api/Autenticacion.http o Swagger al iniciar el backend. Las pruebas automatizadas de frontend usan respuestas HTTP simuladas.

## Dibujar zonas

En Zonas, pulsa Nueva zona o Editar zona. Dentro del formulario, marca con clics los vértices del contorno en orden; a partir del tercer punto se muestra el área sombreada y el cierre es automático. Arrastra un marcador para ajustar el borde. Puedes deshacer el último punto, seleccionar y eliminar un vértice, limpiar el dibujo o centrar la zona completa. Al editar, el mapa carga el polígono existente sin modificar el original hasta guardar.

Las coordenadas permanecen en un arreglo PuntoDto[] y se envían como poligono al mismo endpoint de zonas. No se redondean ni se repite el primer vértice al final. Se requieren al menos tres puntos para guardar. El mapa utiliza Leaflet con teselas OpenStreetMap y requiere conexión a Internet.

## Diseño visual RouteOS

Las referencias se conservan en docs/diseno.html, docs/diseno2.html, docs/disenoRegistroPedido.html y docs/DiseoZonaGeografica.html. La paleta del diseño se define en src/styles/theme.css: azul primary #0058bc, contenedores #0070eb, fondo #F2F2F7, superficies claras y colores semánticos para estados. src/styles/admin.css contiene las reglas compartidas de navegación, tarjetas, tablas, botones y formularios; acceso y selectores de mapas consumen las mismas variables.

Las páginas usan exclusivamente datos de los servicios: no se agregan pedidos, repartidores, SLA, vehículos, fotografías, GPS ni tiempos de entrega ficticios. Las acciones del diseño se adaptaron a los endpoints disponibles mediante OperationsService y OperationFormsService. El mapa de zonas muestra polígonos registrados; el formulario compartido permite dibujarlos y editarlos. El buscador de módulos tiene estado independiente de la búsqueda de pedidos. La navegación móvil utiliza un menú desplegable y las tablas conservan desplazamiento horizontal.

La tipografía Inter y los iconos Material Symbols se cargan desde Google Fonts según las referencias proporcionadas; los estilos mantienen fuentes de sistema alternativas.

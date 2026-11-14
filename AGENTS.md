# AGENTS.md — Panel Administrativo RouteOS (`frontend-web`)

## 1. Contexto y Misión
Este repositorio es el panel web administrativo **RouteOS** (Angular 22, puerto `4200`, conectado a `http://localhost:5289`)[cite: 8, 10].
Ya tiene implementados y aprobados los módulos de `Centro de Control`, `Registro de Pedidos`, `Armado y Optimización de Rutas`, `Zonas Geográficas`, `Repartidores y Flota`, `Cuentas y Acceso` y `Credenciales`[cite: 8, 10].
Tu misión es **integrar la gestión administrativa de la Tienda E-Commerce** siguiendo `CONTRATO_ECOMMERCE.md` **SIN alterar los diseños ni romper las funcionalidades logísticas existentes**[cite: 10].

## 2. Reglas de Conservación del Diseño (Obligatorias)
1. **Respetar `WEB-FRONEND.md` y el diseño aprobado:** Conservar la paleta, tipografía, tarjetas, barra lateral y estilos actuales[cite: 10]. El script `node scripts/verificar-diseno.mjs` debe seguir pasando sin errores[cite: 10].
2. **No reincorporar bloques retirados:** Mantener el `Resumen` tal como está (sin bloque duplicado de pedidos recientes)[cite: 10].
3. **Conservar el flujo logístico:** Los pedidos generados desde la tienda en modalidad `Domicilio` llegarán automáticamente al endpoint existente `/api/pedidos` y aparecerán en `Registro de Pedidos` y `Armado y Optimización` para ser asignados a rutas mediante nuestro algoritmo propio[cite: 8, 10].

## 3. Nuevas Funcionalidades a Agregar
1. **Nuevo Ítem en Navegación Lateral (`admin-layout`):**[cite: 10]
   - Añadir enlace **`Catálogo y Productos`** (`/productos`) dentro de la sección de operaciones/gestión, manteniendo exactamente las mismas clases CSS de los ítems del menú actual[cite: 8, 10].
2. **Módulo de Gestión de Productos (`/productos`):**
   - Listado con búsqueda, filtro por las **28 categorías** oficiales y estado (`Activo` / `Agotado`).
   - Formulario de creación y edición completa de Producto (`categoriaId`, `subcategoria`, `nombre`, `marca`, `descripcionCorta`, `precioBase`, `precioOferta`, `stock`, `imagenPrincipalUrl`, `galeriaMultimedia`, tabla dinámica de `fichaTecnica` clave-valor y lista dinámica `sobreEsteArticulo`).
   - **Manejo Obligatorio de Concurrencia (`HTTP 409 Conflict`):**
     - Al abrir un producto para editar, guardar su `version` actual.
     - Al enviar `PUT /api/productos/{id}`, incluir `version`.
     - Si el backend responde `409 Conflict` (`CONFLICTO_VERSION_PRODUCTO`), **NO sobrescribir ni cerrar el formulario silenciosamente**: mostrar banner de advertencia claro (*"El producto fue editado por otro usuario. Recarga los datos antes de guardar"*) y un botón para recargar la última versión del servidor.
3. **Vista de Retiros en Tienda (`/retiros-tienda` o pestaña en Pedidos):**
   - Consultar `GET /api/ordenes/retiros-tienda` para que el personal de tienda verifique la cédula/código de retiro del cliente y marque la orden como entregada en mostrador (`PATCH /api/ordenes/{id}/marcar-retirado`).

## 4. Verificación antes de finalizar
Ejecutar obligatoriamente[cite: 10]:
1. `node scripts/verificar-diseno.mjs` (debe aprobar intacto)[cite: 10].
2. `npm run build`[cite: 10]
3. `npm test -- --watch=false`[cite: 10]
# Ejecución de pruebas — RouteOS (frontend-web / panel administrativo)

**Documento:** Perpositorio-delivery-frontend-web.md  
**Proyecto:** RouteOS — Panel administrativo (`frontend-web`)  
**Fecha de ejecución:** 2026-11-14  
**Entorno de ejecución (local):** Windows (win32), directorio `C:\Users\Josue\Desktop\Gestion e Implantacion del Software\Proyecto\frontend-web`  
**Ejecutor:** Automatizado (asistido) mediante CLI del proyecto y scripts de prueba  
**Plan base:** `PLAN_PRUEBAS.md`

---

## 1. Objetivo
Ejecutar y evidenciar las pruebas planificadas para el panel administrativo RouteOS, registrando resultados reales (sin registros inventados), con foco en:
- Verificación técnica automatizada (pruebas unitarias/frontend con mocks, compilación y tipado).
- Pruebas **sin API** (mocks) para fundamentar lógica de UI/negocio (catálogo, retiros, login, rutas).
- Pruebas de **integración contra API real** (backend encendido) para autenticación, catálogo/productos, concurrencia optimista (409), retiros y smoke de regresión logística.
- Conservación del diseño aprobado y ausencia de regresiones de construcción.

---

## 2. Alcance ejecutado

| Tipo de prueba | Alcance | Estado |
|---|---|---|
| Unitarias/automatizadas (Vitest/Angular) | Suite completa del frontend, incluye pruebas existentes y nuevas pruebas sin API (`*.spec.ts`) | **Ejecutada** |
| Pruebas sin API (mocks) | Productos (carga/filtros/crear/conflicto 409/stock/estado), Retiros (carga/filtro/marcar retirado/error), Login (diseño minimal), rutas e-commerce | **Ejecutada** |
| Compilación (build) | Build de navegador y servidor/SSR (`npm run build`) | **Ejecutada** |
| Conservación de diseño aprobado | Verificación de baseline (`node scripts/verificar-diseno.mjs`) | **Ejecutada** |
| Verificación de tipos TypeScript | `tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters` | **Ejecutada** |
| Integración API real (backend encendido) | Login, categorías, productos (listar/crear/obtener/editar/stock), **concurrencia 409 con versión obsoleta (2 admins)**, retiros, smoke logístico | **Ejecutada** |
| UI manual end-to-end en navegador | Validación visual/flujo completo en UI con interacción humana | **Pendiente** |
| Integración tiempo real (SignalR/GPS) | Eventos `/hubs/seguimiento`, posiciones de conductor en vivo | **Pendiente** (requiere conductor/app y eventos en vivo) |
| Casos funcionales UI adicionales | Escenarios no cubiertos por script API (p.ej. forzar credenciales, UX detallada, casos de datos específicos de retiros con marcado en UI) | **Pendiente/Parcial** |

---

## 3. Preparación del entorno

| Ítem | Resultado | Observación |
|---|---|---|
| Código fuente y dependencias | OK | Repositorio `frontend-web` disponible. |
| Herramientas CLI del proyecto | OK | Scripts `build`, `test`, verificador de diseño y TypeScript disponibles. |
| Backend/API (`http://localhost:5289`) | **OK (encendido)** | API accesible; autenticación y endpoints e-commerce/logística respondieron durante la integración. |
| Usuarios administradores (2) | **OK** | Se utilizaron credenciales provistas para autenticación y prueba de concurrencia multiusuario (no se incluyen en este documento). |
| Datos de catálogo | OK | Categorías activas y productos existentes disponibles en el backend. |
| Órdenes de retiro en tienda | Parcial | Endpoint respondió correctamente; sin registros al momento de la prueba (`count=0`). |
| Evidencias | OK | Salidas capturadas en ejecución; script de integración genera resumen JSON; archivo `integracion-api-output.txt` generado. |

---

## 4. Pruebas sin API (mocks) y automatizadas de frontend

### 4.1 Archivos de prueba creados (sin backend, fundamentación)
Convención del proyecto: `*.spec.ts` (Vitest + Angular TestBed).

| Archivo | Cobertura (sin API real) |
|---|---|
| `src/app/pages/productos/productos.page.spec.ts` | Carga/filtros (búsqueda, categoría, estado), creación normalizada, conflicto **409** con banner y recarga de versión sin sobrescribir/cerrar, stock/activar/desactivar (mocks). |
| `src/app/pages/retiros-tienda/retiros-tienda.page.spec.ts` | Carga y filtrado por cédula/nombre/código/ID, marcar retirado con refresco, error controlado en carga. |
| `src/app/pages/login/login.page.spec.ts` | Login minimalista: elementos esenciales presentes y ausencia de bloques informativos extensos del diseño anterior. |
| `src/app/ecommerce.no-api.spec.ts` | Rutas `productos` y `retiros-tienda` (lazy) y redirecciones a `resumen`. |

### 4.2 Ejecución de suite automatizada (Vitest)
**Comando:** `npm test -- --watch=false`  
**Resultado:** **PASA**  
**Resumen:** 15 archivos de prueba, 91 pruebas aprobadas, 0 fallas (incluye pruebas existentes + nuevas pruebas sin API).

**Evidencia (salida):**
```text
> frontend-web@0.0.0 test
> ng test --watch=false

❯ Building...
✔ Building...
Application bundle generation complete.

 RUN  v4.1.11  C:/Users/Josue/Desktop/Gestion e Implantacion del Software/Proyecto/frontend-web

 Test Files  15 passed (15)
      Tests  91 passed (91)
   Start at  15:36:43
   Duration  5.19s (transform 2.28s, setup 7.11s, import 4.28s, tests 4.87s, environment 29.75s)

EXIT:0
```

### 4.3 Compilación (build)
**Comando:** `npm run build`  
**Resultado:** **PASA**  
**Resumen:** Compilación browser + server/SSR completada; incluye chunks lazy de `productos-page` y `retiros-tienda-page`.

**Evidencia (extracto):**
```text
Application bundle generation complete.
Output location: C:\Users\Josue\Desktop\Gestion e Implantacion del Software\Proyecto\frontend-web\dist\frontend-web
```

### 4.4 Verificación de diseño aprobado
**Comando:** `node scripts/verificar-diseno.mjs`  
**Resultado:** **PASA**

**Evidencia:**
```text
7 hojas de estilo sin cambios; 16 plantillas con clases aprobadas conservadas. Se permiten controles funcionales adicionales.
```

### 4.5 Verificación de tipos (TypeScript)
**Comando:** `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters`  
**Resultado:** **PASA** (`EXIT:0`)

---

## 5. Pruebas de integración contra API real (backend encendido)

**Script:** `scripts/integracion-api.test.mjs`  
**Comando:** `node scripts/integracion-api.test.mjs`  
**Backend:** `http://localhost:5289/api`  
**Resultado:** **PASA** — **Total: 12 | PASS: 12 | FAIL: 0**  
**Evidencia adicional:** `integracion-api-output.txt` (salida capturada). Producto de prueba creado durante la ejecución y desactivado al finalizar (`DELETE ... status=204`).

### 5.1 Resultados por caso de integración

| ID | Caso | Resultado | Evidencia (resumen) |
|---|---|---|---|
| CP-LOGIN-01 | Login administrador 1 válido | **PASS** | `usuario=admin rol=Administrador` |
| CP-LOGIN-02A | Login administrador 2 válido (para concurrencia) | **PASS** | `usuario=Admin rol=Administrador` |
| CP-LOGIN-02 | Login con credenciales inválidas rechazado | **PASS** | `status=401` |
| CP-PROD-01A | Listar categorías (API real) | **PASS** | `count=28` |
| CP-PROD-01B | Listar productos admin (`incluirInactivos`) | **PASS** | `items=5 total=42` |
| CP-PROD-02 | Crear producto (API real) | **PASS** | `status=201`, producto creado con `version="vgQAAA=="` |
| CP-PROD-04A | Obtener producto por ID con versión | **PASS** | `version="vgQAAA=="` |
| CP-PROD-04B | Actualizar producto con versión válida (PUT) | **PASS** | `v1="vgQAAA=="` → `v2="vwQAAA=="` (versión incrementa) |
| CP-PROD-04C | Actualizar stock (PATCH) | **PASS** | `status=200 stock=99` |
| CP-PROD-03 | **Concurrencia: PUT con versión obsoleta retorna 409** | **PASS** | `status=409 codigo=CONFLICTO_VERSION_PRODUCTO` |
| CP-RET-01 | Listar retiros en tienda (API real) | **PASS** | `count=0` (endpoint responde correctamente) |
| CP-REG-01 | Smoke regresión logística (zonas/repartidores/rutas) | **PASS** | `zonas=200 repartidores=200 rutas=200` |

### 5.2 Evidencia clave — Concurrencia optimista (CP-PROD-03)
Se realizó actualización válida con Admin 1 (versión `v1` → `v2`) y posteriormente un intento de actualización con Admin 2 usando la versión obsoleta (`v1`), obteniendo conflicto real del backend:

```json
{
  "title": "Conflicto de concurrencia",
  "status": 409,
  "detail": "El producto fue editado por otro usuario. Recarga los datos antes de guardar.",
  "instance": "/api/productos/01a1dbd3-a11d-73f0-9b98-27dd8af5ce13",
  "codigo": "CONFLICTO_VERSION_PRODUCTO",
  "traceId": "00-e1531d33a238c7177a1542df6a807104-d88d57f655264060-00"
}
```

**Interpretación:** el backend aplica control de concurrencia por versión y rechaza sobrescritura con versión obsoleta (409), entregando código/mensaje/`traceId` coherentes con el contrato y con el manejo implementado en el frontend.

### 5.3 Evidencia (salida resumida del script)
```text
API_BASE=http://localhost:5289/api
PASS  CP-LOGIN-01 - Login administrador 1 válido :: usuario=admin rol=Administrador
PASS  CP-LOGIN-02A - Login administrador 2 válido (para concurrencia) :: usuario=Admin rol=Administrador
PASS  CP-LOGIN-02 - Login con credenciales inválidas es rechazado :: status=401
PASS  CP-PROD-01A - Listar categorías (API real) :: count=28 categoriaId=01a1d8a6-b4ef-7e0d-bac0-0bac45512a00
PASS  CP-PROD-01B - Listar productos admin (incluirInactivos) :: items=5 total=42
PASS  CP-PROD-02 - Crear producto (API real) :: id=01a1dbd3-a11d-73f0-9b98-27dd8af5ce13 version="vgQAAA==" status=201
PASS  CP-PROD-04A - Obtener producto por ID con versión :: version="vgQAAA=="
PASS  CP-PROD-04B - Actualizar producto con versión válida (PUT) :: v1="vgQAAA==" v2="vwQAAA=="
PASS  CP-PROD-04C - Actualizar stock (PATCH) :: status=200 stock=99
PASS  CP-PROD-03 - Conflicto de concurrencia: PUT con versión obsoleta retorna 409 :: status=409 codigo=CONFLICTO_VERSION_PRODUCTO ...
PASS  CP-RET-01 - Listar retiros en tienda (API real) :: count=0
PASS  CP-REG-01 - Smoke regresión logística: zonas/repartidores/rutas responden :: zonas=200 repartidores=200 rutas=200
CLEANUP  Desactivar producto prueba 01a1dbd3-a11d-73f0-9b98-27dd8af5ce13 :: status=204

--- RESUMEN INTEGRACIÓN ---
Total: 12 | PASS: 12 | FAIL: 0
EXIT:0
```

---

## 6. Hoja de ejecución de casos de prueba (consolidada)

**Leyenda:** `Pasa` | `Falla` | `Bloqueado` | `Pendiente` | `Parcial`

| ID Caso | Módulo | Tipo | Resultado esperado (resumen) | Resultado obtenido | Estado | Evidencia | ID Defecto |
|---|---|---|---|---|---|---|---|
| CP-TEST-01 | Transversal | Automatizada (Vitest) | Suite frontend sin fallos | 15 archivos, 91 pruebas aprobadas, 0 fallas | **Pasa** | 4.2 | — |
| CP-NOAPI-PROD | Productos | Automatizada (mocks) | Filtros, alta normalizada, 409 sin sobrescribir/cerrar, recarga versión, stock/estado | Comportamientos validados en `productos.page.spec.ts` | **Pasa** | 4.1, 4.2 | — |
| CP-NOAPI-RET | Retiros | Automatizada (mocks) | Carga/filtro, marcar retirado y refresco, error controlado | Comportamientos validados en `retiros-tienda.page.spec.ts` | **Pasa** | 4.1, 4.2 | — |
| CP-NOAPI-LOGIN | Login | Automatizada (mocks) | UI minimal con elementos esenciales, sin bloques extensos previos | Validado en `login.page.spec.ts` | **Pasa** | 4.1, 4.2 | — |
| CP-NOAPI-RUTAS | Navegación | Automatizada | Rutas e-commerce y redirecciones correctas | Validado en `ecommerce.no-api.spec.ts` | **Pasa** | 4.1, 4.2 | — |
| CP-BUILD-01 | Transversal | Automatizada | Build sin errores | Build browser/server OK | **Pasa** | 4.3 | — |
| CP-UI-01 | Diseño | Automatizada | Baseline de diseño conservada | Verificador OK (7 estilos, 16 plantillas) | **Pasa** | 4.4 | — |
| CP-TYPES-01 | Transversal | Automatizada | Tipado sin errores | `tsc --noEmit` OK | **Pasa** | 4.5 | — |
| CP-LOGIN-01 | Login/Acceso | Integración API | Credenciales válidas admin → autenticación | Login correcto (Admin 1) | **Pasa** | 5.1 | — |
| CP-LOGIN-02A | Login/Acceso | Integración API | Segundo admin autenticado (concurrencia) | Login correcto (Admin 2) | **Pasa** | 5.1 | — |
| CP-LOGIN-02 | Login/Acceso | Integración API (negativa) | Credenciales inválidas rechazadas | `401` | **Pasa** | 5.1 | — |
| CP-PROD-01A | Productos/Categorías | Integración API | Listar categorías | 28 categorías | **Pasa** | 5.1 | — |
| CP-PROD-01B | Productos | Integración API | Listar productos admin (`incluirInactivos`) | Respuesta OK (`items=5 total=42`) | **Pasa** | 5.1 | — |
| CP-PROD-02 | Productos | Integración API | Crear producto con datos válidos | `201`, producto con versión | **Pasa** | 5.1 | — |
| CP-PROD-04A | Productos | Integración API | Obtener producto con versión | Versión presente | **Pasa** | 5.1 | — |
| CP-PROD-04B | Productos | Integración API | Actualizar con versión válida | `200`, versión incrementa | **Pasa** | 5.1 | — |
| CP-PROD-04C | Productos | Integración API | Actualizar stock (PATCH) | `200`, stock actualizado | **Pasa** | 5.1 | — |
| CP-PROD-03 | Productos | **Integración API (concurrencia crítica)** | PUT con versión obsoleta → 409, no sobrescribe | `409 CONFLICTO_VERSION_PRODUCTO`, mensaje y `traceId` correctos | **Pasa** | 5.1, 5.2 | — |
| CP-RET-01 | Retiros | Integración API | Listar retiros en tienda | Endpoint responde `200` (`count=0`) | **Pasa** | 5.1 | — |
| CP-RET-02 | Retiros | Integración API/UI | Marcar retirado en orden real | Sin datos de retiro disponibles al ejecutar | **Pendiente** | — | — |
| CP-REG-01 | Regresión logística | Integración API (smoke) | Zonas/repartidores/rutas responden | `200/200/200` | **Pasa** | 5.1 | — |
| CP-AUTH-01 | Credenciales | Funcional UI | Cambio obligatorio → redirección `/credenciales` | No ejecutado en UI con usuario en estado obligatorio | **Pendiente** | — | — |
| CP-AUTH-02 | Sesión | Funcional UI/API | Expiración/401 operativo maneja sesión | No forzado en entorno | **Pendiente** | — | — |
| CP-REG-04 | Seguimiento | Integración tiempo real | Eventos SignalR/GPS actualizan UI | Requiere conductor/eventos en vivo | **Pendiente** | — | — |
| CP-UI-MANUAL | UI E2E | Manual | Flujos completos en navegador (productos/retiros/pedidos/rutas) | No ejecutado como prueba manual guiada en esta sesión | **Pendiente** | — | — |

---

## 7. Registro de incidentes (defectos)

| ID Defecto | Título | Módulo/Caso | Severidad | Prioridad | Estado | Evidencia | Observaciones |
|---|---|---|---|---|---|---|---|
| — | No se detectaron defectos en las pruebas ejecutadas | — | — | — | — | Secciones 4, 5 | Aplica a las pruebas automatizadas (mocks + integración API real) ejecutadas. Quedan casos pendientes (UI manual/E2E, SignalR en vivo, retiro con marcado sobre datos reales, escenarios específicos de sesión). |

---

## 8. Verificación de resultados y métricas

### 8.1 Métricas — Pruebas automatizadas frontend (Vitest)
| Métrica | Valor |
|---|---|
| Archivos de prueba | 15 |
| Pruebas | 91 |
| Pasaron | 91 |
| Fallaron | 0 |
| % éxito | 100% |

### 8.2 Métricas — Integración API real
| Métrica | Valor |
|---|---|
| Casos ejecutados (script) | 12 |
| Pasaron | 12 |
| Fallaron | 0 |
| % éxito | 100% |

### 8.3 Métricas — Hoja consolidada
| Métrica | Valor |
|---|---|
| Casos registrados | 25 |
| Pasaron | 20 |
| Fallaron | 0 |
| Pendientes | 5 |
| Bloqueados | 0 |
| % éxito sobre ejecutados | 100% (20/20) |

### 8.4 Conclusión
- **Conclusión:** **Exitoso (alcance automatizado y de integración API ejecutado)**. La versión evaluada compila, conserva el diseño aprobado, pasa verificación de tipos y la suite automatizada completa (**91/91**). Las pruebas de integración contra el backend encendido fueron exitosas (**12/12**), incluyendo autenticación, catálogo/productos (listar/crear/obtener/actualizar/stock), **concurrencia optimista con 409 `CONFLICTO_VERSION_PRODUCTO` y versión obsoleta** verificada con dos administradores, consulta de retiros y smoke de regresión logística.
- **Cobertura de la regla crítica (concurrencia):** validada a nivel de API real (409 correcto con mensaje/código/`traceId`) y a nivel de frontend con mocks (banner, no sobrescritura/cierre, recarga de versión).
- **Pendientes/Riesgos residuales:** validación manual E2E en navegador (UX completa), escenarios de sesión/credenciales obligatorias en UI, marcado de retiro sobre órdenes reales disponibles, y eventos en tiempo real SignalR/GPS. Se recomienda ejecutar estos casos con datos/eventos apropiados y anexar evidencias (capturas, Network/traceId) en una actualización del informe.

---

## 9. Anexos

### A. Comandos ejecutados
1. `npm test -- --watch=false`
2. `npm run build`
3. `node scripts/verificar-diseno.mjs`
4. `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters`
5. `node scripts/integracion-api.test.mjs`

### B. Artefactos de prueba (repositorio)
- Plan de pruebas: `PLAN_PRUEBAS.md`
- Pruebas sin API (specs): `src/app/pages/productos/productos.page.spec.ts`, `src/app/pages/retiros-tienda/retiros-tienda.page.spec.ts`, `src/app/pages/login/login.page.spec.ts`, `src/app/ecommerce.no-api.spec.ts`
- Script de integración API real: `scripts/integracion-api.test.mjs`
- Salida de integración capturada: `integracion-api-output.txt`
- Contrato/contexto: `CONTRATO_ECOMMERCE.md`, `AGENTS.md`, `WEB-FRONEND.md`

### C. Nota sobre confidencialidad y formato de entrega
- Las credenciales de administración utilizadas para las pruebas de integración fueron provistas para ejecución y **no se incluyen** en este documento.
- Para entrega formal en **PDF** conforme al formato indicado, adaptar la estructura del plan/informe, incorporar capturas UI de los casos pendientes ejecutados y registrar firmas/aprobaciones y control de versiones.

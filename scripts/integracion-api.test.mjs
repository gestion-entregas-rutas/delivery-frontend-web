#!/usr/bin/env node
/**
 * Pruebas de integración contra API real (backend encendido).
 * No requiere datos previos específicos: crea un producto de prueba y lo desactiva al final.
 * Ejecutar: node scripts/integracion-api.test.mjs
 */
const BASE = process.env.API_BASE || 'http://localhost:5289/api';
const USERS = [
  { nombreUsuario: process.env.ADMIN1_USER || 'admin.inicial', clave: process.env.ADMIN1_PASS || '@123456789Ambato@', label: 'admin.inicial' },
  { nombreUsuario: process.env.ADMIN2_USER || 'Admin', clave: process.env.ADMIN2_PASS || '123Admin!!!!', label: 'Admin' },
];

const results = [];
function record(id, name, ok, detail = '') {
  results.push({ id, name, ok, detail });
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status}  ${id} - ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function req(method, path, { token, body, expectStatus } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (expectStatus && res.status !== expectStatus) {
    const err = new Error(`HTTP ${res.status} (esperado ${expectStatus})`);
    err.status = res.status; err.body = json; throw err;
  }
  return { status: res.status, ok: res.ok, json, headers: res.headers };
}

function pickItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.value)) return data.value;
  return [];
}

(async () => {
  console.log(`API_BASE=${BASE}`);
  let t1, t2, u1, u2;
  let createdId = null;
  let created = null;

  try {
    // CP-LOGIN-01: login admin 1
    try {
      const r = await req('POST', '/autenticacion/login', { body: USERS[0], expectStatus: 200 });
      t1 = r.json?.accessToken || r.json?.token;
      u1 = r.json?.usuario?.nombreUsuario;
      record('CP-LOGIN-01', 'Login administrador 1 válido', !!t1 && (r.json?.usuario?.rol === 'Administrador'), `usuario=${u1||'?'} rol=${r.json?.usuario?.rol||'?'}`);
    } catch (e) { record('CP-LOGIN-01', 'Login administrador 1 válido', false, e.message + ' ' + JSON.stringify(e.body||'')); }

    // CP-LOGIN-01b: login admin 2
    try {
      const r = await req('POST', '/autenticacion/login', { body: USERS[1], expectStatus: 200 });
      t2 = r.json?.accessToken || r.json?.token;
      u2 = r.json?.usuario?.nombreUsuario;
      record('CP-LOGIN-02A', 'Login administrador 2 válido (para concurrencia)', !!t2 && (r.json?.usuario?.rol === 'Administrador'), `usuario=${u2||'?'} rol=${r.json?.usuario?.rol||'?'}`);
    } catch (e) { record('CP-LOGIN-02A', 'Login administrador 2 válido (para concurrencia)', false, e.message + ' ' + JSON.stringify(e.body||'')); }

    // CP-LOGIN-02: credenciales inválidas
    try {
      const r = await req('POST', '/autenticacion/login', { body: { nombreUsuario: USERS[0].nombreUsuario, clave: 'clave_invalida_x' } });
      const ok = r.status === 400 || r.status === 401 || r.status === 403;
      record('CP-LOGIN-02', 'Login con credenciales inválidas es rechazado', ok, `status=${r.status}`);
    } catch (e) { record('CP-LOGIN-02', 'Login con credenciales inválidas es rechazado', false, e.message); }

    if (!t1) throw new Error('Sin token admin 1; se omiten pruebas autenticadas.');

    // CP-PROD-01a: categorias
    let categoriaId = null;
    try {
      const r = await req('GET', '/categorias', { token: t1, expectStatus: 200 });
      const cats = pickItems(r.json);
      categoriaId = (cats.find(c => (c.numero ?? c.id) !== 0 && c.numero !== 0) || cats[0])?.id || cats[0]?.categoriaId;
      record('CP-PROD-01A', 'Listar categorías (API real)', Array.isArray(cats) && cats.length > 0, `count=${cats.length} categoriaId=${categoriaId}`);
    } catch (e) { record('CP-PROD-01A', 'Listar categorías (API real)', false, e.message + ' ' + JSON.stringify(e.body||'')); }

    // CP-PROD-01b: productos
    try {
      const r = await req('GET', '/productos?incluirInactivos=true&pagina=1&tamanoPagina=5', { token: t1, expectStatus: 200 });
      const items = pickItems(r.json);
      const total = r.json?.total ?? items.length;
      record('CP-PROD-01B', 'Listar productos admin (incluirInactivos)', r.ok && Array.isArray(items), `items=${items.length} total=${total}`);
    } catch (e) { record('CP-PROD-01B', 'Listar productos admin (incluirInactivos)', false, e.message + ' ' + JSON.stringify(e.body||'')); }

    // CP-PROD-02: crear producto
    if (categoriaId) {
      try {
        const body = {
          categoriaId,
          subcategoria: 'Pruebas QA',
          nombre: `Producto QA Integración ${Date.now()}`,
          marca: 'QA',
          descripcionCorta: 'Creado por prueba de integración automatizada',
          precioBase: 12.5,
          precioOferta: 9.99,
          stock: 7,
          activo: true,
          imagenPrincipalUrl: 'https://example.com/test.png',
          galeriaMultimedia: [{ tipo: 'imagen', url: 'https://example.com/g1.png', orden: 1 }],
          fichaTecnica: [{ clave: 'Color', valor: 'Azul' }],
          sobreEsteArticulo: ['Punto de prueba'],
        };
        const r = await req('POST', '/productos', { token: t1, body, expectStatus: 201 });
        created = r.json;
        createdId = created?.id;
        const ver = created?.version;
        record('CP-PROD-02', 'Crear producto (API real)', !!createdId && ver !== undefined && ver !== null, `id=${createdId} version=${JSON.stringify(ver)} status=${r.status}`);
      } catch (e) {
        // algunos backends devuelven 200
        if (e.status === 200 && e.body?.id) { created = e.body; createdId = created.id; record('CP-PROD-02', 'Crear producto (API real)', true, `id=${createdId} version=${JSON.stringify(created.version)} status=200`); }
        else record('CP-PROD-02', 'Crear producto (API real)', false, e.message + ' ' + JSON.stringify(e.body||''));
      }
    } else {
      record('CP-PROD-02', 'Crear producto (API real)', false, 'No se obtuvo categoriaId');
    }

    // CP-PROD-04: obtener y actualizar (version cambia) + stock
    if (createdId) {
      try {
        const g = await req('GET', `/productos/${createdId}?incluirInactivos=true`, { token: t1, expectStatus: 200 });
        const v1 = g.json?.version;
        record('CP-PROD-04A', 'Obtener producto por ID con versión', !!g.json?.id && v1 !== undefined, `version=${JSON.stringify(v1)}`);

        const updBody = {
          categoriaId: g.json.categoriaId || categoriaId,
          subcategoria: g.json.subcategoria || 'Pruebas QA',
          nombre: (g.json.nombre || 'Producto QA') + ' (editado)',
          marca: g.json.marca || 'QA',
          descripcionCorta: g.json.descripcionCorta || '',
          precioBase: g.json.precioBase ?? 12.5,
          precioOferta: g.json.precioOferta ?? null,
          stock: g.json.stock ?? 7,
          activo: g.json.activo ?? true,
          imagenPrincipalUrl: g.json.imagenPrincipalUrl || null,
          galeriaMultimedia: g.json.galeriaMultimedia || [],
          fichaTecnica: g.json.fichaTecnica || [],
          sobreEsteArticulo: g.json.sobreEsteArticulo || [],
          version: v1,
        };
        const u = await req('PUT', `/productos/${createdId}`, { token: t1, body: updBody, expectStatus: 200 });
        const v2 = u.json?.version;
        record('CP-PROD-04B', 'Actualizar producto con versión válida (PUT)', u.ok && JSON.stringify(v2) !== JSON.stringify(v1), `v1=${JSON.stringify(v1)} v2=${JSON.stringify(v2)}`);

        // stock patch
        try {
          const s = await req('PATCH', `/productos/${createdId}/stock`, { token: t1, body: { stock: 99 } });
          record('CP-PROD-04C', 'Actualizar stock (PATCH)', s.status === 200 || s.status === 204, `status=${s.status} stock=${s.json?.stock ?? '?'}`);
        } catch (e) { record('CP-PROD-04C', 'Actualizar stock (PATCH)', false, e.message + ' ' + JSON.stringify(e.body||'')); }

        // CP-PROD-03: conflicto de concurrencia con versión obsoleta (v1) usando token admin 2
        if (t2) {
          const staleBody = { ...updBody, nombre: 'Cambio con versión obsoleta', version: v1 };
          const c = await req('PUT', `/productos/${createdId}`, { token: t2, body: staleBody });
          const conflict = c.status === 409;
          const codigo = c.json?.codigo || c.json?.Codigo || c.json?.title || '';
          record('CP-PROD-03', 'Conflicto de concurrencia: PUT con versión obsoleta retorna 409', conflict, `status=${c.status} codigo=${codigo} body=${JSON.stringify(c.json)}`);
        } else {
          record('CP-PROD-03', 'Conflicto de concurrencia: PUT con versión obsoleta retorna 409', false, 'No se obtuvo token de segundo administrador');
        }
      } catch (e) {
        record('CP-PROD-04A', 'Obtener/actualizar producto', false, e.message + ' ' + JSON.stringify(e.body||''));
      }
    }

    // CP-RET-01: retiros tienda
    try {
      const r = await req('GET', '/ordenes/retiros-tienda', { token: t1, expectStatus: 200 });
      const items = pickItems(r.json);
      record('CP-RET-01', 'Listar retiros en tienda (API real)', r.ok && Array.isArray(items), `count=${items.length}`);
    } catch (e) {
      record('CP-RET-01', 'Listar retiros en tienda (API real)', false, e.message + ' ' + JSON.stringify(e.body||''));
    }

    // Regresión smoke: endpoints logísticos básicos
    try {
      const today = new Date();
      const fecha = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const [z, rep, rut] = await Promise.all([
        req('GET', '/zonas', { token: t1 }),
        req('GET', '/repartidores?soloDisponibles=false', { token: t1 }),
        req('GET', `/rutas?fecha=${fecha}`, { token: t1 }),
      ]);
      record('CP-REG-01', 'Smoke regresión logística: zonas/repartidores/rutas responden', z.ok && rep.ok && rut.ok, `zonas=${z.status} repartidores=${rep.status} rutas=${rut.status}`);
    } catch (e) {
      record('CP-REG-01', 'Smoke regresión logística: zonas/repartidores/rutas responden', false, e.message);
    }

  } catch (e) {
    console.error('ERROR GENERAL:', e.message);
  } finally {
    // limpieza: desactivar producto de prueba
    if (createdId && t1) {
      try {
        const d = await req('DELETE', `/productos/${createdId}`, { token: t1 });
        console.log(`CLEANUP  Desactivar producto prueba ${createdId} :: status=${d.status}`);
      } catch (e) { console.log(`CLEANUP  Falló desactivar producto prueba ${createdId} :: ${e.message}`); }
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log('\n--- RESUMEN INTEGRACIÓN ---');
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  console.log(JSON.stringify({ summary: { total: results.length, passed, failed }, results }, null, 2));
  process.exit(failed ? 1 : 0);
})();

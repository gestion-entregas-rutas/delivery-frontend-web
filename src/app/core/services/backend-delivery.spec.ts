import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { OperationsService } from './operations.service';
import { LOGISTICA_SERVER_URL, LogisticaApiService } from './logistica-api.service';
import { RouteAssignmentService } from './route-assignment.service';
import { RouteOrderService } from './route-order.service';
import { LocalLocationService } from './local-location.service';
import { puntualidadInfo } from '../../pages/rutas/rutas.page';
import { PedidosPage } from '../../pages/pedidos/pedidos.page';
import { PedidoDto, RutaDto, UbicacionRepartidorDto } from '../models/logistica.models';
import { recentLocation } from '../utils/gps-markers';

const base = 'http://localhost:5289/api';
const pedido: PedidoDto = {
  id: 'p',
  version: 41,
  clienteNombre: 'Destino',
  clienteTelefono: '0991111111',
  direccion: 'Dirección',
  ubicacion: { latitud: -2.18, longitud: -79.9 },
  zonaId: 'z',
  fechaEntrega: '2027-01-01',
  horaEntrega: '12:00:00',
  estado: 'Pendiente',
  rutaId: null,
  registradoEn: '2026-10-24T15:00:00Z',
  entregadoEn: null,
  detalles: {
    remitenteNombre: 'Origen',
    remitenteTelefono: '0992222222',
    remitenteCorreo: 'origen@example.com',
    destinatarioCorreo: 'destino@example.com',
    tipoCarga: 'Medicamentos',
    pesoKg: 1.234,
    fragil: null,
    prioridad: 'Alta',
    observaciones: 'Recepción',
  },
};
const ruta: RutaDto = {
  id: 'r1',
  version: 81,
  fecha: pedido.fechaEntrega,
  zonaId: 'z',
  repartidorId: 'd',
  capacidad: 4,
  estado: 'Planificada',
  paradas: [],
};
const gps: UbicacionRepartidorDto = {
  repartidorId: 'd',
  rutaId: 'r1',
  latitud: -2.18,
  longitud: -79.9,
  precisionMetros: 12,
  capturadaEn: '2027-01-01T15:00:00Z',
  recibidaEn: '2027-01-01T15:00:01Z',
  esReciente: true,
};
describe('Entrega backend 1.1.0', () => {
  let http: HttpTestingController;
  let operations: OperationsService;
  let page: PedidosPage | undefined;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: LOGISTICA_SERVER_URL, useValue: 'http://localhost:5289' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    operations = TestBed.inject(OperationsService);
    operations.zonas.set([
      {
        id: pedido.zonaId,
        nombre: 'Zona de prueba',
        activa: true,
        maxPedidosPorRuta: 4,
        poligono: [
          { latitud: -2.3, longitud: -80 },
          { latitud: -2, longitud: -80 },
          { latitud: -2, longitud: -79.8 },
          { latitud: -2.3, longitud: -79.8 },
        ],
      },
    ]);
  });
  afterEach(() => {
    page?.ngOnDestroy();
    page = undefined;
    http.verify();
  });
  it('edita conservando todos los detalles, nulos y versión, sin registrar otra vez', async () => {
    page = TestBed.runInInjectionContext(() => new PedidosPage());
    const open = page.editOrder('p');
    http.expectOne(base + '/pedidos/p').flush(pedido);
    await open;
    expect(page.formFragil()).toBeNull();
    expect(page.formCliente()).toBe('Destino');
    expect(page.formRemitente()).toBe('Origen');
    page.formDireccion.set('Nueva dirección');
    vi.spyOn(operations, 'changeDate').mockResolvedValue();
    const save = page.saveOrderAndRoute();
    const req = http.expectOne(base + '/pedidos/p');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.version).toBe(41);
    expect(req.request.body.detalles).toEqual(pedido.detalles);
    expect(req.request.body.clienteNombre).toBe('Destino');
    http.expectNone(base + '/pedidos');
    req.flush({ ...pedido, version: 42 });
    await save;
    expect(page.drawerOpen()).toBe(false);
    expect(operations.lastRegistration()).toBeNull();
  });
  it('un conflicto de edición conserva el formulario y obliga a recargar antes de reenviar', async () => {
    page = TestBed.runInInjectionContext(() => new PedidosPage());
    const open = page.editOrder('p');
    http.expectOne(base + '/pedidos/p').flush(pedido);
    await open;
    page.formNotas.set('Cambio local');
    const save = page.saveOrderAndRoute();
    http
      .expectOne(base + '/pedidos/p')
      .flush(
        { detail: 'Versión antigua', traceId: 'trace-edit' },
        { status: 409, statusText: 'Conflict' },
      );
    await Promise.resolve();
    http.expectOne(base + '/pedidos/p').flush({ ...pedido, version: 42 });
    await save;
    expect(page.drawerOpen()).toBe(true);
    expect(page.formNotas()).toBe('Cambio local');
    expect(page.editing()?.version).toBeUndefined();
    expect(operations.error()).toContain('trace-edit');
    await page.saveOrderAndRoute();
    http.expectNone(base + '/pedidos/p');
  });
  it('rechaza remitente incompleto y peso con más de tres decimales antes de escribir', async () => {
    page = TestBed.runInInjectionContext(() => new PedidosPage());
    page.openOrderSheet();
    page.formCliente.set('Destino');
    page.formTelefono.set('099');
    page.formDireccion.set('Dirección');
    page.formPoint.set(pedido.ubicacion);
    page.formFecha.set(pedido.fechaEntrega);
    page.formRemitente.set('Origen');
    await page.saveOrderAndRoute();
    expect(operations.error()).toContain('juntos');
    page.formRemitenteTelefono.set('099');
    page.formPeso.set(1.2345);
    await page.saveOrderAndRoute();
    expect(operations.error()).toContain('decimales');
    http.expectNone(base + '/pedidos');
  });
  it('envía idénticos filtros al listado y al resumen, sin paginación en el agregado', () => {
    const api = TestBed.inject(LogisticaApiService);
    const filtro = {
      desde: '2027-01-01',
      hasta: '2027-01-31',
      buscar: 'Origen',
      zonaId: 'z',
      pagina: 2,
      tamano: 50,
    };
    api.listarPedidos(filtro).subscribe();
    api.resumenPedidos(filtro).subscribe();
    const list = http.expectOne((r) => r.url === base + '/pedidos'),
      summary = http.expectOne((r) => r.url === base + '/resumen/pedidos');
    for (const key of ['desde', 'hasta', 'buscar', 'zonaId'])
      expect(list.request.params.get(key)).toBe(summary.request.params.get(key));
    expect(summary.request.params.has('pagina')).toBe(false);
    expect(summary.request.params.has('fecha')).toBe(false);
    list.flush({ items: [], total: 0, pagina: 2, tamano: 50 });
    summary.flush({ total: 0 });
  });
  it('carga agregados globales aunque la página esté vacía y recupera GPS por REST', async () => {
    operations.fecha = pedido.fechaEntrega;
    operations.search = 'Origen';
    const task = operations.refresh();
    http
      .expectOne((r) => r.url === base + '/pedidos')
      .flush({ items: [], total: 120, pagina: 1, tamano: 50 });
    http.expectOne(base + '/repartidores?soloDisponibles=false').flush([]);
    http.expectOne((r) => r.url === base + '/rutas').flush([ruta]);
    http.expectOne(base + '/zonas').flush([]);
    const req = http.expectOne((r) => r.url === base + '/resumen/pedidos');
    expect(req.request.params.get('buscar')).toBe('Origen');
    req.flush({
      total: 120,
      noCancelados: 100,
      entregados: 80,
      porcentajeEntregado: 80,
      porEstado: [{ estado: 'Entregado', cantidad: 80 }],
      porZona: [],
      calculadoEn: '2027-01-01T15:00:00Z',
    });
    await Promise.resolve();
    http.expectOne((r) => r.url === base + '/seguimiento/ubicaciones').flush([gps]);
    await task;
    expect(operations.count('Entregado')).toBe(80);
    expect(operations.pedidos()).toEqual([]);
    expect(operations.ubicaciones()).toEqual([gps]);
  });
  it('ignora GPS atrasado, igual y fuera de fecha; caduca aunque esReciente siga true', () => {
    operations.fecha = pedido.fechaEntrega;
    operations.rutas.set([ruta]);
    operations.receiveLocation(gps);
    operations.receiveLocation({ ...gps, latitud: 0 });
    operations.receiveLocation({ ...gps, capturadaEn: '2027-01-01T14:00:00Z' });
    expect(operations.ubicaciones()[0].latitud).toBe(gps.latitud);
    expect(recentLocation(gps, Date.parse(gps.capturadaEn) + 119999)).toBe(true);
    expect(recentLocation(gps, Date.parse(gps.capturadaEn) + 120001)).toBe(false);
    operations.fecha = '2027-01-02';
    operations.receiveLocation({ ...gps, capturadaEn: '2027-01-02T15:00:00Z' });
    expect(operations.ubicaciones()[0].capturadaEn).toBe(gps.capturadaEn);
  });
  it('transfiere una sola vez con ambas versiones y sin DELETE/POST de asignación', async () => {
    const service = TestBed.inject(RouteAssignmentService),
      assigned = { ...pedido, estado: 'AsignadoARuta' as const, rutaId: 'r1' };
    const origin = { ...ruta, paradas: [{ orden: 1, pedido: assigned }] },
      dest = { ...ruta, id: 'r2', version: 91 };
    const open = service.open(assigned, 'r2');
    http.expectOne((r) => r.url === base + '/rutas').flush([origin, dest]);
    await open;
    vi.spyOn(operations, 'refresh').mockResolvedValue();
    const save = service.confirm();
    void service.confirm();
    const req = http.expectOne(base + '/rutas/r1/pedidos/p/transferir');
    expect(req.request.body).toEqual({
      destinoRutaId: 'r2',
      versionOrigen: 81,
      versionDestino: 91,
      posicion: null,
    });
    http.expectNone(base + '/rutas/r1/pedidos/p');
    http.expectNone(base + '/rutas/r2/pedidos');
    req.flush({
      origen: { ...origin, paradas: [], version: 82 },
      destino: { ...dest, version: 92 },
    });
    await save;
    expect(service.pedido()).toBeNull();
  });
  it('recarga ambas versiones después de un conflicto de transferencia y exige nueva confirmación', async () => {
    const service = TestBed.inject(RouteAssignmentService),
      assigned = { ...pedido, estado: 'AsignadoARuta' as const, rutaId: 'r1' };
    const origin = { ...ruta, paradas: [{ orden: 1, pedido: assigned }] },
      dest = { ...ruta, id: 'r2', version: 91 };
    const open = service.open(assigned, 'r2');
    http.expectOne((r) => r.url === base + '/rutas').flush([origin, dest]);
    await open;
    const save = service.confirm();
    http
      .expectOne(base + '/rutas/r1/pedidos/p/transferir')
      .flush(
        { detail: 'Cambió la ruta', traceId: 'trace-transfer' },
        { status: 409, statusText: 'Conflict' },
      );
    await Promise.resolve();
    http.expectOne(base + '/pedidos/p').flush(assigned);
    await Promise.resolve();
    http
      .expectOne((r) => r.url === base + '/rutas')
      .flush([
        { ...origin, version: 82 },
        { ...dest, version: 92 },
      ]);
    await save;
    expect(service.routeId).toBe('');
    expect(service.origin()?.version).toBe(82);
    expect(service.error()).toContain('trace-transfer');
    expect(service.saving()).toBe(false);
    http.expectNone(base + '/rutas/r1/pedidos/p/transferir');
    service.close();
  });
  it('envía todos los ids de pedido en orden y bloquea el prefijo ya iniciado', async () => {
    const service = TestBed.inject(RouteOrderService);
    const r = {
      ...ruta,
      estado: 'EnCurso',
      paradas: [
        { orden: 1, pedido: { ...pedido, estado: 'Entregado' } },
        { orden: 2, pedido: { ...pedido, id: 'p2', estado: 'AsignadoARuta' } },
        { orden: 3, pedido: { ...pedido, id: 'p3', estado: 'AsignadoARuta' } },
      ],
    };
    const open = service.open('r1');
    http.expectOne(base + '/rutas/r1').flush(r);
    await open;
    service.move(1, -1);
    expect(service.stops()[0].pedido.id).toBe('p');
    service.move(2, -1);
    vi.spyOn(operations, 'refresh').mockResolvedValue();
    const task = service.confirm();
    const req = http.expectOne(base + '/rutas/r1/paradas/orden');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ pedidosEnOrden: ['p', 'p3', 'p2'], version: 81 });
    req.flush({ ...r, version: 82 });
    await task;
    expect(service.route()).toBeNull();
  });
  it('armarRutas envía origen desde LocalLocationService y maneja 422 sin local', async () => {
    const localService = TestBed.inject(LocalLocationService);
    localService.location.set({
      nombre: 'Local Central',
      direccion: 'Av. Cevallos 123',
      ubicacion: { latitud: -1.245, longitud: -78.625 },
    });
    operations.fecha = '2027-01-01';
    vi.spyOn(operations, 'refresh').mockResolvedValue();
    const task = operations.buildRoutes();
    const req = http.expectOne(base + '/rutas/armar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      fecha: '2027-01-01',
      origen: { latitud: -1.245, longitud: -78.625 },
    });
    req.flush({ fecha: '2027-01-01', rutas: [], pedidosSinAsignar: 0 });
    await task;

    localService.location.set(null);
    const task422 = operations.buildRoutes();
    const req422 = http.expectOne(base + '/rutas/armar');
    req422.flush(
      { detail: 'Falta ubicación del local para pedidos comprometidos' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await task422;
    expect(operations.error()).toBe(
      'Configura la ubicación del local para armar rutas con horarios comprometidos.',
    );
  });
  it('409 CAMBIO_PONE_EN_RIESGO abre el diálogo y reenvía con forzar: true al confirmar', async () => {
    const service = TestBed.inject(RouteAssignmentService);
    const assigned = { ...pedido, estado: 'AsignadoARuta' as const, rutaId: 'r1' };
    const origin = { ...ruta, paradas: [{ orden: 1, pedido: assigned }] };
    const dest = { ...ruta, id: 'r2', version: 91 };
    const open = service.open(assigned, 'r2');
    http.expectOne((r) => r.url === base + '/rutas').flush([origin, dest]);
    await open;
    vi.spyOn(operations, 'refresh').mockResolvedValue();

    const savePromise = service.confirm();
    const req1 = http.expectOne(base + '/rutas/r1/pedidos/p/transferir');
    expect(req1.request.body).toEqual({
      destinoRutaId: 'r2',
      versionOrigen: 81,
      versionDestino: 91,
      posicion: null,
    });
    req1.flush(
      {
        codigo: 'CAMBIO_PONE_EN_RIESGO',
        pedidosEnRiesgo: [
          {
            pedidoId: 'p',
            rutaId: 'r2',
            finalizacionEstimadaEn: '2027-01-01T16:00:00Z',
            limiteEn: '2027-01-01T15:30:00Z',
            retrasoMinutos: 30,
          },
        ],
      },
      { status: 409, statusText: 'Conflict' },
    );

    await Promise.resolve();
    expect(service.pedidosEnRiesgo()?.length).toBe(1);

    service.responderRiesgo(true);
    await Promise.resolve();

    const req2 = http.expectOne(base + '/rutas/r1/pedidos/p/transferir');
    expect(req2.request.body.forzar).toBe(true);
    req2.flush({
      origen: { ...origin, paradas: [], version: 82 },
      destino: { ...dest, version: 92 },
    });
    await savePromise;
    expect(service.pedido()).toBeNull();
  });
  it('409 CAMBIO_PONE_EN_RIESGO cancela la operación sin reenviar al rechazar', async () => {
    const service = TestBed.inject(RouteAssignmentService);
    const assigned = { ...pedido, estado: 'AsignadoARuta' as const, rutaId: 'r1' };
    const origin = { ...ruta, paradas: [{ orden: 1, pedido: assigned }] };
    const dest = { ...ruta, id: 'r2', version: 91 };
    const open = service.open(assigned, 'r2');
    http.expectOne((r) => r.url === base + '/rutas').flush([origin, dest]);
    await open;

    const savePromise = service.confirm();
    const req = http.expectOne(base + '/rutas/r1/pedidos/p/transferir');
    req.flush(
      {
        codigo: 'CAMBIO_PONE_EN_RIESGO',
        pedidosEnRiesgo: [
          {
            pedidoId: 'p',
            rutaId: 'r2',
            finalizacionEstimadaEn: '2027-01-01T16:00:00Z',
            limiteEn: null,
            retrasoMinutos: 15,
          },
        ],
      },
      { status: 409, statusText: 'Conflict' },
    );

    await Promise.resolve();
    expect(service.pedidosEnRiesgo()?.length).toBe(1);

    service.responderRiesgo(false);
    await savePromise;

    http.expectNone(base + '/rutas/r1/pedidos/p/transferir');
    expect(service.pedidosEnRiesgo()).toBeNull();
  });
  it('replaceRoute reemplaza la ruta completa y sus alertas en operations.rutas', () => {
    operations.fecha = ruta.fecha;
    operations.rutas.set([ruta]);
    operations.selected.set(ruta);
    const updated: RutaDto = {
      ...ruta,
      distanciaEstimadaKm: 15.5,
      alertas: [
        {
          pedidoId: 'p',
          orden: 1,
          estado: 'RetrasoPrevisto',
          retrasoMinutos: 20,
        },
      ],
    };
    operations.replaceRoute(updated);
    expect(operations.rutas()[0].distanciaEstimadaKm).toBe(15.5);
    expect(operations.rutas()[0].alertas?.length).toBe(1);
    expect(operations.selected()?.alertas?.length).toBe(1);
  });
  it('puntualidadInfo devuelve textos y clases correctas para cada estado y nulo', () => {
    expect(puntualidadInfo(null).texto).toBe('Sin estimación');
    expect(puntualidadInfo({ estado: 'SinEstimacion', retrasoMinutos: null }).texto).toBe('Sin estimación');
    expect(puntualidadInfo({ estado: 'SinCompromiso', retrasoMinutos: null }).texto).toBe('Sin intervalo comprometido');
    expect(puntualidadInfo({ estado: 'DentroDelPlazoPrevisto', retrasoMinutos: null }).texto).toBe('A tiempo (estimado)');
    expect(puntualidadInfo({ estado: 'RetrasoPrevisto', retrasoMinutos: 15 }).texto).toBe('Retraso previsto: +15 min');
    expect(puntualidadInfo({ estado: 'PlazoVencido', retrasoMinutos: 25 }).texto).toBe('Plazo vencido hace 25 min');
    expect(puntualidadInfo({ estado: 'EntregadoEnIntervalo', retrasoMinutos: null }).texto).toBe('Entregado a tiempo');
    expect(puntualidadInfo({ estado: 'EntregadoConRetraso', retrasoMinutos: 10 }).texto).toBe('Entregado con 10 min de retraso');
    expect(puntualidadInfo({ estado: 'EntregadoAntesDelIntervalo', retrasoMinutos: null }).texto).toBe('Entregado antes del intervalo');
    expect(puntualidadInfo({ estado: 'NoAplica', retrasoMinutos: null }).texto).toBe('No aplica (cancelado)');
  });
});

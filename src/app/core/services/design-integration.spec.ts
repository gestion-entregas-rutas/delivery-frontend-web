import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PedidosPage } from '../../pages/pedidos/pedidos.page';
import { RutasPage } from '../../pages/rutas/rutas.page';
import { ZonasPage } from '../../pages/zonas/zonas.page';
import { ResumenPage } from '../../pages/resumen/resumen.page';
import { OperationsService } from './operations.service';
import { RouteAssignmentService } from './route-assignment.service';
import { LOGISTICA_SERVER_URL } from './logistica-api.service';
import { PedidoDto, RutaDto } from '../models/logistica.models';
const base = 'http://localhost:5289/api';
const pedido: PedidoDto = {
  id: 'pedido-real',
  clienteNombre: 'Cliente de prueba',
  clienteTelefono: '0990000000',
  direccion: 'Dirección de prueba',
  ubicacion: { latitud: -2.180123456789, longitud: -79.900987654321 },
  zonaId: 'zona-real',
  fechaEntrega: '2027-01-01',
  horaEntrega: '12:30:00',
  estado: 'Pendiente',
  rutaId: null,
  registradoEn: '2026-10-24T12:00:00-05:00',
  entregadoEn: null,
};
const ruta: RutaDto = {
  id: 'ruta-real',
  fecha: pedido.fechaEntrega,
  zonaId: pedido.zonaId,
  repartidorId: 'repartidor-real',
  capacidad: 4,
  estado: 'Planificada',
  paradas: [],
};
describe('Funcionalidad sobre diseños aprobados', () => {
  let operations: OperationsService;
  let http: HttpTestingController;
  let page: PedidosPage;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOGISTICA_SERVER_URL, useValue: 'http://localhost:5289' },
      ],
    });
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
    http = TestBed.inject(HttpTestingController);
    page = TestBed.runInInjectionContext(() => new PedidosPage());
  });
  afterEach(() => {
    page.ngOnDestroy();
    http.verify();
  });
  function fill() {
    page.openOrderSheet();
    page.formCliente.set(pedido.clienteNombre);
    page.formTelefono.set(pedido.clienteTelefono);
    page.formDireccion.set(pedido.direccion);
    page.formFecha.set(pedido.fechaEntrega);
    page.formHora.set('12:30');
    page.formPoint.set({ ...pedido.ubicacion });
  }
  it('registra desde el panel lateral con coordenadas exactas y refleja EnEspera sin inventar una ruta', async () => {
    fill();
    vi.spyOn(operations, 'changeDate').mockResolvedValue();
    const task = page.saveOrderAndRoute();
    const req = http.expectOne(base + '/pedidos');
    expect(req.request.body).toEqual({
      clienteNombre: pedido.clienteNombre,
      clienteTelefono: pedido.clienteTelefono,
      direccion: pedido.direccion,
      fechaEntrega: pedido.fechaEntrega,
      horaEntrega: '12:30:00',
      ...pedido.ubicacion,
    });
    req.flush({ pedido, asignacion: { tipo: 'EnEspera', rutaId: null } });
    await task;
    expect(page.drawerOpen()).toBe(false);
    expect(page.toastMessage()).toContain('En espera');
    expect(operations.lastRegistration()?.pedido.id).toBe('pedido-real');
  });
  it('no simula un registro exitoso cuando el backend rechaza la ubicación', async () => {
    fill();
    const task = page.saveOrderAndRoute();
    http
      .expectOne(base + '/pedidos')
      .flush(
        { detail: 'La ubicación no pertenece a una zona activa.' },
        { status: 422, statusText: 'Regla de negocio' },
      );
    await task;
    expect(page.drawerOpen()).toBe(true);
    expect(page.toastVisible()).toBe(false);
    expect(operations.error()).toContain('zona activa');
    expect(operations.lastRegistration()).toBeNull();
  });
  it('impide registrar sin seleccionar un punto del mapa', async () => {
    fill();
    page.formPoint.set(null);
    await page.saveOrderAndRoute();
    http.expectNone(base + '/pedidos');
    expect(operations.error()).toContain('ubicación');
  });
  it('evita POST duplicados mientras se está guardando', async () => {
    fill();
    vi.spyOn(operations, 'changeDate').mockResolvedValue();
    const first = page.saveOrderAndRoute();
    await page.saveOrderAndRoute();
    const requests = http.match(base + '/pedidos');
    expect(requests).toHaveLength(1);
    requests[0].flush({ pedido, asignacion: null });
    await first;
  });
  it('mantiene en cero las vistas sin datos del backend', () => {
    const routes = TestBed.runInInjectionContext(() => new RutasPage());
    const zones = TestBed.runInInjectionContext(() => new ZonasPage());
    const summary = TestBed.runInInjectionContext(() => new ResumenPage());
    expect(page.allOrders()).toEqual([]);
    expect(routes.routeCards()).toEqual([]);
    expect(routes.pendingOrders()).toEqual([]);
    expect(zones.driversList()).toEqual([]);
    expect(summary.manifestRoutes()).toEqual([]);
    expect(summary.alerts()).toEqual([]);
    routes.ngOnDestroy();
    zones.ngOnDestroy();
    summary.ngOnDestroy();
  });
  it('respeta los estados finales y los datos registradosEn sin inventar destinatarios o carga', () => {
    operations.pedidos.set([
      {
        ...pedido,
        estado: 'Entregado',
        rutaId: 'ruta-real',
        entregadoEn: '2026-10-24T13:00:00-05:00',
      },
    ]);
    const item = page.allOrders()[0];
    expect(item.estadoPill).toBe('Entregado');
    expect(item.sinRepartidor).toBe(false);
    expect(item.destinatarioNombre).toBe(pedido.clienteNombre);
    expect(item.cargaProgreso).toBe('0%');
    expect(item.registroInfo).not.toContain('2027');
  });
  it('permite asignar únicamente a rutas con la misma fecha y zona y cupo', async () => {
    const service = TestBed.inject(RouteAssignmentService);
    const task = service.open(pedido);
    http
      .expectOne((r) => r.url === base + '/rutas')
      .flush([
        ruta,
        { ...ruta, id: 'sin-cupo', capacidad: 0 },
        { ...ruta, id: 'otra-zona', zonaId: 'diferente' },
        { ...ruta, id: 'otra-fecha', fecha: '2028-01-01' },
        { ...ruta, id: 'cancelada', estado: 'Cancelada' },
      ]);
    await task;
    expect(service.routes().map((r) => r.id)).toEqual(['ruta-real']);
    expect(service.routeId).toBe('');
    service.close();
  });
  it('confirma una asignación solo tras recibir la respuesta del backend', async () => {
    const service = TestBed.inject(RouteAssignmentService);
    const open = service.open(pedido, 'ruta-real');
    http.expectOne((r) => r.url === base + '/rutas').flush([ruta]);
    await open;
    vi.spyOn(operations, 'refresh').mockResolvedValue();
    const task = service.confirm();
    const req = http.expectOne(base + '/rutas/ruta-real/pedidos');
    expect(req.request.body).toEqual({ pedidoId: 'pedido-real' });
    expect(service.pedido()).not.toBeNull();
    req.flush({
      ...ruta,
      paradas: [{ orden: 1, pedido: { ...pedido, estado: 'AsignadoARuta', rutaId: ruta.id } }],
    });
    await task;
    expect(service.pedido()).toBeNull();
    expect(operations.message()).toContain('asignado');
  });
  it('no reintenta una asignación automáticamente ante un conflicto', async () => {
    const service = TestBed.inject(RouteAssignmentService);
    const open = service.open(pedido, 'ruta-real');
    http.expectOne((r) => r.url === base + '/rutas').flush([ruta]);
    await open;
    const task = service.confirm();
    http
      .expectOne(base + '/rutas/ruta-real/pedidos')
      .flush({ detail: 'La ruta ya está llena.' }, { status: 409, statusText: 'Conflicto' });
    await Promise.resolve();
    http.expectOne(base + '/pedidos/' + pedido.id).flush(pedido);
    await Promise.resolve();
    http.expectOne((r) => r.url === base + '/rutas').flush([ruta]);
    await task;
    expect(service.pedido()?.id).toBe(pedido.id);
    expect(service.error()).toContain('llena');
    expect(operations.message()).toBe('');
    http.expectNone(base + '/rutas/ruta-real/pedidos');
    service.close();
  });
  it('interpreta cero rutas y pedidosSinAsignar como respuesta válida de planificación', async () => {
    vi.spyOn(operations, 'refresh').mockResolvedValue();
    const task = operations.buildRoutes();
    http
      .expectOne(base + '/rutas/armar')
      .flush({ fecha: operations.fecha, rutas: [], pedidosSinAsignar: 3 });
    expect((await task)?.pedidosSinAsignar).toBe(3);
    expect(operations.message()).toContain('0 rutas');
    expect(operations.message()).toContain('3 pedidos sin asignar');
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { zoneGeometryError } from '../utils/zone-geometry';
import { PuntoDto, ZonaDto } from '../models/logistica.models';
import { OperationFormsService } from './operation-forms.service';
import { LocalLocationService } from './local-location.service';
import { OperationsService } from './operations.service';
import { LOGISTICA_SERVER_URL } from './logistica-api.service';
import { ZonasPage } from '../../pages/zonas/zonas.page';

const base = 'http://localhost:5289/api',
  key = 'delivery.local-location.v1';
const points: PuntoDto[] = [
  { latitud: -2.18, longitud: -79.9 },
  { latitud: -2.18, longitud: -79.88 },
  { latitud: -2.2, longitud: -79.88 },
  { latitud: -2.2, longitud: -79.9 },
];
const zone: ZonaDto = {
  id: 'z',
  nombre: 'Centro',
  poligono: points,
  maxPedidosPorRuta: 5,
  activa: true,
};
describe('Creación y edición de zonas y referencia del local', () => {
  let http: HttpTestingController, forms: OperationFormsService, operations: OperationsService;
  beforeEach(() => {
    localStorage.removeItem(key);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOGISTICA_SERVER_URL, useValue: 'http://localhost:5289' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    forms = TestBed.inject(OperationFormsService);
    operations = TestBed.inject(OperationsService);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(key);
    http.verify();
  });
  it('valida polígonos simples sin redondear coordenadas y rechaza cruces, duplicados y líneas', () => {
    expect(zoneGeometryError(points)).toBe('');
    expect(zoneGeometryError([points[0], points[2], points[1], points[3]])).toContain('cruzan');
    expect(zoneGeometryError([...points, points[0]])).toContain('repitas');
    expect(
      zoneGeometryError([
        { latitud: 0, longitud: 0 },
        { latitud: 1, longitud: 1 },
        { latitud: 2, longitud: 2 },
      ]),
    ).toContain('alineados');
    expect(zoneGeometryError([{ latitud: 91, longitud: 0 }, points[1], points[2]])).toContain(
      'válida',
    );
  });
  it('crea con el DTO exacto y bloquea dobles envíos mientras espera respuesta', async () => {
    forms.open('Zona');
    forms.form.nombre = '  Centro  ';
    forms.form.maxPedidosPorRuta = 5;
    forms.zonePoints = points.map((p) => ({ ...p }));
    vi.spyOn(operations, 'refresh').mockResolvedValue();
    const save = forms.save();
    void forms.save();
    const req = http.expectOne(base + '/zonas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Centro', poligono: points, maxPedidosPorRuta: 5 });
    expect(forms.modal()).toBe('Zona');
    req.flush(zone);
    await save;
    expect(forms.modal()).toBe('');
  });
  it('conserva nombre y dibujo cuando el backend rechaza una zona', async () => {
    forms.open('Zona', zone);
    forms.form.nombre = 'Centro ajustado';
    forms.zonePoints = points.map((p) => ({ ...p }));
    const save = forms.save();
    http
      .expectOne(base + '/zonas/z')
      .flush(
        { detail: 'No se puede modificar esta zona', traceId: 'trace-zone' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await save;
    expect(forms.modal()).toBe('Zona');
    expect(forms.form.nombre).toBe('Centro ajustado');
    expect(forms.zonePoints).toEqual(points);
    expect(operations.error()).toContain('trace-zone');
    expect(operations.saving()).toBe(false);
  });
  it('consulta la zona vigente antes de editar y conserva la activación en PUT', async () => {
    const page = TestBed.runInInjectionContext(() => new ZonasPage());
    const open = page.editZone(zone);
    const current = { ...zone, nombre: 'Centro vigente', maxPedidosPorRuta: 8, activa: false };
    http.expectOne(base + '/zonas/z').flush(current);
    await open;
    expect(forms.form.nombre).toBe('Centro vigente');
    expect(forms.form.activa).toBe(false);
    vi.spyOn(operations, 'refresh').mockResolvedValue();
    const save = forms.save();
    const req = http.expectOne(base + '/zonas/z');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      nombre: current.nombre,
      poligono: points,
      maxPedidosPorRuta: 8,
      activa: false,
    });
    req.flush(current);
    await save;
    page.ngOnDestroy();
  });
  it('no abre un formulario tardío después de abandonar la página', async () => {
    const page = TestBed.runInInjectionContext(() => new ZonasPage());
    const task = page.editZone(zone);
    page.ngOnDestroy();
    http.expectOne(base + '/zonas/z').flush(zone);
    await task;
    expect(forms.modal()).toBe('');
  });
  it('rechaza una capacidad fraccionaria o un polígono cruzado sin enviar HTTP', async () => {
    forms.open('Zona', zone);
    forms.form.maxPedidosPorRuta = 2.5;
    await forms.save();
    expect(operations.error()).toContain('entero');
    forms.form.maxPedidosPorRuta = 5;
    forms.zonePoints = [points[0], points[2], points[1], points[3]];
    await forms.save();
    expect(operations.error()).toContain('cruzan');
    http.expectNone(base + '/zonas/z');
  });
  it('guarda el local en el navegador y en el servidor con coordenadas exactas, sin crear una zona', async () => {
    const local = TestBed.inject(LocalLocationService);
    forms.open('Local');
    forms.form.nombre = 'Mi tienda';
    forms.form.direccion = 'Dirección del local';
    const point = { latitud: -2.180123456789, longitud: -79.900987654321 };
    forms.setDeliveryLocation(point);
    operations.connected.set(false);
    const guardado = forms.save();
    const put = http.expectOne(base + '/local');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ nombre: 'Mi tienda', direccion: 'Dirección del local', ...point });
    put.flush({ nombre: 'Mi tienda', direccion: 'Dirección del local', ...point, actualizadoEn: '2026-11-24T10:00:00Z' });
    await guardado;
    expect(forms.modal()).toBe('');
    expect(local.location()?.ubicacion).toEqual(point);
    expect(operations.message()).toContain('La tienda ya puede calcular horarios');
    local.location.set(null);
    local.load();
    expect(local.location()?.ubicacion).toEqual(point);
    http.expectNone(base + '/zonas');
  });
  it('avisa si el servidor no guardó el local y deja el formulario abierto', async () => {
    forms.open('Local');
    forms.form.nombre = 'Mi tienda';
    forms.form.direccion = 'Dirección del local';
    forms.setDeliveryLocation(points[0]);
    const guardado = forms.save();
    http.expectOne(base + '/local').flush({}, { status: 500, statusText: 'Error' });
    await guardado;
    expect(forms.modal()).toBe('Local');
    expect(operations.error()).toContain('servidor');
  });
  it('no confirma el guardado del local si el almacenamiento falla', () => {
    const local = TestBed.inject(LocalLocationService);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    expect(local.save({ nombre: 'Tienda', direccion: 'Dirección', ubicacion: points[0] })).toBe(
      false,
    );
    expect(local.location()).toBeNull();
    expect(local.error()).toContain('No se pudo guardar');
  });
  it('no acepta una ubicación corrupta del navegador ni una dirección vacía', () => {
    const local = TestBed.inject(LocalLocationService);
    localStorage.setItem(
      key,
      '{"nombre":"Tienda","direccion":"Dirección","ubicacion":{"latitud":999,"longitud":0}}',
    );
    local.load();
    expect(local.location()).toBeNull();
    expect(local.save({ nombre: 'Tienda', direccion: ' ', ubicacion: points[0] })).toBe(false);
  });
});

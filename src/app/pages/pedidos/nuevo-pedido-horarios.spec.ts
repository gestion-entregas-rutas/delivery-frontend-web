import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PedidosPage } from './pedidos.page';
import { OperationsService } from '../../core/services/operations.service';
import { LOGISTICA_SERVER_URL } from '../../core/services/logistica-api.service';
import { IntervalosDisponiblesDto } from '../../core/models/logistica.models';

const base = 'http://localhost:5289/api';
// 13:00Z = 08:00 en Ecuador.
const oferta: IntervalosDisponiblesDto = {
  fecha: '2027-01-01', zonaId: 'z', zonaNombre: 'Centro', duracionMinutos: 30,
  modeloEstimacion: 'HaversineAjustadoV1', calculadoEn: '2026-12-31T12:00:00Z',
  intervalos: [
    { inicioEn: '2027-01-01T13:00:00Z', finEn: '2027-01-01T13:30:00Z', disponible: true, motivo: null },
    { inicioEn: '2027-01-01T13:30:00Z', finEn: '2027-01-01T14:00:00Z', disponible: false, motivo: 'SinCapacidad' },
  ],
};

describe('Nuevo pedido con horarios disponibles', () => {
  let page: PedidosPage;
  let http: HttpTestingController;
  let operations: OperationsService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: LOGISTICA_SERVER_URL, useValue: 'http://localhost:5289' }],
    });
    operations = TestBed.inject(OperationsService);
    operations.zonas.set([{ id: 'z', nombre: 'Centro', activa: true, maxPedidosPorRuta: 4,
      poligono: [{ latitud: -2.3, longitud: -80 }, { latitud: -2, longitud: -80 }, { latitud: -2, longitud: -79.8 }, { latitud: -2.3, longitud: -79.8 }] }]);
    http = TestBed.inject(HttpTestingController);
    page = TestBed.runInInjectionContext(() => new PedidosPage());
    vi.spyOn(operations, 'changeDate').mockResolvedValue();
    page.openOrderSheet();
    page.formCliente.set('Ana');
    page.formTelefono.set('0991');
    page.formDireccion.set('Calle 1');
    page.formFecha.set('2027-01-01');
    page.formPoint.set({ latitud: -2.18, longitud: -79.9 });
  });
  afterEach(() => {
    page.ngOnDestroy();
    http.verify();
    vi.useRealTimers();
  });

  const cargarOferta = () => {
    (page as any).consultaIntervalos.next();
    vi.advanceTimersByTime(400);
    const req = http.expectOne((r) => r.url === base + '/entregas/intervalos');
    expect(req.request.params.get('fecha')).toBe('2027-01-01');
    req.flush(oferta);
  };

  it('pide horarios y no permite guardar sin elegir uno', async () => {
    cargarOferta();
    expect(page.hayHorarios()).toBe(true);
    await page.saveOrderAndRoute();
    http.expectNone(base + '/pedidos');
    expect(operations.error()).toContain('Elige un horario');
  });
});

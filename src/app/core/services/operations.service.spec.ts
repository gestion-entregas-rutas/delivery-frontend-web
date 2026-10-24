import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { OperationsService } from './operations.service';
import { OperationFormsService } from './operation-forms.service';
import { provideRouter } from '@angular/router';
import { LOGISTICA_SERVER_URL } from './logistica-api.service';
import { RutaDto } from '../models/logistica.models';

describe('Panel de operaciones', () => {
  let app: OperationsService;
  let forms: OperationFormsService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOGISTICA_SERVER_URL, useValue: 'http://localhost:5289' },
      ],
    });
    app = TestBed.inject(OperationsService);
    forms = TestBed.inject(OperationFormsService);
  });
  it('conserva los pedidos si falla una operación', async () => {
    app.pedidos.set([{ id: 'existente' } as any]);
    const task = app.action(app.api.cancelarPedido('existente'), 'Cancelado');
    TestBed.inject(HttpTestingController)
      .expectOne('http://localhost:5289/api/pedidos/existente/cancelar')
      .flush(
        { detail: 'Solo se permite cancelar pedidos pendientes.' },
        { status: 422, statusText: 'Regla de negocio' },
      );
    await task;
    expect(app.pedidos()[0].id).toBe('existente');
    expect(app.error()).toContain('Solo se permite cancelar');
    expect(app.saving()).toBe(false);
  });
  it('muestra el alta en espera como registro exitoso', async () => {
    forms.form = {
      clienteNombre: 'Cliente',
      horaEntrega: '12:00',
      latitud: -2.18,
      longitud: -79.9,
    };
    forms.modal.set('Pedido');
    const refresh = vi.spyOn(app, 'refresh').mockResolvedValue();
    const task = forms.save();
    const req = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:5289/api/pedidos',
    );
    expect(req.request.body.horaEntrega).toBe('12:00:00');
    req.flush({ pedido: { id: 'nuevo' }, asignacion: { tipo: 'EnEspera', rutaId: null } });
    await task;
    expect(app.message()).toContain('En espera de asignación');
    expect(forms.modal()).toBe('');
    expect(refresh).toHaveBeenCalled();
  });
  it('solo permite avanzar asignaciones de rutas en curso', () => {
    app.rutas.set([{ id: 'ruta', estado: 'Planificada' } as RutaDto]);
    expect(app.canAdvance({ rutaId: 'ruta' } as any)).toBe(false);
    app.rutas.set([{ id: 'ruta', estado: 'EnCurso' } as RutaDto]);
    expect(app.canAdvance({ rutaId: 'ruta' } as any)).toBe(true);
  });
  it('envía el dibujo del mapa al crear una zona conservando su precisión', async () => {
    forms.open('Zona');
    forms.form.nombre = 'Zona norte';
    forms.zonePoints = [
      { latitud: -2.180123456789, longitud: -79.9 },
      { latitud: -2.19, longitud: -79.88 },
      { latitud: -2.2, longitud: -79.9 },
    ];
    vi.spyOn(app, 'refresh').mockResolvedValue();
    const task = forms.save();
    const req = TestBed.inject(HttpTestingController).expectOne('http://localhost:5289/api/zonas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.poligono).toEqual(forms.zonePoints);
    expect(req.request.body.poligono).toHaveLength(3);
    req.flush({ id: 'zona' });
    await task;
    expect(forms.modal()).toBe('');
  });
  it('carga el dibujo de una zona sin alterar el original y conserva los datos al editar', async () => {
    const zone = {
      id: 'zona',
      nombre: 'Zona norte',
      poligono: [
        { latitud: -2.18, longitud: -79.9 },
        { latitud: -2.19, longitud: -79.88 },
        { latitud: -2.2, longitud: -79.9 },
      ],
      maxPedidosPorRuta: 8,
      activa: false,
    };
    forms.open('Zona', zone);
    forms.zonePoints[0].latitud = -2.17;
    expect(zone.poligono[0].latitud).toBe(-2.18);
    vi.spyOn(app, 'refresh').mockResolvedValue();
    const task = forms.save();
    const req = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:5289/api/zonas/zona',
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.activa).toBe(false);
    expect(req.request.body.maxPedidosPorRuta).toBe(8);
    expect(req.request.body.poligono[0].latitud).toBe(-2.17);
    req.flush(zone);
    await task;
  });
  it('no registra una zona con menos de tres puntos', async () => {
    forms.open('Zona');
    forms.zonePoints = [
      { latitud: -2.18, longitud: -79.9 },
      { latitud: -2.19, longitud: -79.88 },
    ];
    await forms.save();
    TestBed.inject(HttpTestingController).expectNone('http://localhost:5289/api/zonas');
    expect(app.error()).toContain('al menos tres puntos');
    expect(forms.modal()).toBe('Zona');
    expect(app.saving()).toBe(false);
  });
});

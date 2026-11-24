import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { routes } from './app.routes';
import { LOGISTICA_SERVER_URL } from './core/services/logistica-api.service';
import { OperationFormsService } from './core/services/operation-forms.service';
import { OperationsService } from './core/services/operations.service';

describe('Navegación administrativa', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            restore: async () => {},
            token: () => 'mock-token',
            usuario: signal({
              id: 'admin',
              nombreUsuario: 'Administrador',
              rol: 'Administrador',
              activo: true,
              debeCambiarCredenciales: false,
            }),
          },
        },
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOGISTICA_SERVER_URL, useValue: 'http://localhost:5289' },
      ],
    }),
  );
  it('redirige a login sin iniciar las consultas del panel', async () => {
    TestBed.overrideProvider(AuthService, {
      useValue: {
        restore: async () => {},
        token: () => null,
        usuario: signal(null),
        aviso: signal(''),
      },
    });
    const operations = TestBed.inject(OperationsService);
    const start = vi.spyOn(operations, 'start');
    const harness = await RouterTestingHarness.create('/pedidos');
    expect(harness.routeNativeElement?.matches('app-login-page')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('app-admin-layout')).toBeNull();
    expect(start).not.toHaveBeenCalled();
  });
  it('abre pedidos por URL y cambia a zonas conservando la fecha de operación', async () => {
    const operations = TestBed.inject(OperationsService);
    vi.spyOn(operations, 'start').mockImplementation(() => {});
    const harness = await RouterTestingHarness.create('/pedidos');
    operations.fecha = '2027-03-12';
    expect(harness.routeNativeElement?.querySelector('app-pedidos-page')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Pedidos');
    await harness.navigateByUrl('/zonas');
    expect(harness.routeNativeElement?.querySelector('app-zonas-page')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Zonas');
    expect(operations.fecha).toBe('2027-03-12');
    expect(harness.routeNativeElement?.querySelector('app-orders-table')).toBeNull();
  });
  it('conserva el estado vacío de la API sin opción de nuevo pedido y permite editar un pedido pendiente', async () => {
    const operations = TestBed.inject(OperationsService);
    vi.spyOn(operations, 'start').mockImplementation(() => {});
    const harness = await RouterTestingHarness.create('/pedidos');
    expect(harness.routeNativeElement?.querySelectorAll('.order-id').length).toBe(0);
    expect(harness.routeNativeElement?.textContent).toContain('Sin pedidos para mostrar');
    expect(harness.routeNativeElement?.querySelector('.heading-actions .primary')).toBeNull();

    const sample = {
      id: 'pedido-1',
      version: 1,
      clienteNombre: 'Cliente Test',
      clienteTelefono: '0999999999',
      direccion: 'Av Test 123',
      ubicacion: { latitud: -2.18, longitud: -79.9 },
      zonaId: 'zona-1',
      fechaEntrega: '2026-11-16',
      horaEntrega: '16:00:00',
      estado: 'Pendiente' as const,
      rutaId: null,
      registradoEn: '2026-11-16T10:00:00Z',
      entregadoEn: null,
    };
    operations.pedidos.set([sample]);
    vi.spyOn(operations.api, 'obtenerPedido').mockReturnValue(of(sample));
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelectorAll('.order-id').length).toBe(1);
    const editBtn = harness.routeNativeElement?.querySelector(
      'button[title="Editar pedido pendiente"]',
    ) as HTMLButtonElement;
    expect(editBtn).toBeTruthy();
    editBtn.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector('#new-order-sheet')?.getAttribute('aria-hidden'),
    ).toBe('false');
    expect(harness.routeNativeElement?.querySelector('app-pedidos-page')?.textContent).toContain(
      'Editar pedido pendiente',
    );
    expect(harness.routeNativeElement?.querySelector('app-address-picker')).toBeTruthy();
  });
  it('edita la zona real en el selector de mapa sin filtrar pedidos', async () => {
    const operations = TestBed.inject(OperationsService);
    vi.spyOn(operations, 'start').mockImplementation(() => {});
    const zone = {
      id: 'zona-real',
      nombre: 'Zona de prueba',
      activa: true,
      maxPedidosPorRuta: 6,
      poligono: [
        { latitud: -2.18, longitud: -79.9 },
        { latitud: -2.19, longitud: -79.88 },
        { latitud: -2.2, longitud: -79.9 },
      ],
    };
    operations.zonas.set([zone]);
    const harness = await RouterTestingHarness.create('/zonas');
    operations.search = 'Cliente de prueba';
    harness.detectChanges();
    // La barra lateral compacta muestra todos los módulos y no toca la búsqueda de pedidos.
    expect(harness.routeNativeElement?.querySelectorAll('.nav-link').length).toBeGreaterThan(1);
    expect(operations.search).toBe('Cliente de prueba');
    (harness.routeNativeElement?.querySelector('.zone-card .button') as HTMLButtonElement).click();
    TestBed.inject(HttpTestingController)
      .expectOne('http://localhost:5289/api/zonas/zona-real')
      .flush(zone);
    await Promise.resolve();
    harness.detectChanges();
    const forms = TestBed.inject(OperationFormsService);
    expect(forms.form.id).toBe('zona-real');
    expect(forms.zonePoints).toEqual(zone.poligono);
    expect(harness.routeNativeElement?.querySelector('app-zone-map-picker')).toBeTruthy();
  });
});

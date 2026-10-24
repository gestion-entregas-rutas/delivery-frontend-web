import { signal } from '@angular/core';
import { AuthService } from './core/auth/auth.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
  it('abre el formulario real de pedidos y conserva el estado vacío de la API', async () => {
    const operations = TestBed.inject(OperationsService);
    vi.spyOn(operations, 'start').mockImplementation(() => {});
    const harness = await RouterTestingHarness.create('/pedidos');
    expect(harness.routeNativeElement?.querySelectorAll('.order-id').length).toBe(0);
    expect(harness.routeNativeElement?.textContent).toContain('Sin pedidos para mostrar');
    (
      harness.routeNativeElement?.querySelector('.heading-actions .primary') as HTMLButtonElement
    ).click();
    harness.detectChanges();
    expect(TestBed.inject(OperationFormsService).modal()).toBe('Pedido');
    expect(harness.routeNativeElement?.querySelector('app-address-picker')).toBeTruthy();
  });
  it('edita la zona real en el selector de mapa y busca módulos sin filtrar pedidos', async () => {
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
    const search = harness.routeNativeElement?.querySelector(
      'input[aria-label="Buscar módulo"]',
    ) as HTMLInputElement;
    search.value = 'Zonas';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelectorAll('.nav-link').length).toBe(1);
    expect(operations.search).toBe('Cliente de prueba');
    (harness.routeNativeElement?.querySelector('.zone-card .button') as HTMLButtonElement).click();
    harness.detectChanges();
    const forms = TestBed.inject(OperationFormsService);
    expect(forms.form.id).toBe('zona-real');
    expect(forms.zonePoints).toEqual(zone.poligono);
    expect(harness.routeNativeElement?.querySelector('app-zone-map-picker')).toBeTruthy();
  });
});

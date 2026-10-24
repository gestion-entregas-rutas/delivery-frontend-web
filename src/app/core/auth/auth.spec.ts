import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { adminGuard } from './auth.guards';
import { LOGISTICA_SERVER_URL } from '../services/logistica-api.service';
import { SesionDto } from '../models/autenticacion.models';

const base = 'http://localhost:5289';
function session(
  temporary = false,
  rol: 'Administrador' | 'Conductor' = 'Administrador',
): SesionDto {
  return {
    accessToken: 'token-prueba',
    tokenType: 'Bearer',
    expiraEn: new Date(Date.now() + 1800000).toISOString(),
    usuario: {
      id: 'admin-id',
      nombreUsuario: 'admin',
      rol,
      repartidorId: null,
      activo: true,
      debeCambiarCredenciales: temporary,
    },
  };
}
describe('Autenticación del panel', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let router: Router;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: LOGISTICA_SERVER_URL, useValue: base },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => {
    http.verify();
    auth.ngOnDestroy();
    sessionStorage.clear();
    vi.useRealTimers();
  });
  async function login(value = session()) {
    const task = auth.login({ nombreUsuario: 'admin', clave: 'TemporalClave1!' });
    const req = http.expectOne(base + '/api/autenticacion/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(value);
    await task;
  }
  it('acepta un administrador y no guarda contraseñas', async () => {
    await login();
    expect(auth.token()).toBe('token-prueba');
    expect(auth.usuario()?.rol).toBe('Administrador');
    expect(sessionStorage.getItem('delivery.sesion')).not.toContain('TemporalClave1!');
  });
  it('rechaza conductores sin conservar el token', async () => {
    const task = auth.login({ nombreUsuario: 'driver', clave: 'TemporalClave1!' });
    http.expectOne(base + '/api/autenticacion/login').flush(session(false, 'Conductor'));
    await expect(task).rejects.toThrow('exclusivo');
    expect(auth.token()).toBeNull();
    expect(sessionStorage.getItem('delivery.sesion')).toBeNull();
  });
  it('envía Bearer solo al backend y nunca al buscador de direcciones', async () => {
    await login();
    const client = TestBed.inject(HttpClient);
    client.get(base + '/api/zonas').subscribe();
    client.get('https://photon.komoot.io/api/?q=Guayaquil').subscribe();
    const api = http.expectOne(base + '/api/zonas');
    expect(api.request.headers.get('Authorization')).toBe('Bearer token-prueba');
    api.flush([]);
    const external = http.expectOne('https://photon.komoot.io/api/?q=Guayaquil');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush({ features: [] });
  });
  it('el guard redirige sesiones temporales al cambio obligatorio', async () => {
    await login(session(true));
    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/pedidos' } as any),
    );
    expect(router.serializeUrl(result as any)).toBe('/credenciales');
  });
  it('el guard bloquea el panel sin sesión', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/usuarios' } as any),
    );
    expect(router.serializeUrl(result as any)).toContain('/login?returnUrl=');
  });
  it('reemplaza el token temporal al cambiar credenciales', async () => {
    await login(session(true));
    const task = auth.cambiarCredenciales({
      claveActual: 'TemporalClave1!',
      nuevoNombreUsuario: 'admin',
      nuevaClave: 'DefinitivaClave2!',
    });
    const req = http.expectOne(base + '/api/autenticacion/credenciales');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-prueba');
    req.flush({ ...session(), accessToken: 'token-definitivo' });
    await task;
    expect(auth.token()).toBe('token-definitivo');
    expect(auth.usuario()?.debeCambiarCredenciales).toBe(false);
  });
  it('comprueba la identidad en el servidor al restaurar la sesión', async () => {
    sessionStorage.setItem(
      'delivery.sesion',
      JSON.stringify({ accessToken: 'guardado', expira: Date.now() + 60000 }),
    );
    const task = auth.restore();
    const req = http.expectOne(base + '/api/autenticacion/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer guardado');
    req.flush(session().usuario);
    await task;
    expect(auth.usuario()?.id).toBe('admin-id');
  });
  it('descarta tokens guardados vencidos sin consultar datos operativos', async () => {
    sessionStorage.setItem(
      'delivery.sesion',
      JSON.stringify({ accessToken: 'vencido', expira: Date.now() - 1 }),
    );
    await auth.restore();
    expect(auth.token()).toBeNull();
    http.expectNone(base + '/api/autenticacion/me');
  });
  it('limpia la sesión y vuelve al login al vencer', async () => {
    vi.useFakeTimers();
    await login({ ...session(), expiraEn: new Date(Date.now() + 1000).toISOString() });
    vi.advanceTimersByTime(1001);
    expect(auth.token()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
  it('un 401 operativo limpia la sesión y no reintenta el POST', async () => {
    await login();
    TestBed.inject(HttpClient)
      .post(base + '/api/rutas/armar', { fecha: '2027-01-01' })
      .subscribe({ error: () => {} });
    http
      .expectOne(base + '/api/rutas/armar')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.token()).toBeNull();
    http.expectNone(base + '/api/rutas/armar');
  });
  it('no confunde una clave actual incorrecta con la expiración del token', async () => {
    await login();
    const task = auth.cambiarCredenciales({
      claveActual: 'IncorrectaClave1!',
      nuevoNombreUsuario: 'admin',
      nuevaClave: 'NuevaClaveSegura2!',
    });
    http
      .expectOne(base + '/api/autenticacion/credenciales')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(task).rejects.toBeTruthy();
    expect(auth.token()).toBe('token-prueba');
  });
  it('no afirma revocar sesiones si el token ya venció', async () => {
    await auth.logout();
    http.expectNone(base + '/api/autenticacion/logout');
    expect(auth.aviso()).toContain('sesión local');
  });
  it('revoca la sesión en el servidor antes de borrarla localmente', async () => {
    await login();
    const task = auth.logout();
    const req = http.expectOne(base + '/api/autenticacion/logout');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-prueba');
    req.flush(null);
    await task;
    expect(auth.token()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});

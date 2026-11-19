import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CredencialesPage } from './credenciales.page';
import { AuthService } from '../../core/auth/auth.service';

describe('CredencialesPage (diseño RouteOS Bento y navegación)', () => {
  let router: Router;
  let authMock: {
    usuario: ReturnType<typeof signal>;
    cambiarCredenciales: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authMock = {
      usuario: signal({
        id: 'u-1',
        nombreUsuario: 'admin_test',
        rol: 'Administrador' as const,
        activo: true,
        debeCambiarCredenciales: false,
      }),
      cambiarCredenciales: vi.fn(async () => {}),
      logout: vi.fn(async () => {}),
    };

    await TestBed.configureTestingModule({
      imports: [CredencialesPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockImplementation(async () => true);
  });

  it('renderiza botón de regreso, campos de credenciales y toggles de visibilidad', () => {
    const fixture = TestBed.createComponent(CredencialesPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const text = el.textContent || '';

    expect(text).toContain('Regresar al panel');
    expect(text).toContain('Cambiar credenciales');
    expect(text).toContain('Generar clave segura');
    expect(text).toContain('Guardar y continuar');
    expect(el.querySelector('input[name="nombreUsuario"]')).toBeTruthy();
    expect(el.querySelector('input[name="claveActual"]')).toBeTruthy();
    expect(el.querySelector('input[name="nuevaClave"]')).toBeTruthy();
    expect(el.querySelector('input[name="confirmacion"]')).toBeTruthy();
  });

  it('navega a /resumen cuando se acciona el botón de regreso', () => {
    const fixture = TestBed.createComponent(CredencialesPage);
    const component = fixture.componentInstance;
    component.goBack();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/resumen');
  });

  it('generarClaveSegura genera una contraseña que cumple los 4 requisitos de seguridad', () => {
    const fixture = TestBed.createComponent(CredencialesPage);
    const component = fixture.componentInstance;
    component.generarClaveSegura();

    expect(component.nuevaClave.length).toBeGreaterThanOrEqual(12);
    expect(component.confirmacion).toBe(component.nuevaClave);
    expect(component.tieneMayuscula()).toBe(true);
    expect(component.tieneMinuscula()).toBe(true);
    expect(component.tieneNumero()).toBe(true);
    expect(component.tieneSimbolo()).toBe(true);
    expect(new RegExp(component.pattern).test(component.nuevaClave)).toBe(true);
  });

  it('muestra error si las contraseñas nuevas no coinciden', async () => {
    const fixture = TestBed.createComponent(CredencialesPage);
    const component = fixture.componentInstance;
    component.claveActual = 'ClaveActual123!';
    component.nuevaClave = 'NuevaClave456!';
    component.confirmacion = 'DistintaClave789!';

    await component.submit();

    expect(component.error()).toBe('Las contraseñas nuevas no coinciden.');
    expect(authMock.cambiarCredenciales).not.toHaveBeenCalled();
  });

  it('muestra error si la nueva contraseña es idéntica a la actual', async () => {
    const fixture = TestBed.createComponent(CredencialesPage);
    const component = fixture.componentInstance;
    component.claveActual = 'MismaClave123!';
    component.nuevaClave = 'MismaClave123!';
    component.confirmacion = 'MismaClave123!';

    await component.submit();

    expect(component.error()).toBe('La nueva contraseña debe ser diferente a la actual.');
    expect(authMock.cambiarCredenciales).not.toHaveBeenCalled();
  });

  it('invoca cambiarCredenciales y redirige a /resumen con datos válidos', async () => {
    const fixture = TestBed.createComponent(CredencialesPage);
    const component = fixture.componentInstance;
    component.nombreUsuario = 'admin_actualizado';
    component.claveActual = 'AntiguaClave123!';
    component.nuevaClave = 'NuevaClaveValida999#';
    component.confirmacion = 'NuevaClaveValida999#';

    await component.submit();

    expect(authMock.cambiarCredenciales).toHaveBeenCalledWith({
      claveActual: 'AntiguaClave123!',
      nuevoNombreUsuario: 'admin_actualizado',
      nuevaClave: 'NuevaClaveValida999#',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/resumen');
  });
});

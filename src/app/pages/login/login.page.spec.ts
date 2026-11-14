import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { LoginPage } from './login.page';
import { AuthService } from '../../core/auth/auth.service';

describe('LoginPage (rediseño minimal, sin API real)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        {
          provide: AuthService,
          useValue: {
            aviso: signal(''),
            usuario: signal(null),
            login: vi.fn(async () => {}),
          },
        },
      ],
    }).compileComponents();
  });

  it('renderiza login limpio con elementos esenciales y sin bloques informativos extensos', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const text = el.textContent || '';

    expect(text).toContain('RouteOS');
    expect(text).toContain('Acceso administrativo');
    expect(text).toContain('Iniciar sesión');
    expect(text).toContain('Ingresar');
    expect(el.querySelector('input[name="nombreUsuario"]')).toBeTruthy();
    expect(el.querySelector('input[name="clave"]')).toBeTruthy();
    expect(el.querySelector('form')).toBeTruthy();

    // Se elimina contenido de marketing/información excesiva del diseño anterior
    expect(text).not.toContain('CADA ENTREGA, BAJO CONTROL');
    expect(text).not.toContain('Tu operación.');
    expect(text).not.toContain('Siempre conectada.');
    expect(text).not.toContain('Centro de operaciones · Panel administrativo');
  });
});

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { UsuariosPage } from './usuarios.page';
import { UsuariosService } from '../../core/services/usuarios.service';
import { LogisticaApiService } from '../../core/services/logistica-api.service';
import { OperationsService } from '../../core/services/operations.service';
import { AuthService } from '../../core/auth/auth.service';
import { of } from 'rxjs';
import { UsuarioDto } from '../../core/models/autenticacion.models';
import { RepartidorDto } from '../../core/models/logistica.models';

describe('UsuariosPage (sin API real, mocks)', () => {
  let api: {
    listar: any;
    crear: any;
    cambiarActivo: any;
    restablecerClave: any;
  };
  let logistica: {
    listarRepartidores: any;
  };
  let auth: {
    usuario: any;
  };
  let operations: {
    view: any;
  };

  const fakeUsuarios: UsuarioDto[] = [
    {
      id: 'usr-admin-1',
      nombreUsuario: 'admin.principal',
      rol: 'Administrador',
      repartidorId: null,
      activo: true,
      debeCambiarCredenciales: false,
    },
    {
      id: 'usr-admin-2',
      nombreUsuario: 'admin.secundario',
      rol: 'Administrador',
      repartidorId: null,
      activo: true,
      debeCambiarCredenciales: false,
    },
    {
      id: 'usr-driver-2',
      nombreUsuario: 'carlos.chofer',
      rol: 'Conductor',
      repartidorId: 'rep-1',
      activo: true,
      debeCambiarCredenciales: true,
    },
    {
      id: 'usr-driver-3',
      nombreUsuario: 'mario.inactivo',
      rol: 'Conductor',
      repartidorId: null,
      activo: false,
      debeCambiarCredenciales: false,
    },
    {
      id: 'usr-client-4',
      nombreUsuario: 'ana.cliente@example.com',
      rol: 'Cliente',
      repartidorId: null,
      activo: true,
      debeCambiarCredenciales: false,
    },
  ];

  const fakeRepartidores: RepartidorDto[] = [
    {
      id: 'rep-1',
      nombre: 'Carlos Chofer Repartidor',
      telefono: '099111222',
      estado: 'Disponible',
      capacidadMaxima: 4,
    },
    {
      id: 'rep-2',
      nombre: 'Lucía Disponible',
      telefono: '099333444',
      estado: 'Disponible',
      capacidadMaxima: 5,
    },
  ];

  beforeEach(() => {
    api = {
      listar: vi.fn().mockReturnValue(of(fakeUsuarios)),
      crear: vi.fn().mockReturnValue(of({ ...fakeUsuarios[0], id: 'usr-new' })),
      cambiarActivo: vi.fn().mockReturnValue(of({ ...fakeUsuarios[1], activo: false })),
      restablecerClave: vi.fn().mockReturnValue(of(undefined)),
    };
    logistica = {
      listarRepartidores: vi.fn().mockReturnValue(of(fakeRepartidores)),
    };
    auth = {
      usuario: vi.fn().mockReturnValue({ id: 'usr-admin-1', nombreUsuario: 'admin.principal', rol: 'Administrador' }),
    };
    operations = {
      view: signal('Resumen'),
    };

    TestBed.configureTestingModule({
      imports: [UsuariosPage],
      providers: [
        { provide: UsuariosService, useValue: api },
        { provide: LogisticaApiService, useValue: logistica },
        { provide: AuthService, useValue: auth },
        { provide: OperationsService, useValue: operations },
      ],
    });
  });

  it('carga cuentas del equipo y calcula métricas y filtros', async () => {
    const fixture = TestBed.createComponent(UsuariosPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page.load();

    expect(page.totalUsuarios()).toBe(5);
    expect(page.adminsCount()).toBe(2);
    expect(page.conductoresCount()).toBe(2);
    expect(page.clientesCount()).toBe(1);
    expect(page.activosCount()).toBe(4);
    expect(page.inactivosCount()).toBe(1);
    expect(page.pendientesCambioCount()).toBe(1);

    // Filtros
    page.rolFiltro.set('Administrador');
    expect(page.filtrados().length).toBe(2);

    page.rolFiltro.set('Conductor');
    expect(page.filtrados().length).toBe(2);

    page.rolFiltro.set('Cliente');
    expect(page.filtrados().length).toBe(1);
    expect(page.filtrados()[0].nombreUsuario).toBe('ana.cliente@example.com');

    page.rolFiltro.set('Todos');
    page.buscar.set('carlos');
    expect(page.filtrados().length).toBe(1);
    expect(page.filtrados()[0].nombreUsuario).toBe('carlos.chofer');
  });

  it('genera contraseña segura cumpliendo el patrón requerido de seguridad', () => {
    const fixture = TestBed.createComponent(UsuariosPage);
    const page = fixture.componentInstance;

    page.generarClaveSegura();
    expect(page.claveTemporal.length).toBeGreaterThanOrEqual(12);
    const regex = new RegExp(page.pattern);
    expect(regex.test(page.claveTemporal)).toBe(true);
  });

  it('abre diálogo de crear cuenta y guarda nuevo usuario', async () => {
    const fixture = TestBed.createComponent(UsuariosPage);
    const page = fixture.componentInstance;
    await page.load();

    page.openCreate();
    expect(page.dialog()).toBe('crear');

    page.nombreUsuario = 'nuevo.operador';
    page.rol = 'Administrador';
    page.claveTemporal = 'Temporal!2026Secure';

    await page.save();

    expect(api.crear).toHaveBeenCalledWith({
      nombreUsuario: 'nuevo.operador',
      claveTemporal: 'Temporal!2026Secure',
      rol: 'Administrador',
    });
    expect(page.dialog()).toBeNull();
  });

  it('previene restablecer contraseña de administradores pero lo permite para conductores', async () => {
    const fixture = TestBed.createComponent(UsuariosPage);
    const page = fixture.componentInstance;
    await page.load();

    // Intentar restablecer a otro administrador: no abre diálogo
    page.openReset(fakeUsuarios[1]); // usr-admin-2
    expect(page.dialog()).toBeNull();
    expect(page.selected).toBeNull();

    // Restablecer a un conductor: abre diálogo y procesa
    page.openReset(fakeUsuarios[2]); // usr-driver-2
    expect(page.dialog()).toBe('restablecer');
    expect(page.selected?.id).toBe('usr-driver-2');

    page.claveTemporal = 'Temporal!2026Reset';
    await page.save();

    expect(api.restablecerClave).toHaveBeenCalledWith('usr-driver-2', 'Temporal!2026Reset');
    expect(page.dialog()).toBeNull();
  });

  it('previene desactivar cuentas de administradores pero permite desactivar conductores y clientes', async () => {
    const fixture = TestBed.createComponent(UsuariosPage);
    const page = fixture.componentInstance;
    await page.load();

    // Intentar desactivar su propia cuenta de admin: bloqueado
    await page.toggle(fakeUsuarios[0]);
    expect(api.cambiarActivo).not.toHaveBeenCalled();

    // Intentar desactivar a otro admin: bloqueado
    await page.toggle(fakeUsuarios[1]);
    expect(api.cambiarActivo).not.toHaveBeenCalled();

    // Desactivar un conductor: permitido
    await page.toggle(fakeUsuarios[2]);
    expect(api.cambiarActivo).toHaveBeenCalledWith('usr-driver-2', false);

    // Desactivar un cliente: permitido
    await page.toggle(fakeUsuarios[4]);
    expect(api.cambiarActivo).toHaveBeenCalledWith('usr-client-4', false);
  });
});

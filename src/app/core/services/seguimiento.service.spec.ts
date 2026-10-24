import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { LOGISTICA_SERVER_URL } from './logistica-api.service';
import { SeguimientoService } from './seguimiento.service';
const fake = vi.hoisted(() => ({
  options: null as any,
  events: new Map<string, () => void>(),
  hub: {
    state: 'Disconnected',
    on: vi.fn(),
    onreconnecting: vi.fn(),
    onclose: vi.fn(),
    onreconnected: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    invoke: vi.fn(),
  },
}));
vi.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: class {
    withUrl(_url: string, options: any) {
      fake.options = options;
      return this;
    }
    withAutomaticReconnect() {
      return this;
    }
    build() {
      return fake.hub;
    }
  },
}));
describe('Seguimiento autenticado', () => {
  let token = 'temporal';
  const usuario = signal({ rol: 'Administrador', debeCambiarCredenciales: true });
  let service: SeguimientoService;
  beforeEach(() => {
    vi.clearAllMocks();
    fake.events.clear();
    fake.options = null;
    fake.hub.state = 'Disconnected';
    fake.hub.start.mockImplementation(async () => {
      fake.hub.state = 'Connected';
    });
    fake.hub.stop.mockResolvedValue(undefined);
    fake.hub.invoke.mockResolvedValue(undefined);
    fake.hub.on.mockImplementation((name, fn) => fake.events.set(name, fn));
    token = 'temporal';
    usuario.set({ rol: 'Administrador', debeCambiarCredenciales: true });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { token: () => token, usuario } },
        { provide: LOGISTICA_SERVER_URL, useValue: 'http://localhost:5289' },
      ],
    });
    service = TestBed.inject(SeguimientoService);
  });
  it('no negocia el hub con credenciales temporales', async () => {
    await service.start('2027-01-01', async () => {});
    expect(fake.options).toBeNull();
    expect(fake.hub.start).not.toHaveBeenCalled();
  });
  it('suministra el token vigente y deja de actualizar al cerrar sesión', async () => {
    usuario.set({ rol: 'Administrador', debeCambiarCredenciales: false });
    const refresh = vi.fn().mockResolvedValue(undefined);
    await service.start('2027-01-01', refresh);
    expect(fake.options.accessTokenFactory()).toBe('temporal');
    token = 'definitivo';
    expect(fake.options.accessTokenFactory()).toBe('definitivo');
    expect(fake.hub.invoke).toHaveBeenCalledWith('SuscribirseAFecha', '2027-01-01');
    await service.stop();
    refresh.mockClear();
    fake.events.get('PedidoActualizado')?.();
    expect(refresh).not.toHaveBeenCalled();
    expect(service.live()).toBe(false);
    expect(fake.hub.stop).toHaveBeenCalled();
  });
});

import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { LogisticaApiService } from './logistica-api.service';
import {
  PedidoDto,
  RepartidorDto,
  RutaDto,
  ZonaDto,
  EstadoPedido,
} from '../models/logistica.models';
import { SeguimientoService } from './seguimiento.service';
@Injectable({ providedIn: 'root' })
export class OperationsService {
  readonly api = inject(LogisticaApiService);
  readonly view = signal('Resumen');
  readonly pedidos = signal<PedidoDto[]>([]);
  readonly repartidores = signal<RepartidorDto[]>([]);
  readonly rutas = signal<RutaDto[]>([]);
  readonly zonas = signal<ZonaDto[]>([]);
  readonly connected = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly selected = signal<RutaDto | null>(null);
  readonly seguimiento = inject(SeguimientoService);
  readonly live = this.seguimiento.live;
  readonly total = signal(0);
  readonly page = signal(1);
  readonly today = this.localDate();
  fecha = this.today;
  search = '';
  estado = '';
  zona = '';
  pendingId = '';
  readonly viewMode = signal<'today' | 'sched'>('today');
  readonly navigation = [
    { name: 'Resumen', label: 'Centro de Control', icon: 'monitoring', group: 'Principal' },
    { name: 'Pedidos', label: 'Registro de Pedidos', icon: 'inventory_2', group: 'Principal' },
    { name: 'Rutas', label: 'Armado y Optimización', icon: 'route', group: 'Operaciones' },
    { name: 'Zonas', label: 'Zonas Geográficas', icon: 'travel_explore', group: 'Operaciones' },
    {
      name: 'Repartidores',
      label: 'Repartidores y Flota',
      icon: 'local_shipping',
      group: 'Operaciones',
    },
    {
      name: 'Usuarios',
      label: 'Cuentas y Acceso',
      icon: 'admin_panel_settings',
      group: 'Administración',
    },
  ];
  readonly orderStates = ['Pendiente', 'AsignadoARuta', 'EnCamino', 'Entregado', 'Cancelado'];

  scheduledDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  setMode(mode: 'today' | 'sched') {
    this.viewMode.set(mode);
    this.fecha = mode === 'today' ? this.today : this.scheduledDate();
    void this.changeDate();
  }

  get sameDayOrdersCount() {
    return this.pedidos().filter((p) => p.fechaEntrega === this.today).length;
  }

  get programmedOrdersCount() {
    return Math.max(0, this.total() - this.sameDayOrdersCount);
  }

  get avgOrdersPerRoute() {
    const count = this.rutas().length;
    if (!count) return 0;
    const totalStops = this.rutas().reduce((acc, r) => acc + r.paradas.length, 0);
    return +(totalStops / count).toFixed(1);
  }
  get availableDrivers() {
    return this.repartidores().filter((d) => d.estado === 'Disponible').length;
  }
  deliveredStops(r: RutaDto) {
    return r.paradas.filter((s) => s.pedido.estado === 'Entregado').length;
  }
  routeProgress(r: RutaDto) {
    return r.paradas.length ? (this.deliveredStops(r) / r.paradas.length) * 100 : 0;
  }
  showOrderRoute(id: string) {
    const route = this.rutas().find((r) => r.id === id);
    if (route) {
      this.navigate('Rutas');
      this.selectRoute(route);
    }
  }
  private readonly router = inject(Router);
  private generation = 0;
  start() {
    void this.refresh();
    void this.seguimiento.start(this.fecha, () => this.refresh());
  }
  localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  label(value: string) {
    return (
      (
        {
          AsignadoARuta: 'Asignado',
          EnCamino: 'En camino',
          EnCurso: 'En curso',
          NoDisponible: 'No disponible',
          EnRuta: 'En ruta',
        } as Record<string, string>
      )[value] || value
    );
  }
  short(id: string) {
    return id.slice(0, 8).toUpperCase();
  }
  count(state: string) {
    return this.pedidos().filter((p) => p.estado === state).length;
  }
  driver(id: string) {
    return this.repartidores().find((r) => r.id === id)?.nombre || 'Sin repartidor';
  }
  zoneName(id: string) {
    return this.zonas().find((z) => z.id === id)?.nombre || 'Sin zona';
  }
  filteredPedidos() {
    const q = this.search.toLocaleLowerCase();
    return this.pedidos().filter(
      (p) =>
        (!this.estado || p.estado === this.estado) &&
        (!this.zona || p.zonaId === this.zona) &&
        `${p.clienteNombre} ${p.direccion} ${p.id}`.toLocaleLowerCase().includes(q),
    );
  }
  navigate(name: string) {
    this.view.set(name);
    this.search = '';
    void this.router.navigate([
      (
        {
          Resumen: '/resumen',
          Pedidos: '/pedidos',
          Repartidores: '/repartidores',
          Rutas: '/rutas',
          Zonas: '/zonas',
          Usuarios: '/usuarios',
          Credenciales: '/credenciales',
        } as Record<string, string>
      )[name] || '/resumen',
    ]);
  }
  async refresh(reset = false) {
    const generation = this.generation;
    if (reset) this.page.set(1);
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(
        forkJoin({
          pedidos: this.api.listarPedidos({
            fecha: this.fecha,
            pagina: this.page(),
            tamano: 50,
            estado: (this.estado || undefined) as EstadoPedido | undefined,
            zonaId: this.zona || undefined,
          }),
          repartidores: this.api.listarRepartidores(),
          rutas: this.api.listarRutas(this.fecha),
          zonas: this.api.listarZonas(),
        }),
      );
      if (generation !== this.generation) return;
      this.pedidos.set(data.pedidos.items);
      this.total.set(data.pedidos.total);
      this.repartidores.set(data.repartidores);
      this.rutas.set(data.rutas);
      this.zonas.set(data.zonas);
      this.connected.set(true);
      if (this.selected())
        this.selected.set(data.rutas.find((r) => r.id === this.selected()?.id) || null);
    } catch (e) {
      if (generation !== this.generation) return;
      this.connected.set(false);
      this.showError(e);
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async changeDate() {
    await this.seguimiento.subscribeDate(this.fecha);
    await this.refresh(true);
  }
  async paginate(delta: number) {
    this.page.update((p) => p + delta);
    await this.refresh();
  }
  showError(e: any) {
    const p = e?.error;
    this.error.set(
      e?.status === 0
        ? 'No se pudo conectar con la API. Verifica que el backend esté activo en localhost:5289.'
        : [
            p?.detail || p?.title || e?.message || 'No se pudo completar la operación.',
            ...Object.values(p?.errors || {}).flat(),
          ].join(' '),
    );
  }
  async action(request: import('rxjs').Observable<unknown>, success: string) {
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(request);
      this.message.set(success);
      await this.refresh();
    } catch (e) {
      this.showError(e);
      if ((e as any)?.status === 409) await this.refresh();
    } finally {
      this.saving.set(false);
    }
  }
  async buildRoutes() {
    this.saving.set(true);
    try {
      const r = await firstValueFrom(
        this.api.armarRutas({ fecha: this.fecha, zonaId: this.zona || undefined }),
      );
      this.message.set(
        `${r.rutas.length} rutas generadas · ${r.pedidosSinAsignar} pedidos sin asignar.`,
      );
      await this.refresh();
    } catch (e) {
      this.showError(e);
    } finally {
      this.saving.set(false);
    }
  }
  selectRoute(route: RutaDto) {
    this.selected.set(route);
  }
  canAdvance(p: PedidoDto) {
    return this.rutas().some((r) => r.id === p.rutaId && r.estado === 'EnCurso');
  }

  stop() {
    this.generation++;
    void this.seguimiento.stop();
    this.pedidos.set([]);
    this.repartidores.set([]);
    this.rutas.set([]);
    this.zonas.set([]);
    this.selected.set(null);
    this.total.set(0);
    this.page.set(1);
    this.connected.set(false);
    this.loading.set(false);
    this.saving.set(false);
    this.message.set('');
    this.error.set('');
    this.search = '';
    this.estado = '';
    this.zona = '';
    this.pendingId = '';
    this.fecha = this.localDate();
  }
  retryLive() {
    void this.seguimiento.restart(this.fecha, () => this.refresh());
  }
}

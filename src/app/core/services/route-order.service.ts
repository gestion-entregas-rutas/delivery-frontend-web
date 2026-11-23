import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { RutaDto, ParadaDto, PedidoEnRiesgo } from '../models/logistica.models';
import { OperationsService } from './operations.service';

@Injectable({ providedIn: 'root' })
export class RouteOrderService {
  private readonly operations = inject(OperationsService);
  readonly route = signal<RutaDto | null>(null);
  readonly stops = signal<ParadaDto[]>([]);
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly pedidosEnRiesgo = signal<PedidoEnRiesgo[] | null>(null);
  private resolverRiesgo?: (confirmado: boolean) => void;
  private generation = 0;
  async open(id: string) {
    if (this.saving()) return;
    const gen = ++this.generation;
    this.route.set(null);
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.operations.api.obtenerRuta(id));
      if (gen !== this.generation) return;
      if (!['Planificada', 'EnCurso'].includes(r.estado) || r.version == null)
        throw new Error('Esta ruta no permite reordenar o no tiene versión vigente.');
      this.route.set(r);
      this.stops.set([...r.paradas].sort((a, b) => a.orden - b.orden));
    } catch (e) {
      if (gen === this.generation) {
        this.operations.showError(e);
        this.error.set(this.operations.error());
      }
    } finally {
      if (gen === this.generation) this.loading.set(false);
    }
  }
  fixedPrefix() {
    if (this.route()?.estado !== 'EnCurso') return 0;
    return this.stops().reduce(
      (max, s, i) =>
        ['EnCamino', 'Entregado'].includes(s.pedido.estado) ? Math.max(max, i + 1) : max,
      0,
    );
  }
  canMove(index: number, delta: number) {
    const to = index + delta;
    return (
      !this.saving() &&
      index >= this.fixedPrefix() &&
      to >= this.fixedPrefix() &&
      to < this.stops().length
    );
  }
  confirmar(pedidos: PedidoEnRiesgo[]): Promise<boolean> {
    this.pedidosEnRiesgo.set(pedidos);
    return new Promise<boolean>((resolve) => {
      this.resolverRiesgo = resolve;
    });
  }
  responderRiesgo(confirmado: boolean) {
    this.pedidosEnRiesgo.set(null);
    this.resolverRiesgo?.(confirmado);
    this.resolverRiesgo = undefined;
  }
  async ejecutarConRiesgo<T>(enviar: (forzar: boolean) => Observable<T>): Promise<T | null> {
    try {
      return await firstValueFrom(enviar(false));
    } catch (e: any) {
      const p = e?.error ?? e?.problem;
      if (e?.status === 409 && p?.codigo === 'CAMBIO_PONE_EN_RIESGO') {
        const ok = await this.confirmar(p.pedidosEnRiesgo as PedidoEnRiesgo[]);
        if (!ok) return null;
        return await firstValueFrom(enviar(true));
      }
      throw e;
    }
  }
  clienteNombre(pedidoId: string): string {
    const s = this.stops().find((p) => p.pedido.id === pedidoId);
    return (
      s?.pedido.clienteNombre ||
      this.operations.pedidos().find((p) => p.id === pedidoId)?.clienteNombre ||
      'Pedido #' + this.operations.short(pedidoId)
    );
  }
  move(index: number, delta: number) {
    if (!this.canMove(index, delta)) return;
    const next = [...this.stops()];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    this.stops.set(next);
  }
  async confirm() {
    const route = this.route();
    if (!route || route.version == null || this.saving()) return;
    const gen = this.generation;
    this.saving.set(true);
    this.error.set('');
    try {
      const result = await this.ejecutarConRiesgo((forzar) =>
        this.operations.api.reordenarParadas(
          route.id,
          this.stops().map((s) => s.pedido.id),
          route.version!,
          forzar,
        ),
      );
      if (!result) return;
      if (gen !== this.generation) return;
      this.operations.rutas.update((all) => all.map((r) => (r.id === result.id ? result : r)));
      if (this.operations.selected()?.id === result.id) this.operations.selected.set(result);
      this.route.set(null);
      this.operations.message.set('Orden de paradas actualizado.');
      await this.operations.refresh();
    } catch (e: any) {
      if (gen !== this.generation) return;
      if (e?.status === 409) {
        this.saving.set(false);
        await this.open(route.id);
      }
      this.operations.showError(e);
      this.error.set(
        this.operations.error() +
          (e?.status === 409 ? ' Se recargó el orden actual; revisa y confirma nuevamente.' : ''),
      );
    } finally {
      if (gen === this.generation) this.saving.set(false);
    }
  }
  reset() {
    this.generation++;
    this.route.set(null);
    this.stops.set([]);
    this.pedidosEnRiesgo.set(null);
    this.resolverRiesgo?.(false);
    this.resolverRiesgo = undefined;
    this.saving.set(false);
    this.loading.set(false);
    this.error.set('');
  }
  close() {
    if (!this.saving()) this.reset();
  }
}

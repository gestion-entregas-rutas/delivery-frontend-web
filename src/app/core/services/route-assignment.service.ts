import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PedidoDto, RutaDto } from '../models/logistica.models';
import { LogisticaApiService } from './logistica-api.service';
import { OperationsService } from './operations.service';
@Injectable({ providedIn: 'root' })
export class RouteAssignmentService {
  private readonly api = inject(LogisticaApiService);
  private readonly operations = inject(OperationsService);
  readonly pedido = signal<PedidoDto | null>(null);
  readonly routes = signal<RutaDto[]>([]);
  readonly origin = signal<RutaDto | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  routeId = '';
  private generation = 0;
  async open(pedido: PedidoDto, preferredRouteId = '') {
    if (this.saving()) return;
    if (pedido.estado !== 'Pendiente' && pedido.estado !== 'AsignadoARuta') {
      this.operations.error.set(
        'Solo se pueden asignar pendientes o transferir pedidos asignados a una ruta.',
      );
      return;
    }
    const generation = ++this.generation;
    this.pedido.set(pedido);
    this.routes.set([]);
    this.origin.set(null);
    this.routeId = '';
    this.error.set('');
    this.loading.set(true);
    try {
      const routes = await firstValueFrom(this.api.listarRutas(pedido.fechaEntrega, pedido.zonaId));
      if (generation !== this.generation) return;
      const origin = pedido.rutaId ? routes.find((r) => r.id === pedido.rutaId) : null;
      if (
        pedido.estado === 'AsignadoARuta' &&
        (!origin || origin.version == null || !['Planificada', 'EnCurso'].includes(origin.estado))
      ) {
        this.error.set('No se pudo obtener una ruta de origen editable con versión vigente.');
        return;
      }
      this.origin.set(origin || null);
      this.routes.set(
        routes.filter(
          (r) =>
            r.fecha === pedido.fechaEntrega &&
            r.zonaId === pedido.zonaId &&
            r.id !== pedido.rutaId &&
            (r.estado === 'Planificada' || r.estado === 'EnCurso') &&
            r.paradas.length < r.capacidad,
        ),
      );
      if (this.routes().some((r) => r.id === preferredRouteId)) this.routeId = preferredRouteId;
    } catch (e) {
      if (generation === this.generation)
        this.error.set('No se pudieron consultar las rutas disponibles. Reintenta la consulta.');
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  reset() {
    this.generation++;
    this.pedido.set(null);
    this.routes.set([]);
    this.origin.set(null);
    this.error.set('');
    this.loading.set(false);
    this.saving.set(false);
  }
  close() {
    if (this.saving()) return;
    this.generation++;
    this.pedido.set(null);
    this.routes.set([]);
    this.origin.set(null);
    this.error.set('');
  }
  async confirm() {
    const p = this.pedido();
    if (!p || !this.routeId || this.saving()) return;
    const generation = this.generation;
    this.saving.set(true);
    this.error.set('');
    try {
      const origin = this.origin(),
        destino = this.routes().find((r) => r.id === this.routeId);
      if (!destino) throw new Error('Selecciona una ruta vigente.');
      if (origin) {
        if (origin.version == null || destino.version == null)
          throw new Error('Recarga las versiones de ambas rutas.');
        const result = await firstValueFrom(
          this.api.transferirPedido(origin.id, p.id, {
            destinoRutaId: destino.id,
            versionOrigen: origin.version,
            versionDestino: destino.version,
            posicion: null,
          }),
        );
        this.operations.rutas.update((all) =>
          all.map((r) =>
            r.id === result.origen.id
              ? result.origen
              : r.id === result.destino.id
                ? result.destino
                : r,
          ),
        );
      } else await firstValueFrom(this.api.agregarPedido(this.routeId, { pedidoId: p.id }));
      if (generation !== this.generation) return;
      this.pedido.set(null);
      this.operations.message.set(
        origin
          ? 'Pedido transferido a la ruta seleccionada.'
          : 'Pedido asignado a la ruta seleccionada.',
      );
      await this.operations.refresh();
    } catch (e: any) {
      if (generation !== this.generation) return;
      if (e?.status === 409) {
        this.saving.set(false);
        try {
          const current = await firstValueFrom(this.api.obtenerPedido(p.id));
          if (generation !== this.generation) return;
          await this.open(current);
        } catch {
          this.routeId = '';
        }
      }
      this.error.set(
        (e?.error?.detail ||
          e?.message ||
          'No se pudo asignar. Consulta nuevamente las rutas y revisa su capacidad.') +
          (e?.status === 409 ? ' Revisa los datos recargados y confirma nuevamente.' : '') +
          (e?.error?.traceId ? ' Referencia: ' + e.error.traceId : ''),
      );
    } finally {
      if (generation === this.generation) this.saving.set(false);
    }
  }
}

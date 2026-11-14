import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PedidoDto } from '../models/logistica.models';
import { LogisticaApiService } from './logistica-api.service';
@Injectable({ providedIn: 'root' })
export class PedidoDetailService {
  private api = inject(LogisticaApiService);
  readonly pedido = signal<PedidoDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  private generation = 0;
  async open(id: string) {
    const gen = ++this.generation;
    this.pedido.set(null);
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(this.api.obtenerPedido(id));
      if (gen === this.generation) this.pedido.set(p);
    } catch (e: any) {
      if (gen === this.generation)
        this.error.set(
          (e?.error?.detail || 'No se pudo consultar el detalle.') +
            (e?.error?.traceId ? ' Referencia: ' + e.error.traceId : ''),
        );
    } finally {
      if (gen === this.generation) this.loading.set(false);
    }
  }
  close() {
    this.generation++;
    this.pedido.set(null);
    this.loading.set(false);
    this.error.set('');
  }
}

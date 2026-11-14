import { Component, inject } from '@angular/core';
import { RouteOrderService } from '../../../core/services/route-order.service';
@Component({
  selector: 'app-route-order',
  template: ` @if (order.route() || order.loading() || order.error()) {
    <div class="legacy-ui">
      <div class="modal-backdrop" (click)="order.close()">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-route-title"
          (click)="$event.stopPropagation()"
        >
          <div class="panel-heading">
            <h2 id="order-route-title">Orden de paradas</h2>
            <button
              class="icon-button"
              aria-label="Cerrar"
              [disabled]="order.saving()"
              (click)="order.close()"
            >
              ×
            </button>
          </div>
          <div class="form-body">
            @if (order.loading()) {
              <p role="status">Consultando ruta…</p>
            }
            @if (order.error()) {
              <p role="alert">{{ order.error() }}</p>
            }
            @if (order.route()) {
              <p>Revisa la secuencia antes de confirmar. El tramo ya iniciado permanece fijo.</p>
              @for (stop of order.stops(); track stop.pedido.id; let i = $index) {
                <div class="stop">
                  <span class="stop-number">{{ i + 1 }}</span>
                  <div>
                    <strong>{{ stop.pedido.clienteNombre }}</strong>
                    <p>{{ stop.pedido.direccion }}</p>
                  </div>
                  <button
                    class="button"
                    [disabled]="!order.canMove(i, -1)"
                    (click)="order.move(i, -1)"
                    [attr.aria-label]="'Subir parada ' + (i + 1)"
                  >
                    ↑
                  </button>
                  <button
                    class="button"
                    [disabled]="!order.canMove(i, 1)"
                    (click)="order.move(i, 1)"
                    [attr.aria-label]="'Bajar parada ' + (i + 1)"
                  >
                    ↓
                  </button>
                </div>
              }
            }
          </div>
          <div class="modal-footer">
            <button class="button" [disabled]="order.saving()" (click)="order.close()">
              Cancelar</button
            ><button
              class="button primary"
              [disabled]="!order.route() || order.saving() || order.loading()"
              (click)="order.confirm()"
            >
              {{ order.saving() ? 'Guardando…' : 'Confirmar orden' }}
            </button>
          </div>
        </section>
      </div>
    </div>
  }`,
})
export class RouteOrder {
  readonly order = inject(RouteOrderService);
}

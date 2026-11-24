import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteOrderService } from '../../../core/services/route-order.service';
@Component({
  selector: 'app-route-order',
  imports: [CommonModule],
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

      @if (order.pedidosEnRiesgo()) {
        <div class="modal-backdrop" style="z-index: 1050;" (click)="order.responderRiesgo(false)">
          <section
            class="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="order-risk-title"
            (click)="$event.stopPropagation()"
            style="max-width: 440px;"
          >
            <div class="panel-heading">
              <h2 id="order-risk-title" style="color: #b26a00;">⚠️ Entregas en riesgo</h2>
            </div>
            <div class="form-body">
              <p style="margin: 0 0 10px; font-weight: 600;">
                Este cambio pondría en riesgo {{ order.pedidosEnRiesgo()!.length }} {{ order.pedidosEnRiesgo()!.length === 1 ? 'entrega' : 'entregas' }}:
              </p>
              <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                @for (item of order.pedidosEnRiesgo(); track item.pedidoId) {
                  <div style="padding: 8px 12px; background: #FFF9F2; border: 1px solid #FFE4C4; border-radius: 6px; font-size: 11px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600;">
                      <span>{{ order.clienteNombre(item.pedidoId) }}</span>
                      <span style="color: #c93b2b;">+{{ item.retrasoMinutos }} min</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: #636366; margin-top: 4px;">
                      <span>Límite: {{ item.limiteEn ? (item.limiteEn | date:'HH:mm':'America/Guayaquil') : 'Fin de jornada' }}</span>
                      <span>Estimado: {{ item.finalizacionEstimadaEn | date:'HH:mm':'America/Guayaquil' }}</span>
                    </div>
                  </div>
                }
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="button" (click)="order.responderRiesgo(false)">
                Cancelar
              </button>
              <button type="button" class="button danger" (click)="order.responderRiesgo(true)">
                Aplicar de todos modos
              </button>
            </div>
          </section>
        </div>
      }
    </div>
  }`,
})
export class RouteOrder {
  readonly order = inject(RouteOrderService);
}

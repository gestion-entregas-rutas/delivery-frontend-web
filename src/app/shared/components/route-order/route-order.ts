import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteOrderService } from '../../../core/services/route-order.service';
import { OperationsService } from '../../../core/services/operations.service';
import { RiskConfirmDialog } from '../risk-confirm-dialog/risk-confirm-dialog';
import { ventana } from '../../../core/utils/route-presentation';

@Component({
  selector: 'app-route-order',
  imports: [CommonModule, RiskConfirmDialog],
  template: `@if (order.route() || order.loading() || order.error()) {
    <div class="fixed inset-0 z-[1500] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="order-route-title">
      <div class="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm" (click)="!order.saving() && order.close()"></div>
      <section class="relative z-10 w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <header class="p-5 bg-surface-container-low flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 shrink-0 rounded-xl bg-primary text-on-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[22px]">reorder</span>
            </div>
            <div class="min-w-0">
              <h2 id="order-route-title" class="text-base font-semibold text-on-surface">Orden de paradas</h2>
              @if (order.route(); as r) {
                <p class="text-xs text-on-surface-variant truncate">{{ operations.driver(r.repartidorId) }} · Ruta {{ operations.zoneName(r.zonaId) }} #{{ operations.short(r.id) }}</p>
              }
            </div>
          </div>
          <button type="button" class="w-9 h-9 shrink-0 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center cursor-pointer" aria-label="Cerrar" [disabled]="order.saving()" (click)="order.close()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <div class="p-5 overflow-y-auto flex flex-col gap-3">
          @if (order.loading()) {
            <p class="flex items-center gap-2 text-sm text-on-surface-variant" role="status">
              <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Consultando ruta…
            </p>
          }
          @if (order.error()) {
            <p class="p-3 rounded-xl bg-status-urgent/10 text-status-urgent text-sm" role="alert">{{ order.error() }}</p>
          }
          @if (order.route()) {
            <p class="text-[13px] text-on-surface-variant">
              Usa las flechas para cambiar el orden de visita.
              @if (order.fixedPrefix() > 0) { Las paradas ya iniciadas quedan fijas. }
            </p>
            <ol class="flex flex-col gap-2">
              @for (stop of order.stops(); track stop.pedido.id; let i = $index; let first = $first; let last = $last) {
                <li class="flex items-center gap-3 p-3 rounded-xl border border-separator-hairline-light" [class.bg-surface-container-low]="i < order.fixedPrefix()">
                  <span class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold"
                        [class]="i < order.fixedPrefix() ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary text-on-primary'">{{ i + 1 }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-on-surface truncate">{{ stop.pedido.direccion }}</div>
                    <div class="text-xs text-on-surface-variant truncate">
                      {{ stop.pedido.clienteNombre }} · {{ ventanaDe(stop.pedido.compromisoInicioEn, stop.pedido.compromisoFinEn) }}
                      @if (i < order.fixedPrefix()) { · <span class="font-semibold">fija</span> }
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" class="w-8 h-8 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            [disabled]="!order.canMove(i, -1) || order.saving()" (click)="order.move(i, -1)" [attr.aria-label]="'Subir parada ' + (i + 1)">
                      <span class="material-symbols-outlined text-[18px]">arrow_upward</span>
                    </button>
                    <button type="button" class="w-8 h-8 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            [disabled]="!order.canMove(i, 1) || order.saving()" (click)="order.move(i, 1)" [attr.aria-label]="'Bajar parada ' + (i + 1)">
                      <span class="material-symbols-outlined text-[18px]">arrow_downward</span>
                    </button>
                  </div>
                </li>
              }
            </ol>
          }
        </div>

        <footer class="px-5 py-4 bg-surface-container-low flex items-center justify-end gap-2">
          <button type="button" class="px-4 py-2 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container-high text-sm font-semibold shadow-sm cursor-pointer" [disabled]="order.saving()" (click)="order.close()">Cancelar</button>
          <button type="button" class="inline-flex items-center gap-1 px-5 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-50"
                  [disabled]="!order.route() || order.saving() || order.loading()" (click)="order.confirm()">
            <span class="material-symbols-outlined text-[18px]">{{ order.saving() ? 'progress_activity' : 'check' }}</span>
            {{ order.saving() ? 'Guardando…' : 'Confirmar orden' }}
          </button>
        </footer>
      </section>
    </div>

    @if (order.pedidosEnRiesgo(); as riesgo) {
      <app-risk-confirm-dialog [items]="riesgo" [nombre]="nombre" (responder)="order.responderRiesgo($event)" />
    }
  }`,
})
export class RouteOrder {
  readonly order = inject(RouteOrderService);
  readonly operations = inject(OperationsService);
  readonly nombre = (id: string) => this.order.clienteNombre(id);
  ventanaDe(inicio?: string | null, fin?: string | null) {
    return ventana(inicio, fin) ?? 'horario flexible';
  }
}

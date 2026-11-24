import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteAssignmentService } from '../../../core/services/route-assignment.service';
import { OperationsService } from '../../../core/services/operations.service';
import { RiskConfirmDialog } from '../risk-confirm-dialog/risk-confirm-dialog';
import { ventana } from '../../../core/utils/route-presentation';

@Component({
  selector: 'app-route-assignment',
  imports: [CommonModule, FormsModule, RiskConfirmDialog],
  template: `@if (assignment.pedido(); as pedido) {
    <div class="fixed inset-0 z-[1500] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="assign-title">
      <div class="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm" (click)="!assignment.saving() && assignment.close()"></div>
      <section class="relative z-10 w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <header class="p-5 bg-surface-container-low flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 shrink-0 rounded-xl bg-primary text-on-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[22px]">{{ assignment.origin() ? 'swap_horiz' : 'add_road' }}</span>
            </div>
            <div class="min-w-0">
              <h2 id="assign-title" class="text-base font-semibold text-on-surface">{{ assignment.origin() ? 'Transferir pedido' : 'Asignar pedido a una ruta' }}</h2>
              <p class="text-xs text-on-surface-variant truncate">{{ pedido.clienteNombre }} · {{ pedido.direccion }}</p>
            </div>
          </div>
          <button type="button" class="w-9 h-9 shrink-0 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center cursor-pointer" aria-label="Cerrar" [disabled]="assignment.saving()" (click)="assignment.close()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <div class="p-5 overflow-y-auto flex flex-col gap-3">
          <div class="flex items-center gap-2 text-xs text-on-surface-variant">
            <span class="material-symbols-outlined text-[16px]">schedule</span>
            {{ pedido.fechaEntrega }} · {{ ventanaDe(pedido.compromisoInicioEn, pedido.compromisoFinEn) }} · {{ operations.zoneName(pedido.zonaId) }}
          </div>

          @if (assignment.error()) {
            <div class="p-3 rounded-xl bg-status-urgent/10 text-status-urgent text-sm flex items-center justify-between gap-2" role="alert">
              <span>{{ assignment.error() }}</span>
              <button type="button" class="shrink-0 px-3 py-1 rounded-lg bg-status-urgent text-white text-xs font-semibold cursor-pointer" [disabled]="assignment.saving()" (click)="assignment.open(pedido)">Reintentar</button>
            </div>
          }

          <span class="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Rutas de la misma zona y fecha</span>
          @if (assignment.loading()) {
            <p class="flex items-center gap-2 text-sm text-on-surface-variant" role="status">
              <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Consultando rutas…
            </p>
          } @else if (!assignment.routes().length) {
            <div class="p-4 rounded-xl bg-surface-container-low text-center">
              <span class="material-symbols-outlined text-[24px] text-on-surface-variant">alt_route</span>
              <p class="text-sm font-semibold text-on-surface mt-1">No hay rutas con cupo</p>
              <p class="text-xs text-on-surface-variant">Genera rutas desde Optimización de Rutas.</p>
            </div>
          } @else {
            <div class="flex flex-col gap-2" role="radiogroup" aria-label="Ruta destino">
              @for (r of assignment.routes(); track r.id) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="assignment.routeId === r.id"
                  class="flex items-center gap-3 p-3 rounded-xl text-left transition-colors cursor-pointer"
                  [class]="assignment.routeId === r.id ? 'border-2 border-primary bg-surface-container' : 'border border-separator-hairline-light hover:bg-surface-container-low'"
                  [disabled]="assignment.saving()"
                  (click)="assignment.routeId = r.id"
                >
                  <span class="w-9 h-9 shrink-0 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center text-xs font-semibold">{{ r.paradas.length }}/{{ r.capacidad }}</span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-sm font-semibold text-on-surface truncate">{{ operations.driver(r.repartidorId) }}</span>
                    <span class="block text-xs text-on-surface-variant">#{{ operations.short(r.id) }} · {{ cupos(r.capacidad - r.paradas.length) }}</span>
                  </span>
                  <span class="material-symbols-outlined text-[20px]" [class]="assignment.routeId === r.id ? 'text-primary' : 'text-outline-variant'">{{ assignment.routeId === r.id ? 'radio_button_checked' : 'radio_button_unchecked' }}</span>
                </button>
              }
            </div>
          }
        </div>

        <footer class="px-5 py-4 bg-surface-container-low flex items-center justify-end gap-2">
          <button type="button" class="px-4 py-2 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container-high text-sm font-semibold shadow-sm cursor-pointer" [disabled]="assignment.saving()" (click)="assignment.close()">Cancelar</button>
          <button type="button" class="inline-flex items-center gap-1 px-5 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-50"
                  [disabled]="!assignment.routeId || assignment.saving() || assignment.loading()" (click)="assignment.confirm()">
            <span class="material-symbols-outlined text-[18px]">{{ assignment.saving() ? 'progress_activity' : 'check' }}</span>
            {{ assignment.saving() ? 'Asignando…' : assignment.origin() ? 'Confirmar transferencia' : 'Confirmar asignación' }}
          </button>
        </footer>
      </section>
    </div>

    @if (assignment.pedidosEnRiesgo(); as riesgo) {
      <app-risk-confirm-dialog [items]="riesgo" [nombre]="nombre" (responder)="assignment.responderRiesgo($event)" />
    }
  }`,
})
export class RouteAssignment {
  readonly assignment = inject(RouteAssignmentService);
  readonly operations = inject(OperationsService);
  readonly nombre = (id: string) => this.assignment.clienteNombre(id);
  ventanaDe(inicio?: string | null, fin?: string | null) {
    return ventana(inicio, fin) ?? 'horario flexible';
  }
  cupos(n: number) {
    return n === 1 ? '1 cupo libre' : n + ' cupos libres';
  }
}

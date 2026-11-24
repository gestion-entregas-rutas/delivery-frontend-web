import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PedidoEnRiesgo } from '../../../core/models/logistica.models';

/** Confirmación cuando un cambio de ruta haría llegar tarde a otras entregas (409 CAMBIO_PONE_EN_RIESGO). */
@Component({
  selector: 'app-risk-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[1600] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="riesgo-titulo" aria-describedby="riesgo-desc">
      <div class="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm" (click)="responder.emit(false)"></div>
      <section class="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden">
        <div class="p-5 flex items-start gap-3">
          <div class="w-10 h-10 shrink-0 rounded-xl bg-surface-container text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-[22px]">warning</span>
          </div>
          <div class="min-w-0">
            <h2 id="riesgo-titulo" class="text-base font-semibold text-on-surface">Entregas en riesgo</h2>
            <p id="riesgo-desc" class="text-[13px] text-on-surface-variant mt-0.5">
              Con este cambio {{ items.length === 1 ? '1 entrega no llegaría' : items.length + ' entregas no llegarían' }} dentro de su horario comprometido.
            </p>
          </div>
        </div>

        <ul class="px-5 pb-4 flex flex-col gap-2 max-h-[240px] overflow-y-auto">
          @for (item of items; track item.pedidoId) {
            <li class="p-3 rounded-xl bg-surface-container-low flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold text-on-surface truncate">{{ nombre(item.pedidoId) }}</div>
                <div class="text-xs text-on-surface-variant tabular-nums">
                  Límite {{ item.limiteEn ? (item.limiteEn | date: 'HH:mm' : 'America/Guayaquil') : 'fin de jornada' }}
                  · llegaría {{ item.finalizacionEstimadaEn | date: 'HH:mm' : 'America/Guayaquil' }}
                </div>
              </div>
              <span class="shrink-0 px-2 py-0.5 rounded-full bg-status-urgent/10 text-status-urgent text-xs font-semibold tabular-nums">+{{ item.retrasoMinutos ?? 0 }} min</span>
            </li>
          }
        </ul>

        <div class="px-5 py-4 bg-surface-container-low flex items-center justify-end gap-2">
          <button type="button" class="px-4 py-2 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container-high text-sm font-semibold whitespace-nowrap shadow-sm cursor-pointer" (click)="responder.emit(false)">
            Cancelar
          </button>
          <button type="button" class="px-4 py-2 rounded-xl bg-status-urgent text-white hover:brightness-110 text-sm font-semibold whitespace-nowrap shadow-sm cursor-pointer" (click)="responder.emit(true)">
            Aplicar igualmente
          </button>
        </div>
      </section>
    </div>
  `,
})
export class RiskConfirmDialog {
  @Input({ required: true }) items: PedidoEnRiesgo[] = [];
  @Input({ required: true }) nombre: (pedidoId: string) => string = (id) => id;
  @Output() responder = new EventEmitter<boolean>();
  @HostListener('document:keydown.escape') onEscape() { this.responder.emit(false); }
}

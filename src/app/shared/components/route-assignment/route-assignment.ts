import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteAssignmentService } from '../../../core/services/route-assignment.service';
import { OperationsService } from '../../../core/services/operations.service';
@Component({
  selector: 'app-route-assignment',
  imports: [CommonModule, FormsModule],
  template: `@if (assignment.pedido()) {
    <div class="legacy-ui">
      <div class="modal-backdrop" (click)="assignment.close()">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-title"
          (click)="$event.stopPropagation()"
        >
          <div class="panel-heading">
            <div>
              <h2 id="assign-title">{{assignment.origin() ? 'Transferir pedido entre rutas' : 'Asignar pedido a una ruta'}}</h2>
              <p>
                {{ assignment.pedido()!.clienteNombre }} · {{ assignment.pedido()!.fechaEntrega }}
              </p>
            </div>
            <button
              class="icon-button"
              aria-label="Cerrar"
              [disabled]="assignment.saving()"
              (click)="assignment.close()"
            >
              ×
            </button>
          </div>
          <div class="form-body">
            @if (assignment.error()) {
              <div class="notice error" role="alert">
                {{ assignment.error()
                }}<button
                  (click)="assignment.open(assignment.pedido()!)"
                  [disabled]="assignment.saving()"
                >
                  Reintentar
                </button>
              </div>
            }
            <label
              >Ruta de la misma zona y fecha<select
                [(ngModel)]="assignment.routeId"
                [disabled]="assignment.loading() || assignment.saving()"
              >
                <option value="">
                  {{ assignment.loading() ? 'Consultando rutas…' : 'Selecciona una ruta' }}
                </option>
                @for (r of assignment.routes(); track r.id) {
                  <option [value]="r.id">
                    #{{ operations.short(r.id) }} · {{ operations.driver(r.repartidorId) }} ·
                    {{ r.paradas.length }}/{{ r.capacidad }}
                  </option>
                }
              </select></label
            >
            @if (!assignment.loading() && !assignment.routes().length) {
              <p class="form-hint">
                No hay rutas con cupo disponible en esta zona y fecha. Puedes generar las rutas
                desde Armado y Optimización.
              </p>
            }
          </div>
          <div class="modal-footer">
            <button class="button" [disabled]="assignment.saving()" (click)="assignment.close()">
              Cancelar</button
            ><button
              class="button primary"
              [disabled]="!assignment.routeId || assignment.saving() || assignment.loading()"
              (click)="assignment.confirm()"
            >
              {{ assignment.saving() ? 'Asignando…' : 'Confirmar asignación' }}
            </button>
          </div>
        </section>
      </div>

      @if (assignment.pedidosEnRiesgo()) {
        <div class="modal-backdrop" style="z-index: 1050;" (click)="assignment.responderRiesgo(false)">
          <section
            class="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="assign-risk-title"
            (click)="$event.stopPropagation()"
            style="max-width: 440px;"
          >
            <div class="panel-heading">
              <h2 id="assign-risk-title" style="color: #b26a00;">⚠️ Entregas en riesgo</h2>
            </div>
            <div class="form-body">
              <p style="margin: 0 0 10px; font-weight: 600;">
                Este cambio pondría en riesgo {{ assignment.pedidosEnRiesgo()!.length }} {{ assignment.pedidosEnRiesgo()!.length === 1 ? 'entrega' : 'entregas' }}:
              </p>
              <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                @for (item of assignment.pedidosEnRiesgo(); track item.pedidoId) {
                  <div style="padding: 8px 12px; background: #FFF9F2; border: 1px solid #FFE4C4; border-radius: 6px; font-size: 11px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600;">
                      <span>{{ assignment.clienteNombre(item.pedidoId) }}</span>
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
              <button type="button" class="button" (click)="assignment.responderRiesgo(false)">
                Cancelar
              </button>
              <button type="button" class="button danger" (click)="assignment.responderRiesgo(true)">
                Aplicar de todos modos
              </button>
            </div>
          </section>
        </div>
      }
    </div>
  }`,
})
export class RouteAssignment {
  readonly assignment = inject(RouteAssignmentService);
  readonly operations = inject(OperationsService);
}

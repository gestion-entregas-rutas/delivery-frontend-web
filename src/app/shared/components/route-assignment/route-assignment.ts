import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouteAssignmentService } from '../../../core/services/route-assignment.service';
import { OperationsService } from '../../../core/services/operations.service';
@Component({
  selector: 'app-route-assignment',
  imports: [FormsModule],
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
    </div>
  }`,
})
export class RouteAssignment {
  readonly assignment = inject(RouteAssignmentService);
  readonly operations = inject(OperationsService);
}

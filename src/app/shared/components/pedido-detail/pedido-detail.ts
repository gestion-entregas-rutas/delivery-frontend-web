import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { PedidoDetailService } from '../../../core/services/pedido-detail.service';
import { OperationsService } from '../../../core/services/operations.service';
@Component({
  selector: 'app-pedido-detail',
  imports: [CommonModule],
  template: `@if (detail.pedido() || detail.loading() || detail.error()) {
    <div class="legacy-ui">
      <div class="modal-backdrop" (click)="!operations.saving() && detail.close()">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pedido-detail-title"
          (click)="$event.stopPropagation()"
        >
          <div class="panel-heading">
            <h2 id="pedido-detail-title">Detalle del pedido</h2>
            <button
              class="icon-button"
              aria-label="Cerrar detalle"
              [disabled]="operations.saving()"
              (click)="detail.close()"
            >
              ×
            </button>
          </div>
          <div class="form-body">
            @if (detail.loading()) {
              <p role="status">Consultando pedido…</p>
            }
            @if (detail.error()) {
              <p role="alert">{{ detail.error() }}</p>
            }
            @if (detail.pedido(); as p) {
              <p>
                <strong>{{ p.clienteNombre }}</strong> · {{ p.clienteTelefono }}
              </p>
              <p>{{ p.direccion }}</p>
              <p>Zona: {{ operations.zoneName(p.zonaId) }}</p>
              <p>Estado: {{ operations.label(p.estado) }}</p>
              <p>Entrega programada: {{ p.fechaEntrega }} · {{ p.horaEntrega }}</p>
              <p>Registrado: {{ p.registradoEn | date: 'dd/MM/yyyy HH:mm' }}</p>
              <p>Remitente: {{p.detalles?.remitenteNombre || 'No informado'}} · {{p.detalles?.remitenteTelefono || 'No informado'}}</p>
              <p>Correo del remitente: {{p.detalles?.remitenteCorreo || 'No informado'}}</p>
              <p>Correo del destinatario: {{p.detalles?.destinatarioCorreo || 'No informado'}}</p>
              <p>Carga: {{p.detalles?.tipoCarga || 'No informada'}} · Peso: {{p.detalles?.pesoKg != null ? p.detalles!.pesoKg + ' kg' : 'No informado'}}</p>
              <p>Fragilidad: {{p.detalles?.fragil == null ? 'No informada' : p.detalles!.fragil ? 'Frágil' : 'No frágil'}} · Prioridad: {{p.detalles?.prioridad || 'No informada'}}</p>
              <p>Observaciones: {{p.detalles?.observaciones || 'No informadas'}}</p>
              <p>
                Entrega confirmada:
                {{
                  p.entregadoEn
                    ? (p.entregadoEn | date: 'dd/MM/yyyy HH:mm')
                    : 'Sin entrega confirmada'
                }}
              </p>
              @if (p.rutaId) {
                <button
                  class="button"
                  [disabled]="operations.saving()"
                  (click)="operations.showOrderRoute(p.rutaId); detail.close()"
                >
                  Ver ruta #{{ operations.short(p.rutaId) }}
                </button>
              }
              @if (operations.error()) {
                <p role="alert">{{ operations.error() }}</p>
              }
            }
          </div>
          <div class="modal-footer">
            @if (detail.pedido(); as p) {
              @if (p.estado === 'Pendiente') {
                <button
                  class="button danger"
                  [disabled]="operations.saving()"
                  (click)="run(operations.api.cancelarPedido(p.id), 'Pedido cancelado.')"
                >
                  Cancelar pedido
                </button>
              }
              @if (p.estado === 'AsignadoARuta' && operations.canAdvance(p)) {
                <button
                  class="button primary"
                  [disabled]="operations.saving()"
                  (click)="run(operations.api.marcarEnCamino(p.id), 'Pedido en camino.')"
                >
                  Marcar en camino
                </button>
              }
              @if (p.estado === 'EnCamino') {
                <button
                  class="button primary"
                  [disabled]="operations.saving()"
                  (click)="run(operations.api.registrarEntrega(p.id), 'Entrega registrada.')"
                >
                  Confirmar entrega
                </button>
              }
            }
            <button class="button" [disabled]="operations.saving()" (click)="detail.close()">
              Cerrar
            </button>
          </div>
        </section>
      </div>
    </div>
  }`,
})
export class PedidoDetail {
  readonly detail = inject(PedidoDetailService);
  readonly operations = inject(OperationsService);
  async run(request: Observable<unknown>, success: string) {
    const p = this.detail.pedido();
    if (p && (await this.operations.action(request, success))) await this.detail.open(p.id);
  }
}

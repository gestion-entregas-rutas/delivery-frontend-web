import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ZonaDto, PuntoDto } from '../models/logistica.models';
import { OperationsService } from './operations.service';
@Injectable({ providedIn: 'root' })
export class OperationFormsService {
  private readonly operations = inject(OperationsService);
  readonly modal = signal('');
  form: any = {};
  zonePoints: PuntoDto[] = [];
  open(type: string, zone?: ZonaDto) {
    this.operations.error.set('');
    this.zonePoints = zone ? zone.poligono.map((p) => ({ ...p })) : [];
    this.form = zone
      ? { ...zone }
      : {
          fechaEntrega: this.operations.fecha,
          horaEntrega: '12:00',
          capacidadMaxima: 4,
          maxPedidosPorRuta: 4,
          latitud: undefined,
          longitud: undefined,
          activa: true,
        };
    this.modal.set(type);
  }
  setDeliveryLocation(point: { latitud: number; longitud: number } | null) {
    this.form.latitud = point?.latitud;
    this.form.longitud = point?.longitud;
  }
  hasDeliveryLocation() {
    return Number.isFinite(this.form.latitud) && Number.isFinite(this.form.longitud);
  }
  async save() {
    this.operations.saving.set(true);
    this.operations.error.set('');
    try {
      if (this.modal() === 'Pedido') {
        if (!this.hasDeliveryLocation())
          throw new Error('Selecciona la ubicación de entrega en el mapa antes de guardar.');
        const result = await firstValueFrom(
          this.operations.api.registrarPedido({
            ...this.form,
            zonaId: this.form.zonaId || undefined,
            horaEntrega:
              this.form.horaEntrega.length === 5
                ? this.form.horaEntrega + ':00'
                : this.form.horaEntrega,
          }),
        );
        this.operations.message.set(
          result.asignacion?.tipo === 'EnEspera'
            ? 'Pedido registrado. En espera de asignación.'
            : 'Pedido registrado correctamente.',
        );
      }
      if (this.modal() === 'Repartidor') {
        await firstValueFrom(this.operations.api.crearRepartidor(this.form));
        this.operations.message.set('Repartidor registrado.');
      }
      if (this.modal() === 'Zona') {
        const poligono = this.zonePoints.map((p) => ({ ...p }));
        if (
          poligono.length < 3 ||
          poligono.some(
            (p) =>
              !Number.isFinite(p.latitud) ||
              !Number.isFinite(p.longitud) ||
              Math.abs(p.latitud) > 90 ||
              Math.abs(p.longitud) > 180,
          )
        )
          throw new Error('Marca al menos tres puntos válidos en el mapa para definir la zona.');
        if (
          poligono[0].latitud === poligono.at(-1)!.latitud &&
          poligono[0].longitud === poligono.at(-1)!.longitud
        )
          throw new Error('No repitas el primer vértice al final.');
        const body = { ...this.form, poligono };
        await firstValueFrom(
          this.form.id
            ? this.operations.api.actualizarZona(this.form.id, body)
            : this.operations.api.crearZona(body),
        );
        this.operations.message.set('Zona guardada.');
      }
      this.modal.set('');
      await this.operations.refresh();
    } catch (e) {
      this.operations.showError(e);
    } finally {
      this.operations.saving.set(false);
    }
  }
}

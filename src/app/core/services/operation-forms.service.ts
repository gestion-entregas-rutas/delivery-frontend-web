import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ZonaDto, PuntoDto } from '../models/logistica.models';
import { OperationsService } from './operations.service';
import { LocalLocationService } from './local-location.service';
import { zoneGeometryError } from '../utils/zone-geometry';
@Injectable({ providedIn: 'root' })
export class OperationFormsService {
  private readonly operations = inject(OperationsService);
  readonly local = inject(LocalLocationService);
  readonly modal = signal('');
  form: any = {};
  zonePoints: PuntoDto[] = [];
  open(type: string, zone?: ZonaDto) {
    if (this.operations.saving()) return;
    this.operations.error.set('');
    if (type === 'Local') {
      const local = this.local.location();
      this.form = {
        nombre: local?.nombre || 'Mi local',
        direccion: local?.direccion || '',
        latitud: local?.ubicacion.latitud,
        longitud: local?.ubicacion.longitud,
      };
      this.modal.set(type);
      return;
    }
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
  zoneError() {
    return zoneGeometryError(this.zonePoints);
  }
  async save() {
    if (this.operations.saving()) return;
    this.operations.saving.set(true);
    this.operations.error.set('');
    try {
      if (this.modal() === 'Local') {
        if (!this.hasDeliveryLocation())
          throw new Error('Selecciona la ubicación del local en el mapa.');
        if (
          !this.local.save({
            nombre: this.form.nombre,
            direccion: this.form.direccion,
            ubicacion: { latitud: this.form.latitud, longitud: this.form.longitud },
          })
        )
          throw new Error(this.local.error());
        const errorServidor = await this.local.subir(this.operations.api, this.local.location()!);
        if (errorServidor) throw new Error(errorServidor);
        this.operations.message.set('Ubicación del local guardada. La tienda ya puede calcular horarios de entrega.');
        this.modal.set('');
        return;
      }
      if (this.modal() === 'Repartidor') {
        const nombre = String(this.form.nombre || '').trim();
        const telefono = String(this.form.telefono || '').trim();
        const capacidadMaxima = Number(this.form.capacidadMaxima);
        if (!nombre || nombre.length < 3 || nombre.length > 150) {
          throw new Error('El nombre completo es obligatorio y debe tener entre 3 y 150 caracteres.');
        }
        if (!telefono || telefono.replace(/\D/g, '').length < 7) {
          throw new Error('El teléfono es obligatorio y debe tener un formato válido.');
        }
        if (!Number.isInteger(capacidadMaxima) || capacidadMaxima < 1) {
          throw new Error('La capacidad máxima debe ser un número entero mayor o igual a 1.');
        }
        const body = {
          nombre,
          telefono,
          capacidadMaxima,
        };
        await firstValueFrom(this.operations.api.crearRepartidor(body));
        this.operations.message.set('Repartidor registrado.');
      }
      if (this.modal() === 'Zona') {
        const poligono = this.zonePoints.map((p) => ({ ...p }));
        const geometryError = zoneGeometryError(poligono);
        if (geometryError) throw new Error(geometryError);
        const nombre = String(this.form.nombre || '').trim();
        if (!nombre || nombre.length > 100)
          throw new Error('El nombre de la zona es obligatorio y admite hasta 100 caracteres.');
        if (!Number.isInteger(this.form.maxPedidosPorRuta) || this.form.maxPedidosPorRuta < 1)
          throw new Error('La capacidad por ruta debe ser un número entero mayor que cero.');
        const body = {
          nombre,
          poligono,
          maxPedidosPorRuta: this.form.maxPedidosPorRuta,
          activa: !!this.form.activa,
        };
        await firstValueFrom(
          this.form.id
            ? this.operations.api.actualizarZona(this.form.id, body)
            : this.operations.api.crearZona({
                nombre,
                poligono,
                maxPedidosPorRuta: body.maxPedidosPorRuta,
              }),
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

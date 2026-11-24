import { Injectable, afterNextRender, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LocalLocation } from '../models/local.models';
import type { LogisticaApiService } from './logistica-api.service';

const STORAGE_KEY = 'delivery.local-location.v1';

@Injectable({ providedIn: 'root' })
export class LocalLocationService {
  readonly location = signal<LocalLocation | null>(null);
  readonly error = signal('');
  constructor() {
    afterNextRender(() => this.load());
  }
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const value: unknown = JSON.parse(raw);
      if (!this.valid(value)) {
        this.error.set('La ubicación guardada no es válida. Configura nuevamente el local.');
        return;
      }
      this.location.set(value);
      this.error.set('');
    } catch {
      this.error.set('No se pudo leer la ubicación guardada en este navegador.');
    }
  }
  /**
   * Trae la ubicación guardada en el servidor (la usan la tienda y el armado de rutas).
   * Si el servidor no tiene una y este navegador sí, la sube para no perderla.
   */
  async sincronizar(api: LogisticaApiService) {
    try {
      const remoto = await firstValueFrom(api.obtenerLocal());
      if (remoto) {
        this.guardarEnNavegador({
          nombre: remoto.nombre,
          direccion: remoto.direccion,
          ubicacion: { latitud: remoto.latitud, longitud: remoto.longitud },
        });
      } else if (this.location()) {
        await this.subir(api, this.location()!);
      }
    } catch {
      // Sin conexión o backend anterior: se conserva la copia del navegador.
    }
  }
  /** Guarda en el servidor; devuelve un mensaje de error o '' si se guardó. */
  async subir(api: LogisticaApiService, value: LocalLocation): Promise<string> {
    try {
      await firstValueFrom(api.guardarLocal({
        nombre: value.nombre.trim(),
        direccion: value.direccion.trim(),
        latitud: value.ubicacion.latitud,
        longitud: value.ubicacion.longitud,
      }));
      return '';
    } catch {
      return 'No se pudo guardar la ubicación en el servidor; la tienda no podrá calcular horarios hasta guardarla.';
    }
  }
  private guardarEnNavegador(value: LocalLocation) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* el navegador no permite guardar: se mantiene en memoria */
    }
    this.location.set(value);
    this.error.set('');
  }
  save(value: LocalLocation): boolean {
    if (!this.valid(value)) {
      this.error.set(
        'Completa el nombre, la dirección y selecciona la ubicación del local en el mapa.',
      );
      return false;
    }
    const next = {
      nombre: value.nombre.trim(),
      direccion: value.direccion.trim(),
      ubicacion: { ...value.ubicacion },
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.location.set(next);
      this.error.set('');
      return true;
    } catch {
      this.error.set(
        'No se pudo guardar la ubicación. Comprueba que el navegador permita almacenar datos.',
      );
      return false;
    }
  }
  private valid(value: unknown): value is LocalLocation {
    const v = value as LocalLocation | null;
    return (
      !!v &&
      typeof v.nombre === 'string' &&
      !!v.nombre.trim() &&
      v.nombre.length <= 150 &&
      typeof v.direccion === 'string' &&
      !!v.direccion.trim() &&
      v.direccion.length <= 300 &&
      !!v.ubicacion &&
      Number.isFinite(v.ubicacion.latitud) &&
      Math.abs(v.ubicacion.latitud) <= 90 &&
      Number.isFinite(v.ubicacion.longitud) &&
      Math.abs(v.ubicacion.longitud) <= 180
    );
  }
}

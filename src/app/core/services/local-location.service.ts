import { Injectable, afterNextRender, signal } from '@angular/core';
import { LocalLocation } from '../models/local.models';

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

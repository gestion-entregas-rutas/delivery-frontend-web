import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../../core/services/operations.service';
import { OperationFormsService } from '../../../core/services/operation-forms.service';
import { ZoneMapPicker } from '../zone-map-picker/zone-map-picker';
import { AddressPicker } from '../address-picker/address-picker';

@Component({
  selector: 'app-operation-form',
  standalone: true,
  host: { class: 'legacy-ui' },
  imports: [CommonModule, FormsModule, AddressPicker, ZoneMapPicker],
  templateUrl: './operation-form.html',
  styleUrl: './operation-form.css',
})
export class OperationForm {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);
  readonly localPoint = this.forms.local.location;

  // Form field signals to ensure Angular computed() tracks all changes reactively
  readonly nombre = signal('');
  readonly telefono = signal('');
  readonly capacidad = signal(4);

  // Validation touched states for Repartidor
  readonly nombreTouched = signal(false);
  readonly telefonoTouched = signal(false);
  readonly capacidadTouched = signal(false);

  /** Dirección obtenida del punto del mapa; el usuario puede editarla libremente. */
  readonly direccionSugerida = signal('');
  private direccionAutocompletada = '';

  constructor() {
    effect(() => {
      const modal = this.forms.modal();
      if (modal === 'Local') {
        untracked(() => {
          this.direccionSugerida.set('');
          this.direccionAutocompletada = '';
        });
      }
      if (modal === 'Repartidor') {
        untracked(() => {
          this.nombre.set(this.forms.form?.nombre || '');
          this.telefono.set(this.forms.form?.telefono || '');
          this.capacidad.set(Number(this.forms.form?.capacidadMaxima) || 4);
          this.resetTouched();
        });
      }
    });
  }

  /**
   * Rellena la dirección solo si está vacía o si todavía es la que se autocompletó.
   * Si el usuario ya la escribió, se ofrece como sugerencia sin pisar su texto.
   */
  onDireccionSugerida(direccion: string) {
    this.direccionSugerida.set(direccion);
    const actual = (this.forms.form.direccion || '').trim();
    if (!actual || actual === this.direccionAutocompletada) this.usarDireccionSugerida();
  }

  usarDireccionSugerida() {
    const direccion = this.direccionSugerida();
    if (!direccion) return;
    this.forms.form.direccion = direccion.slice(0, 300);
    this.direccionAutocompletada = this.forms.form.direccion;
  }

  // Field error evaluations
  readonly nombreError = computed(() => {
    const val = this.nombre().trim();
    if (!val) return 'El nombre completo es obligatorio.';
    if (val.length < 3) return 'El nombre debe tener al menos 3 caracteres.';
    if (val.length > 150) return 'El nombre no puede exceder 150 caracteres.';
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/.test(val)) {
      return 'El nombre contiene caracteres no permitidos.';
    }
    return '';
  });

  readonly telefonoError = computed(() => {
    const raw = this.telefono().trim();
    if (!raw) return 'El número de teléfono es obligatorio.';
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return 'Ingresa un número telefónico válido (entre 7 y 15 dígitos).';
    }
    return '';
  });

  readonly capacidadError = computed(() => {
    const val = Number(this.capacidad());
    if (!Number.isInteger(val) || val < 1) {
      return 'La capacidad debe ser un número entero mayor o igual a 1.';
    }
    if (val > 50) {
      return 'La capacidad máxima recomendada por salida es de 50 pedidos.';
    }
    return '';
  });

  readonly isRepartidorValid = computed(() => {
    return !this.nombreError() && !this.telefonoError() && !this.capacidadError();
  });

  onNombreInput(val: string) {
    this.nombre.set(val);
    this.forms.form.nombre = val;
    this.nombreTouched.set(true);
  }

  onTelefonoInput(val: string) {
    this.telefono.set(val);
    this.forms.form.telefono = val;
    this.telefonoTouched.set(true);
  }

  onCapacidadInput(val: any) {
    const num = Number(val);
    this.capacidad.set(num);
    this.forms.form.capacidadMaxima = num;
    this.capacidadTouched.set(true);
  }

  adjustCapacity(delta: number) {
    const current = Number(this.capacidad()) || 4;
    const next = Math.max(1, Math.min(50, current + delta));
    this.capacidad.set(next);
    this.forms.form.capacidadMaxima = next;
    this.capacidadTouched.set(true);
  }

  setCapacity(val: number) {
    this.capacidad.set(val);
    this.forms.form.capacidadMaxima = val;
    this.capacidadTouched.set(true);
  }

  closeModal() {
    if (this.operations.saving()) return;
    this.resetTouched();
    this.forms.modal.set('');
  }

  resetTouched() {
    this.nombreTouched.set(false);
    this.telefonoTouched.set(false);
    this.capacidadTouched.set(false);
  }

  async submitForm() {
    if (this.forms.modal() === 'Repartidor') {
      this.nombreTouched.set(true);
      this.telefonoTouched.set(true);
      this.capacidadTouched.set(true);
      if (!this.isRepartidorValid()) return;
      this.forms.form.nombre = this.nombre();
      this.forms.form.telefono = this.telefono();
      this.forms.form.capacidadMaxima = this.capacidad();
    }
    await this.forms.save();
    if (!this.operations.error()) {
      this.resetTouched();
    }
  }
}

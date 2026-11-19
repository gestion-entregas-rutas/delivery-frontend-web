import { Component, computed, inject, signal } from '@angular/core';
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

  // Validation touched states for Repartidor
  readonly nombreTouched = signal(false);
  readonly telefonoTouched = signal(false);
  readonly capacidadTouched = signal(false);

  // Field error evaluations
  readonly nombreError = computed(() => {
    const val = (this.forms.form?.nombre || '').trim();
    if (!val) return 'El nombre completo es obligatorio.';
    if (val.length < 3) return 'El nombre debe tener al menos 3 caracteres.';
    if (val.length > 150) return 'El nombre no puede exceder 150 caracteres.';
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/.test(val)) {
      return 'El nombre contiene caracteres no permitidos.';
    }
    return '';
  });

  readonly telefonoError = computed(() => {
    const raw = (this.forms.form?.telefono || '').trim();
    if (!raw) return 'El número de teléfono es obligatorio.';
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return 'Ingresa un número telefónico válido (entre 7 y 15 dígitos).';
    }
    return '';
  });

  readonly capacidadError = computed(() => {
    const raw = this.forms.form?.capacidadMaxima;
    if (raw === undefined || raw === null || raw === '') {
      return 'La capacidad por salida es obligatoria.';
    }
    const val = Number(raw);
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

  adjustCapacity(delta: number) {
    const current = Number(this.forms.form?.capacidadMaxima) || 4;
    const next = Math.max(1, Math.min(50, current + delta));
    this.forms.form.capacidadMaxima = next;
    this.capacidadTouched.set(true);
  }

  setCapacity(val: number) {
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
    }
    await this.forms.save();
    if (!this.operations.error()) {
      this.resetTouched();
    }
  }
}

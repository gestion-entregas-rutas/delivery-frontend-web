import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CLAVE_PATTERN, errorAutenticacion } from '../../core/models/autenticacion.models';
@Component({
  selector: 'app-credenciales-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './credenciales.page.html',
  styleUrl: '../../shared/auth-page.css',
})
export class CredencialesPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly pattern = CLAVE_PATTERN;
  readonly busy = signal(false);
  readonly error = signal('');

  readonly verClaveActual = signal(false);
  readonly verNuevaClave = signal(false);
  readonly verConfirmacion = signal(false);

  nombreUsuario = this.auth.usuario()?.nombreUsuario || '';
  claveActual = '';
  nuevaClave = '';
  confirmacion = '';

  tieneMayuscula(): boolean {
    return /[A-Z]/.test(this.nuevaClave);
  }

  tieneMinuscula(): boolean {
    return /[a-z]/.test(this.nuevaClave);
  }

  tieneNumero(): boolean {
    return /[0-9]/.test(this.nuevaClave);
  }

  tieneSimbolo(): boolean {
    return /[^a-zA-Z0-9]/.test(this.nuevaClave);
  }

  generarClaveSegura() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*-_=+';
    const all = upper + lower + digits + symbols;

    const pass = [
      upper[Math.floor(Math.random() * upper.length)],
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      digits[Math.floor(Math.random() * digits.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];

    while (pass.length < 14) {
      pass.push(all[Math.floor(Math.random() * all.length)]);
    }

    for (let i = pass.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pass[i], pass[j]] = [pass[j], pass[i]];
    }

    const clave = pass.join('');
    this.nuevaClave = clave;
    this.confirmacion = clave;
    this.verNuevaClave.set(true);
    this.verConfirmacion.set(true);
  }
  async submit() {
    if (this.busy()) return;
    if (this.nuevaClave !== this.confirmacion) {
      this.error.set('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (this.nuevaClave === this.claveActual) {
      this.error.set('La nueva contraseña debe ser diferente a la actual.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.cambiarCredenciales({
        claveActual: this.claveActual,
        nuevoNombreUsuario: this.nombreUsuario.trim(),
        nuevaClave: this.nuevaClave,
      });
      this.clearPasswords();
      await this.router.navigateByUrl('/resumen');
    } catch (e) {
      this.error.set(errorAutenticacion(e));
    } finally {
      this.busy.set(false);
    }
  }
  goBack() {
    void this.router.navigateByUrl('/resumen');
  }
  clearPasswords() {
    this.claveActual = '';
    this.nuevaClave = '';
    this.confirmacion = '';
  }
  async logout() {
    this.busy.set(true);
    try {
      await this.auth.logout();
    } catch (e) {
      this.error.set(errorAutenticacion(e));
    } finally {
      this.clearPasswords();
      this.busy.set(false);
    }
  }
}

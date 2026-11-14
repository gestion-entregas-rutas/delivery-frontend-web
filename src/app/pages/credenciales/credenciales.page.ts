import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CLAVE_PATTERN, errorAutenticacion } from '../../core/models/autenticacion.models';
@Component({
  selector: 'app-credenciales-page',
  imports: [FormsModule],
  templateUrl: './credenciales.page.html',
  styleUrl: '../../shared/auth-page.css',
})
export class CredencialesPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly pattern = CLAVE_PATTERN;
  readonly busy = signal(false);
  readonly error = signal('');
  nombreUsuario = this.auth.usuario()?.nombreUsuario || '';
  claveActual = '';
  nuevaClave = '';
  confirmacion = '';
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

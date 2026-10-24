import { Component, inject, signal, afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UsuariosService } from '../../core/services/usuarios.service';
import { LogisticaApiService } from '../../core/services/logistica-api.service';
import { OperationsService } from '../../core/services/operations.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  UsuarioDto,
  RolUsuario,
  CLAVE_PATTERN,
  errorAutenticacion,
} from '../../core/models/autenticacion.models';
import { RepartidorDto } from '../../core/models/logistica.models';
@Component({
  selector: 'app-usuarios-page',
  imports: [FormsModule],
  templateUrl: './usuarios.page.html',
})
export class UsuariosPage {
  private readonly api = inject(UsuariosService);
  private readonly logistica = inject(LogisticaApiService);
  readonly auth = inject(AuthService);
  private readonly operations = inject(OperationsService);
  readonly usuarios = signal<UsuarioDto[]>([]);
  readonly repartidores = signal<RepartidorDto[]>([]);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly dialog = signal<'crear' | 'restablecer' | null>(null);
  readonly pattern = CLAVE_PATTERN;
  selected: UsuarioDto | null = null;
  nombreUsuario = '';
  claveTemporal = '';
  rol: RolUsuario = 'Conductor';
  repartidorId = '';
  constructor() {
    this.operations.view.set('Usuarios');
    afterNextRender(() => void this.load());
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [usuarios, repartidores] = await Promise.all([
        firstValueFrom(this.api.listar()),
        firstValueFrom(this.logistica.listarRepartidores()),
      ]);
      this.usuarios.set(usuarios);
      this.repartidores.set(repartidores);
    } catch (e) {
      this.error.set(errorAutenticacion(e));
    } finally {
      this.loading.set(false);
    }
  }
  disponibles() {
    return this.repartidores().filter((r) => !this.usuarios().some((u) => u.repartidorId === r.id));
  }
  driver(id: string | null) {
    return this.repartidores().find((r) => r.id === id)?.nombre || 'Sin vínculo';
  }
  openCreate() {
    this.error.set('');
    this.nombreUsuario = '';
    this.claveTemporal = '';
    this.rol = 'Conductor';
    this.repartidorId = '';
    this.dialog.set('crear');
  }
  openReset(user: UsuarioDto) {
    this.error.set('');
    this.selected = user;
    this.claveTemporal = '';
    this.dialog.set('restablecer');
  }
  close() {
    if (this.busy()) return;
    this.dialog.set(null);
    this.claveTemporal = '';
    this.selected = null;
  }
  async save() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.dialog() === 'crear') {
        await firstValueFrom(
          this.api.crear({
            nombreUsuario: this.nombreUsuario.trim(),
            claveTemporal: this.claveTemporal,
            rol: this.rol,
            ...(this.rol === 'Conductor' ? { repartidorId: this.repartidorId } : {}),
          }),
        );
        this.message.set(
          'Cuenta creada. Entrega las credenciales al usuario por el canal acordado.',
        );
      } else if (this.selected) {
        await firstValueFrom(this.api.restablecerClave(this.selected.id, this.claveTemporal));
        this.message.set(
          'Contraseña restablecida. Las sesiones previas fueron revocadas y el usuario deberá cambiar sus credenciales.',
        );
      }
      this.dialog.set(null);
      this.claveTemporal = '';
      await this.load();
    } catch (e) {
      this.error.set(errorAutenticacion(e));
    } finally {
      this.busy.set(false);
    }
  }
  async toggle(user: UsuarioDto) {
    if (this.busy() || user.id === this.auth.usuario()?.id) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.cambiarActivo(user.id, !user.activo));
      this.message.set(
        user.activo ? 'Cuenta desactivada. Se conserva su historial.' : 'Cuenta activada.',
      );
      await this.load();
    } catch (e) {
      this.error.set(errorAutenticacion(e));
    } finally {
      this.busy.set(false);
    }
  }
}

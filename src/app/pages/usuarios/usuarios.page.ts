import { Component, inject, signal, computed, afterNextRender, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, FormsModule],
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
  /** Los mensajes de éxito se muestran en el toast global del panel. */
  private readonly avisoGlobal = effect(() => {
    const texto = this.message();
    if (texto) untracked(() => this.operations.message.set(texto));
  });
  readonly dialog = signal<'crear' | 'restablecer' | null>(null);
  readonly pattern = CLAVE_PATTERN;

  // Search, Filters & UX Signals
  readonly buscar = signal('');
  readonly rolFiltro = signal<'Todos' | 'Administrador' | 'Conductor' | 'Cliente' | 'Inactivos'>('Todos');
  readonly verClave = signal(false);
  readonly copiadoExito = signal(false);

  // Computeds
  readonly totalUsuarios = computed(() => this.usuarios().length);
  readonly adminsCount = computed(() => this.usuarios().filter((u) => u.rol === 'Administrador').length);
  readonly conductoresCount = computed(() => this.usuarios().filter((u) => u.rol === 'Conductor').length);
  readonly clientesCount = computed(() => this.usuarios().filter((u) => u.rol === 'Cliente').length);
  readonly activosCount = computed(() => this.usuarios().filter((u) => u.activo).length);
  readonly inactivosCount = computed(() => this.usuarios().filter((u) => !u.activo).length);
  readonly pendientesCambioCount = computed(() => this.usuarios().filter((u) => u.debeCambiarCredenciales).length);

  readonly filtrados = computed(() => {
    const q = this.buscar().trim().toLocaleLowerCase();
    const filtro = this.rolFiltro();

    return this.usuarios().filter((u) => {
      // Filter by role/state tab
      if (filtro === 'Administrador' && u.rol !== 'Administrador') return false;
      if (filtro === 'Conductor' && u.rol !== 'Conductor') return false;
      if (filtro === 'Cliente' && u.rol !== 'Cliente') return false;
      if (filtro === 'Inactivos' && u.activo) return false;

      // Filter by search query
      if (q) {
        const matchesUser = u.nombreUsuario.toLocaleLowerCase().includes(q);
        const matchesRol = u.rol.toLocaleLowerCase().includes(q);
        const driverName = this.driver(u.repartidorId).toLocaleLowerCase();
        const matchesDriver = driverName.includes(q);
        return matchesUser || matchesRol || matchesDriver;
      }
      return true;
    });
  });

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
  iniciales(nombre: string): string {
    if (!nombre) return 'US';
    const parts = nombre.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nombre.slice(0, 2).toUpperCase();
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

    // Shuffle
    for (let i = pass.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pass[i], pass[j]] = [pass[j], pass[i]];
    }

    this.claveTemporal = pass.join('');
    this.verClave.set(true);
  }

  async copiarClave() {
    if (!this.claveTemporal) return;
    try {
      if (typeof navigator?.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(this.claveTemporal);
      }
      this.copiadoExito.set(true);
      setTimeout(() => this.copiadoExito.set(false), 2500);
    } catch {
      // fallback
    }
  }

  puedeDesactivar(user: UsuarioDto): boolean {
    return user.rol !== 'Administrador';
  }

  puedeModificarClave(user: UsuarioDto): boolean {
    return user.rol !== 'Administrador' && user.rol !== 'Cliente';
  }

  openCreate() {
    this.error.set('');
    this.nombreUsuario = '';
    this.claveTemporal = '';
    this.rol = 'Conductor';
    this.repartidorId = '';
    this.verClave.set(false);
    this.copiadoExito.set(false);
    this.dialog.set('crear');
  }
  openReset(user: UsuarioDto) {
    if (!this.puedeModificarClave(user)) return;
    this.error.set('');
    this.selected = user;
    this.claveTemporal = '';
    this.verClave.set(false);
    this.copiadoExito.set(false);
    this.dialog.set('restablecer');
  }
  close() {
    if (this.busy()) return;
    this.dialog.set(null);
    this.claveTemporal = '';
    this.selected = null;
    this.verClave.set(false);
    this.copiadoExito.set(false);
  }
  async save() {
    if (this.busy()) return;
    if (this.dialog() === 'restablecer' && this.selected && !this.puedeModificarClave(this.selected)) {
      this.error.set('No está permitido modificar contraseñas de cuentas de administrador.');
      return;
    }
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
    if (this.busy() || user.rol === 'Administrador' || user.id === this.auth.usuario()?.id) return;
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

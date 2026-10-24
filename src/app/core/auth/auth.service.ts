import { Injectable, PLATFORM_ID, inject, signal, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LOGISTICA_SERVER_URL } from '../services/logistica-api.service';
import {
  UsuarioDto,
  SesionDto,
  LoginRequest,
  CambiarCredencialesRequest,
} from '../models/autenticacion.models';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly base = inject(LOGISTICA_SERVER_URL).replace(/\/$/, '') + '/api/autenticacion';
  private readonly sessionKey = 'delivery.sesion';
  private readonly accessToken = signal<string | null>(null);
  readonly usuario = signal<UsuarioDto | null>(null);
  readonly aviso = signal('');
  private expira = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private restored = false;
  private restoring?: Promise<void>;
  token() {
    return this.expira > Date.now() ? this.accessToken() : null;
  }
  async restore() {
    if (this.restored || !this.browser) return;
    if (this.restoring) return this.restoring;
    this.restoring = this.restoreStored();
    try {
      await this.restoring;
    } finally {
      this.restoring = undefined;
    }
  }
  private async restoreStored() {
    try {
      const raw = sessionStorage.getItem(this.sessionKey);
      if (!raw) {
        this.restored = true;
        return;
      }
      const stored = JSON.parse(raw);
      if (
        typeof stored.accessToken !== 'string' ||
        !Number.isFinite(stored.expira) ||
        stored.expira <= Date.now()
      ) {
        this.clear();
        return;
      }
      this.accessToken.set(stored.accessToken);
      this.expira = stored.expira;
      const usuario = await firstValueFrom(this.http.get<UsuarioDto>(this.base + '/me'));
      if (!usuario.activo || usuario.rol !== 'Administrador') {
        this.clear();
        return;
      }
      this.usuario.set(usuario);
      this.scheduleExpiry();
      this.restored = true;
    } catch {
      this.clear();
    }
  }
  async login(body: LoginRequest) {
    const result = await firstValueFrom(this.http.post<SesionDto>(this.base + '/login', body));
    if (result.usuario.rol !== 'Administrador' || !result.usuario.activo) {
      this.clear();
      throw new Error(
        'Este panel es exclusivo para administradores. Utiliza la aplicación de conductores con tu cuenta.',
      );
    }
    this.accept(result);
  }
  async cambiarCredenciales(body: CambiarCredencialesRequest) {
    this.accept(await firstValueFrom(this.http.put<SesionDto>(this.base + '/credenciales', body)));
  }
  private accept(result: SesionDto) {
    const expiry = Date.parse(result.expiraEn);
    if (
      !result.accessToken ||
      !Number.isFinite(expiry) ||
      expiry <= Date.now() ||
      result.usuario.rol !== 'Administrador' ||
      !result.usuario.activo
    ) {
      this.clear();
      throw new Error('La sesión recibida no es válida. Inicia sesión nuevamente.');
    }
    this.accessToken.set(result.accessToken);
    this.expira = expiry;
    this.usuario.set(result.usuario);
    this.restored = true;
    this.aviso.set('');
    if (this.browser) {
      try {
        sessionStorage.setItem(
          this.sessionKey,
          JSON.stringify({ accessToken: result.accessToken, expira: expiry }),
        );
      } catch {
        /* La sesión continúa en memoria. */
      }
    }
    this.scheduleExpiry();
  }
  private scheduleExpiry() {
    clearTimeout(this.timer);
    if (this.browser)
      this.timer = setTimeout(() => this.expire(), Math.min(this.expira - Date.now(), 2147483647));
  }
  expire() {
    this.clear();
    this.aviso.set('Tu sesión venció o fue revocada. Inicia sesión nuevamente.');
    void this.router.navigateByUrl('/login');
  }
  clear() {
    clearTimeout(this.timer);
    this.accessToken.set(null);
    this.usuario.set(null);
    this.expira = 0;
    this.restored = true;
    if (this.browser) {
      try {
        sessionStorage.removeItem(this.sessionKey);
      } catch {}
    }
  }
  async logout() {
    // No se simula una revocación si el servidor no pudo confirmarla.
    if (!this.token()) {
      this.clear();
      this.aviso.set('La sesión local ha finalizado. Inicia sesión nuevamente.');
      await this.router.navigateByUrl('/login');
      return;
    }
    await firstValueFrom(this.http.post<void>(this.base + '/logout', null));
    this.clear();
    this.aviso.set('Sesión cerrada. Se cerraron todas las sesiones de esta cuenta.');
    await this.router.navigateByUrl('/login');
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }
}

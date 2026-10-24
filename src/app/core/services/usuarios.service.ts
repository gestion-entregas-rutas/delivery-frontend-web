import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LOGISTICA_SERVER_URL } from './logistica-api.service';
import { CrearUsuarioRequest, UsuarioDto } from '../models/autenticacion.models';
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(LOGISTICA_SERVER_URL).replace(/\/$/, '') + '/api/usuarios';
  listar() {
    return this.http.get<UsuarioDto[]>(this.base);
  }
  crear(body: CrearUsuarioRequest) {
    return this.http.post<UsuarioDto>(this.base, body);
  }
  cambiarActivo(id: string, activo: boolean) {
    return this.http.put<UsuarioDto>(this.base + '/' + id + '/activo', { activo });
  }
  restablecerClave(id: string, claveTemporal: string) {
    return this.http.post<void>(this.base + '/' + id + '/restablecer-clave', { claveTemporal });
  }
}

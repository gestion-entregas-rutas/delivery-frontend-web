export type RolUsuario = 'Administrador' | 'Conductor';
export interface UsuarioDto {
  id: string;
  nombreUsuario: string;
  rol: RolUsuario;
  repartidorId: string | null;
  activo: boolean;
  debeCambiarCredenciales: boolean;
}
export interface SesionDto {
  accessToken: string;
  expiraEn: string;
  tokenType: string;
  usuario: UsuarioDto;
}
export interface LoginRequest {
  nombreUsuario: string;
  clave: string;
}
export interface CambiarCredencialesRequest {
  claveActual: string;
  nuevoNombreUsuario: string;
  nuevaClave: string;
}
export interface CrearUsuarioRequest {
  nombreUsuario: string;
  claveTemporal: string;
  rol: RolUsuario;
  repartidorId?: string;
}
export const CLAVE_PATTERN = '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{12,128}$';
export function errorAutenticacion(error: any, login = false): string {
  if (error?.status === 0)
    return 'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.';
  if (error?.status === 429)
    return 'Demasiados intentos. Espera un minuto antes de volver a intentarlo.';
  if (login && error?.status === 401)
    return 'No se pudo iniciar sesión. Revisa tus credenciales o inténtalo más tarde.';
  if (error?.status === 403) return 'No tienes permiso para realizar esta operación.';
  return [
    error?.error?.detail ||
      error?.error?.title ||
      error?.message ||
      'No se pudo completar la operación.',
    ...Object.values(error?.error?.errors || {}).flat(),
  ].join(' ');
}

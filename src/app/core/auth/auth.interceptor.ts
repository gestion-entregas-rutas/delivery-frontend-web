import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { LOGISTICA_SERVER_URL } from '../services/logistica-api.service';
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const server = inject(LOGISTICA_SERVER_URL).replace(/\/$/, '');
  if (!request.url.startsWith(server + '/api/')) return next(request);
  const login = request.url === server + '/api/autenticacion/login';
  const token = login ? null : auth.token();
  const outgoing = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(outgoing).pipe(
    catchError((error) => {
      if (
        error.status === 401 &&
        token &&
        request.url !== server + '/api/autenticacion/credenciales' &&
        auth.token() === token
      )
        auth.expire();
      if (error.status === 403 && auth.usuario()?.debeCambiarCredenciales)
        void router.navigateByUrl('/credenciales');
      return throwError(() => error);
    }),
  );
};

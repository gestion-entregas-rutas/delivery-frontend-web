import { inject } from '@angular/core';
import { CanActivateFn, CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
export const adminGuard: CanActivateChildFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restore();
  if (!auth.token() || !auth.usuario())
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (auth.usuario()!.rol !== 'Administrador') return router.createUrlTree(['/login']);
  if (auth.usuario()!.debeCambiarCredenciales) return router.createUrlTree(['/credenciales']);
  return true;
};
export const credencialesGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restore();
  return auth.token() && auth.usuario()?.rol === 'Administrador'
    ? true
    : router.createUrlTree(['/login']);
};
export const loginGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restore();
  return auth.token() && auth.usuario()?.rol === 'Administrador'
    ? router.createUrlTree([auth.usuario()!.debeCambiarCredenciales ? '/credenciales' : '/resumen'])
    : true;
};

import { Routes } from '@angular/router';
import { adminGuard, credencialesGuard, loginGuard } from './core/auth/auth.guards';
import { AdminLayout } from './layout/admin-layout/admin-layout';
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'credenciales',
    canActivate: [credencialesGuard],
    loadComponent: () =>
      import('./pages/credenciales/credenciales.page').then((m) => m.CredencialesPage),
  },
  {
    path: '',
    component: AdminLayout,
    canActivateChild: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      {
        path: 'usuarios',
        loadComponent: () => import('./pages/usuarios/usuarios.page').then((m) => m.UsuariosPage),
      },
      {
        path: 'resumen',
        loadComponent: () => import('./pages/resumen/resumen.page').then((m) => m.ResumenPage),
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./pages/pedidos/pedidos.page').then((m) => m.PedidosPage),
      },
      {
        path: 'repartidores',
        loadComponent: () =>
          import('./pages/repartidores/repartidores.page').then((m) => m.RepartidoresPage),
      },
      {
        path: 'rutas',
        loadComponent: () => import('./pages/rutas/rutas.page').then((m) => m.RutasPage),
      },
      {
        path: 'zonas',
        loadComponent: () => import('./pages/zonas/zonas.page').then((m) => m.ZonasPage),
      },
    ],
  },
  { path: '**', redirectTo: 'resumen' },
];

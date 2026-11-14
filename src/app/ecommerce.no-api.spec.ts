import { routes } from './app.routes';

describe('Rutas e-commerce (sin API real)', () => {
  it('incluye rutas de productos y retiros-tienda en el layout administrativo', () => {
    const admin = routes.find((r) => r.path === '' && Array.isArray(r.children));
    expect(admin).toBeTruthy();
    const children = admin!.children!;
    const productos = children.find((c) => c.path === 'productos');
    const retiros = children.find((c) => c.path === 'retiros-tienda');

    expect(productos).toBeTruthy();
    expect(retiros).toBeTruthy();
    expect(typeof productos!.loadComponent).toBe('function');
    expect(typeof retiros!.loadComponent).toBe('function');
  });

  it('mantiene la redirección por defecto y wildcard hacia resumen', () => {
    const admin = routes.find((r) => r.path === '' && Array.isArray(r.children));
    const root = admin!.children!.find((c) => c.path === '' );
    const wildcard = routes.find((r) => r.path === '**');
    expect(root?.redirectTo).toBe('resumen');
    expect(wildcard?.redirectTo).toBe('resumen');
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProductosPage } from './productos.page';
import { LogisticaApiService } from '../../core/services/logistica-api.service';
import { OperationsService } from '../../core/services/operations.service';

describe('ProductosPage (sin API real, mocks)', () => {
  const producto = {
    id: 'prod-1',
    categoriaId: 12,
    categoriaNombre: 'Hogar y cocina',
    subcategoria: 'Velas',
    nombre: 'Vela aromática',
    marca: 'MarcaX',
    descripcionCorta: 'Desc',
    precioBase: 10,
    precioOferta: 8,
    stock: 5,
    activo: true,
    imagenPrincipalUrl: 'https://img.test/1.png',
    galeriaMultimedia: [],
    fichaTecnica: [],
    sobreEsteArticulo: [],
    version: 'v1',
  };

  let api: any;
  let operations: any;

  beforeEach(async () => {
    api = {
      listarCategorias: vi.fn(() => of([{ id: 12, nombre: 'Hogar y cocina' }])),
      listarProductos: vi.fn(() => of({ items: [producto], total: 1, pagina: 1, tamanoPagina: 50 })),
      obtenerProducto: vi.fn(() => of({ ...producto })),
      crearProducto: vi.fn(() => of({ ...producto, id: 'new', version: 'v1' })),
      actualizarProducto: vi.fn(() => of({ ...producto, version: 'v2' })),
      actualizarStockProducto: vi.fn(() => of({ ...producto, stock: 10 })),
      desactivarProducto: vi.fn(() => of(void 0)),
      activarProducto: vi.fn(() => of({ ...producto, activo: true })),
    };
    operations = { view: signal('Resumen') };

    await TestBed.configureTestingModule({
      imports: [ProductosPage],
      providers: [
        { provide: LogisticaApiService, useValue: api },
        { provide: OperationsService, useValue: operations },
      ],
    }).compileComponents();
  });

  it('carga catálogo y aplica filtros por búsqueda/categoría/estado sin backend', async () => {
    const fixture = TestBed.createComponent(ProductosPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.cargar();
    fixture.detectChanges();

    const page = fixture.componentInstance;
    expect(operations.view()).toBe('Productos');
    expect(api.listarCategorias).toHaveBeenCalled();
    expect(api.listarProductos).toHaveBeenCalledWith({ incluirInactivos: true });
    expect(page.productos().length).toBe(1);
    expect(page.filtrados().length).toBe(1);

    page.buscar.set('vela');
    expect(page.filtrados().length).toBe(1);
    page.buscar.set('no-existe');
    expect(page.filtrados().length).toBe(0);

    page.buscar.set('');
    page.categoriaFiltro.set(12);
    expect(page.filtrados().length).toBe(1);
    page.categoriaFiltro.set(99);
    expect(page.filtrados().length).toBe(0);

    page.categoriaFiltro.set('');
    page.productos.set([
      { ...producto, id: 'a', activo: true, stock: 3 },
      { ...producto, id: 'b', activo: true, stock: 0 },
      { ...producto, id: 'c', activo: false, stock: 2 },
    ] as any);
    page.estadoFiltro.set('activo');
    expect(page.filtrados().map(p => p.id)).toEqual(['a']);
    page.estadoFiltro.set('agotado');
    expect(page.filtrados().map(p => p.id)).toEqual(['b']);
    page.estadoFiltro.set('inactivo');
    expect(page.filtrados().map(p => p.id)).toEqual(['c']);
  });

  it('al crear envía datos normalizados y refresca el listado', async () => {
    const fixture = TestBed.createComponent(ProductosPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.cargar();
    const page = fixture.componentInstance;

    page.abrirNuevo();
    page.form.categoriaId = 12;
    page.form.nombre = '  Nuevo  ';
    page.form.marca = '  M  ';
    page.form.precioBase = 19.9;
    page.form.stock = 4;
    page.form.fichaTecnica = [{ clave: 'Color', valor: 'Rojo' }, { clave: '', valor: '' }];
    page.form.sobreEsteArticulo = [' Punto 1 ', ''];

    await page.guardar();

    expect(api.crearProducto).toHaveBeenCalled();
    const body = api.crearProducto.mock.calls[0][0];
    expect(body.nombre).toBe('Nuevo');
    expect(body.marca).toBe('M');
    expect(body.categoriaId).toBe(12);
    expect(body.fichaTecnica).toEqual([{ clave: 'Color', valor: 'Rojo' }]);
    expect(body.sobreEsteArticulo).toEqual(['Punto 1']);
    expect(body.version).toBeUndefined();
    expect(page.editorAbierto()).toBe(false);
    expect(page.message()).toContain('creado');
  });

  it('en conflicto 409 no cierra ni sobrescribe: muestra banner y permite recargar versión', async () => {
    api.actualizarProducto.mockReturnValue(
      throwError(() => ({ status: 409, error: { codigo: 'CONFLICTO_VERSION_PRODUCTO', mensaje: 'Conflicto' } })),
    );
    api.obtenerProducto
      .mockReturnValueOnce(of({ ...producto, version: 'v1' }))
      .mockReturnValueOnce(of({ ...producto, version: 'v2', nombre: 'Vela actualizada en servidor' }));

    const fixture = TestBed.createComponent(ProductosPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.cargar();
    const page = fixture.componentInstance;

    await page.abrirEditar(producto as any);
    expect(page.editorAbierto()).toBe(true);
    expect(page.editandoVersion()).toBe('v1');

    page.form.nombre = 'Cambio local';
    await page.guardar();

    expect(page.editorAbierto()).toBe(true);
    expect(page.conflict()).toContain('editado por otro usuario');
    expect(page.conflict()).toContain('Recarga los datos');
    expect(page.form.nombre).toBe('Cambio local'); // no se sobrescribe con datos del servidor automáticamente

    await page.recargarProductoActual();

    expect(api.obtenerProducto).toHaveBeenCalledWith('prod-1');
    expect(page.editandoVersion()).toBe('v2');
    expect(page.form.nombre).toBe('Vela actualizada en servidor');
    expect(page.conflict()).toBe('');
  });

  it('actualiza stock y cambia estado activo/inactivo mediante acciones (mocks)', async () => {
    const promptSpy = vi.spyOn(globalThis, 'prompt').mockReturnValue('10');
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    const fixture = TestBed.createComponent(ProductosPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.cargar();
    const page = fixture.componentInstance;

    await page.cambiarStock(producto as any);
    expect(api.actualizarStockProducto).toHaveBeenCalledWith('prod-1', 10);

    await page.desactivar(producto as any);
    expect(api.desactivarProducto).toHaveBeenCalledWith('prod-1');

    await page.activar({ ...producto, activo: false } as any);
    expect(api.activarProducto).toHaveBeenCalledWith('prod-1');

    promptSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('abre y confirma modales interactivos de stock y desactivar', async () => {
    const fixture = TestBed.createComponent(ProductosPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.cargar();
    const page = fixture.componentInstance;

    // Test Stock Modal
    page.abrirModalStock(producto as any);
    expect(page.stockModalAbierto()).toBe(true);
    expect(page.productoStock()?.id).toBe('prod-1');
    expect(page.nuevoStock()).toBe(5);

    page.adjustModalStock(3);
    expect(page.nuevoStock()).toBe(8);

    await page.confirmarStock();
    expect(api.actualizarStockProducto).toHaveBeenCalledWith('prod-1', 8);
    expect(page.stockModalAbierto()).toBe(false);

    // Test Desactivar Modal
    page.abrirModalDesactivar(producto as any);
    expect(page.desactivarModalAbierto()).toBe(true);
    expect(page.productoDesactivar()?.id).toBe('prod-1');

    await page.confirmarDesactivar();
    expect(api.desactivarProducto).toHaveBeenCalledWith('prod-1');
    expect(page.desactivarModalAbierto()).toBe(false);
  });
});

import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  CategoriaDto,
  FichaTecnicaItemDto,
  GuardarProductoRequest,
  MediaProductoDto,
  ProductoDto,
} from '../../core/models/ecommerce.models';
import { LogisticaApiService } from '../../core/services/logistica-api.service';
import { OperationsService } from '../../core/services/operations.service';

const CATEGORIAS_OFICIALES = [
  'Todos los departamentos',
  'Arte y artesanías',
  'Automotriz',
  'Bebé',
  'Belleza y cuidado personal',
  'Cine y TV',
  'Computadoras',
  'Deportes y actividades al aire libre',
  'Electrónicos',
  'Equipaje',
  'Herramientas y mejoramiento del hogar',
  'Hogar y cocina',
  'Industria y Ciencia',
  'Insumos para mascotas',
  'Juguetes y juegos',
  'Libros',
  'Moda para Hombre',
  'Moda para Mujer',
  'Moda para Niñas',
  'Moda para Niños',
  'Música MP3',
  'Música, CDs y Vinilos',
  'Ofertas',
  'Prime Video',
  'Salud y Hogar',
  'Software',
  'Tienda Kindle',
  'Videojuegos',
];

@Component({
  selector: 'app-productos-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos.page.html',
  styleUrl: './productos.page.css',
})
export class ProductosPage implements OnInit {
  readonly api = inject(LogisticaApiService);
  readonly operations = inject(OperationsService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly conflict = signal('');
  /** Los mensajes de éxito se muestran en el toast global del panel. */
  private readonly avisoGlobal = effect(() => {
    const m = this.message();
    if (m) untracked(() => this.operations.message.set(m));
  });

  readonly productos = signal<ProductoDto[]>([]);
  readonly categorias = signal<CategoriaDto[]>([]);
  readonly buscar = signal('');
  readonly categoriaFiltro = signal<string>('');
  readonly estadoFiltro = signal<'todos' | 'activo' | 'agotado' | 'inactivo'>('todos');

  readonly editorAbierto = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly editandoVersion = signal<string | number | null | undefined>(undefined);
  readonly editandoNombre = signal('');

  // Stock Modal state
  readonly stockModalAbierto = signal(false);
  readonly productoStock = signal<ProductoDto | null>(null);
  readonly nuevoStock = signal<number>(0);
  readonly guardandoStock = signal(false);

  // Desactivar Modal state
  readonly desactivarModalAbierto = signal(false);
  readonly productoDesactivar = signal<ProductoDto | null>(null);
  readonly guardandoDesactivar = signal(false);

  // Backward-compatibility aliases
  readonly pausarModalAbierto = this.desactivarModalAbierto;
  readonly productoPausar = this.productoDesactivar;
  readonly guardandoPausar = this.guardandoDesactivar;

  // Validation touched states
  readonly nombreTouched = signal(false);
  readonly categoriaTouched = signal(false);
  readonly precioBaseTouched = signal(false);
  readonly stockTouched = signal(false);

  readonly totalProductos = computed(() => this.productos().length);
  readonly activosCount = computed(() => this.productos().filter((p) => p.activo && (p.stock ?? 0) > 0).length);
  readonly agotadosCount = computed(() => this.productos().filter((p) => (p.stock ?? 0) <= 0).length);
  readonly inactivosCount = computed(() => this.productos().filter((p) => !p.activo).length);
  readonly totalStock = computed(() => this.productos().reduce((acc, p) => acc + (p.stock || 0), 0));
  readonly totalCategorias = computed(() => new Set(this.productos().map((p) => p.categoriaId)).size);

  readonly categoriasOpciones = computed(() => {
    // Solo categorías reales del backend: su Id es un GUID y no se puede inventar en el navegador.
    return this.categorias().filter((c) => !!c.id);
  });

  readonly filtrados = computed(() => {
    const q = this.buscar().trim().toLocaleLowerCase();
    const cat = this.categoriaFiltro();
    const estado = this.estadoFiltro();
    return this.productos().filter((p) => {
      const text = `${p.nombre} ${p.marca || ''} ${p.subcategoria || ''} ${p.categoriaNombre || ''}`.toLocaleLowerCase();
      const matchQ = !q || text.includes(q);
      const matchCat = cat === '' || p.categoriaId === cat;
      const agotado = (p.stock ?? 0) <= 0;
      const matchEstado =
        estado === 'todos' ||
        (estado === 'activo' && p.activo && !agotado) ||
        (estado === 'agotado' && agotado) ||
        (estado === 'inactivo' && !p.activo);
      return matchQ && matchCat && matchEstado;
    });
  });

  form: GuardarProductoRequest & { galeriaMultimedia: MediaProductoDto[]; fichaTecnica: FichaTecnicaItemDto[]; sobreEsteArticulo: string[] } = this.nuevoForm();

  ngOnInit() {
    this.operations.view.set('Productos');
    void this.cargar();
  }

  nuevoForm() {
    return {
      categoriaId: '',
      subcategoria: '',
      nombre: '',
      marca: '',
      descripcionCorta: '',
      precioBase: 0,
      precioOferta: null,
      stock: 0,
      activo: true,
      imagenPrincipalUrl: '',
      galeriaMultimedia: [] as MediaProductoDto[],
      fichaTecnica: [] as FichaTecnicaItemDto[],
      sobreEsteArticulo: [] as string[],
      version: undefined as string | number | null | undefined,
    };
  }

  resetTouched() {
    this.nombreTouched.set(false);
    this.categoriaTouched.set(false);
    this.precioBaseTouched.set(false);
    this.stockTouched.set(false);
  }

  async cargar() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [cats, prods] = await Promise.all([
        firstValueFrom(this.api.listarCategorias(true)).catch(() => [] as CategoriaDto[]),
        firstValueFrom(this.api.listarProductos({ incluirInactivos: true })).catch(() => ({ items: [], total: 0, pagina: 1, tamanoPagina: 0 })),
      ]);
      this.categorias.set(Array.isArray(cats) ? cats : []);
      const items = Array.isArray(prods) ? prods : prods?.items || [];
      this.productos.set(items);
    } catch (e) {
      this.error.set(this.msgError(e));
    } finally {
      this.loading.set(false);
    }
  }

  abrirNuevo() {
    this.resetTouched();
    this.editandoId.set(null);
    this.editandoVersion.set(undefined);
    this.editandoNombre.set('');
    this.form = this.nuevoForm();
    this.conflict.set('');
    this.error.set('');
    this.editorAbierto.set(true);
  }

  async abrirEditar(p: ProductoDto) {
    this.resetTouched();
    this.error.set('');
    this.conflict.set('');
    this.editorAbierto.set(true);
    this.editandoId.set(p.id);
    this.editandoNombre.set(p.nombre);
    try {
      const full = await firstValueFrom(this.api.obtenerProducto(p.id));
      this.cargarEnForm(full);
    } catch {
      this.cargarEnForm(p);
    }
  }

  cargarEnForm(p: ProductoDto) {
    this.editandoVersion.set(p.version);
    this.form = {
      categoriaId: p.categoriaId || '',
      subcategoria: p.subcategoria || '',
      nombre: p.nombre || '',
      marca: p.marca || '',
      descripcionCorta: p.descripcionCorta || '',
      precioBase: p.precioBase ?? 0,
      precioOferta: p.precioOferta ?? null,
      stock: p.stock ?? 0,
      activo: p.activo ?? true,
      imagenPrincipalUrl: p.imagenPrincipalUrl || '',
      galeriaMultimedia: (p.galeriaMultimedia || []).map((m, i) => ({ ...m, orden: m.orden ?? i + 1 })),
      fichaTecnica: (p.fichaTecnica || []).map((f) => ({ ...f })),
      sobreEsteArticulo: [...(p.sobreEsteArticulo || [])],
      version: p.version,
    };
  }

  cerrarEditor() {
    if (this.saving()) return;
    this.resetTouched();
    this.editorAbierto.set(false);
    this.conflict.set('');
  }

  adjustStock(delta: number) {
    const current = Number(this.form.stock) || 0;
    this.form.stock = Math.max(0, current + delta);
    this.stockTouched.set(true);
  }

  addGaleria() { this.form.galeriaMultimedia.push({ tipo: 'imagen', url: '', orden: this.form.galeriaMultimedia.length + 1 }); }
  removeGaleria(i: number) { this.form.galeriaMultimedia.splice(i, 1); }
  addFicha() { this.form.fichaTecnica.push({ clave: '', valor: '' }); }
  removeFicha(i: number) { this.form.fichaTecnica.splice(i, 1); }
  addSobre() { this.form.sobreEsteArticulo.push(''); }
  removeSobre(i: number) { this.form.sobreEsteArticulo.splice(i, 1); }

  limpiarFiltros() {
    this.buscar.set('');
    this.categoriaFiltro.set('');
    this.estadoFiltro.set('todos');
  }

  async guardar() {
    if (this.saving()) return;
    this.nombreTouched.set(true);
    this.categoriaTouched.set(true);
    this.precioBaseTouched.set(true);
    this.stockTouched.set(true);

    if (!this.form.nombre?.trim() || !this.form.categoriaId) {
      this.error.set('Nombre y categoría son obligatorios.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const body: GuardarProductoRequest = {
      ...this.form,
      categoriaId: String(this.form.categoriaId),
      subcategoria: this.form.subcategoria?.trim() || null,
      nombre: this.form.nombre.trim(),
      marca: this.form.marca?.trim() || null,
      descripcionCorta: this.form.descripcionCorta?.trim() || null,
      precioOferta: this.form.precioOferta == null || this.form.precioOferta === ('' as any) ? null : Number(this.form.precioOferta),
      precioBase: Number(this.form.precioBase || 0),
      stock: Number(this.form.stock || 0),
      imagenPrincipalUrl: this.form.imagenPrincipalUrl?.trim() || null,
      galeriaMultimedia: this.form.galeriaMultimedia.filter((m) => m.url?.trim()).map((m, i) => ({ ...m, url: m.url.trim(), orden: m.orden ?? i + 1 })),
      fichaTecnica: this.form.fichaTecnica.filter((f) => f.clave?.trim() || f.valor?.trim()),
      sobreEsteArticulo: this.form.sobreEsteArticulo.map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (this.editandoId()) {
        body.version = this.editandoVersion();
        await firstValueFrom(this.api.actualizarProducto(this.editandoId()!, body));
        this.message.set('Producto actualizado.');
      } else {
        delete (body as any).version;
        await firstValueFrom(this.api.crearProducto(body));
        this.message.set('Producto creado.');
      }
      this.editorAbierto.set(false);
      this.conflict.set('');
      await this.cargar();
    } catch (e: any) {
      if (e?.status === 409) {
        const codigo = e?.error?.codigo || e?.error?.Codigo;
        if (codigo === 'CONFLICTO_VERSION_PRODUCTO' || this.editandoId()) {
          this.conflict.set('El producto fue editado por otro usuario. Recarga los datos antes de guardar.');
        }
        this.error.set(this.msgError(e));
      } else {
        this.error.set(this.msgError(e));
      }
    } finally {
      this.saving.set(false);
    }
  }

  async recargarProductoActual() {
    const id = this.editandoId();
    if (!id) return;
    this.loading.set(true);
    try {
      const full = await firstValueFrom(this.api.obtenerProducto(id));
      this.cargarEnForm(full);
      this.conflict.set('');
      this.error.set('');
      this.message.set('Se cargó la última versión del producto.');
    } catch (e) {
      this.error.set(this.msgError(e));
    } finally {
      this.loading.set(false);
    }
  }

  abrirModalStock(p: ProductoDto) {
    this.productoStock.set(p);
    this.nuevoStock.set(p.stock ?? 0);
    this.stockModalAbierto.set(true);
  }

  cerrarModalStock() {
    if (this.guardandoStock()) return;
    this.stockModalAbierto.set(false);
    this.productoStock.set(null);
  }

  adjustModalStock(delta: number) {
    const current = Number(this.nuevoStock()) || 0;
    this.nuevoStock.set(Math.max(0, current + delta));
  }

  setModalStock(val: number) {
    this.nuevoStock.set(Math.max(0, val));
  }

  async confirmarStock() {
    const p = this.productoStock();
    if (!p) return;
    const stock = Number(this.nuevoStock());
    if (!Number.isFinite(stock) || stock < 0) return;
    this.guardandoStock.set(true);
    try {
      await firstValueFrom(this.api.actualizarStockProducto(p.id, stock));
      await this.cargar();
      this.message.set('Stock actualizado.');
      this.stockModalAbierto.set(false);
      this.productoStock.set(null);
    } catch (e) {
      this.error.set(this.msgError(e));
    } finally {
      this.guardandoStock.set(false);
    }
  }

  async cambiarStock(p: ProductoDto) {
    if (typeof globalThis.prompt === 'function') {
      const value = globalThis.prompt(`Nuevo stock para "${p.nombre}"`, String(p.stock ?? 0));
      if (value != null) {
        const stock = Number(value);
        if (!Number.isFinite(stock) || stock < 0) return;
        try {
          await firstValueFrom(this.api.actualizarStockProducto(p.id, stock));
          await this.cargar();
          this.message.set('Stock actualizado.');
        } catch (e) { this.error.set(this.msgError(e)); }
        return;
      }
    }
    this.abrirModalStock(p);
  }

  abrirModalDesactivar(p: ProductoDto) {
    this.productoDesactivar.set(p);
    this.desactivarModalAbierto.set(true);
  }

  abrirModalPausar(p: ProductoDto) {
    this.abrirModalDesactivar(p);
  }

  cerrarModalDesactivar() {
    if (this.guardandoDesactivar()) return;
    this.desactivarModalAbierto.set(false);
    this.productoDesactivar.set(null);
  }

  cerrarModalPausar() {
    this.cerrarModalDesactivar();
  }

  async confirmarDesactivar() {
    const p = this.productoDesactivar();
    if (!p) return;
    this.guardandoDesactivar.set(true);
    try {
      await firstValueFrom(this.api.desactivarProducto(p.id));
      await this.cargar();
      this.message.set(`Producto "${p.nombre}" desactivado.`);
      this.desactivarModalAbierto.set(false);
      this.productoDesactivar.set(null);
    } catch (e) {
      this.error.set(this.msgError(e));
    } finally {
      this.guardandoDesactivar.set(false);
    }
  }

  async confirmarPausar() {
    return this.confirmarDesactivar();
  }

  async desactivar(p: ProductoDto) {
    if (typeof globalThis.confirm === 'function') {
      const ok = globalThis.confirm(`¿Desactivar "${p.nombre}"?`);
      if (ok) {
        try {
          await firstValueFrom(this.api.desactivarProducto(p.id));
          await this.cargar();
          this.message.set('Producto desactivado.');
        } catch (e) { this.error.set(this.msgError(e)); }
        return;
      }
      return;
    }
    this.abrirModalDesactivar(p);
  }

  async activar(p: ProductoDto) {
    try { await firstValueFrom(this.api.activarProducto(p.id)); await this.cargar(); this.message.set('Producto activado.'); }
    catch (e) { this.error.set(this.msgError(e)); }
  }

  estadoProducto(p: ProductoDto) {
    if (!p.activo) return 'Inactivo';
    return (p.stock ?? 0) > 0 ? 'Activo' : 'Agotado';
  }

  msgError(e: any) {
    const p = e?.error;
    if (e?.status === 0) return 'No se pudo conectar con la API.';
    const parts = [
      p?.mensaje || p?.detail || p?.title || e?.message || 'No se pudo completar la operación.',
      ...Object.values(p?.errors || {}).flat(),
      ...(p?.traceId ? ['Referencia: ' + p.traceId] : []),
    ];
    return parts.filter(Boolean).join(' ');
  }
}

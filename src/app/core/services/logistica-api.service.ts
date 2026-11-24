import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import {
  ActualizarZonaRequest,
  AgregarPedidoARutaRequest,
  ArmadoRutasDto,
  ArmarRutasRequest,
  CrearRepartidorRequest,
  CrearZonaRequest,
  Fecha,
  FiltroPedidos,
  Guid,
  PaginaDto,
  PedidoDto,
  RegistrarPedidoRequest,
  RegistroPedidoDto,
  RepartidorDto,
  RutaDto,
  ZonaDto,
  ActualizarPedidoRequest,
  ResumenPedidosDto,
  UbicacionRepartidorDto,
  TransferirPedidoRequest,
  IntervalosDisponiblesDto,
  UbicacionLocalDto,
  ReoptimizarRutasRequest,
  ReoptimizacionDto,
} from '../models/logistica.models';
import {
  CategoriaDto,
  FiltroProductosAdmin,
  GuardarProductoRequest,
  OrdenRetiroDto,
  PaginaProductosDto,
  ProductoDto,
  SubcategoriaDto,
} from '../models/ecommerce.models';

// URL del servidor SIN /api y SIN barra final; se configura en app.config.ts.
export const LOGISTICA_SERVER_URL = new InjectionToken<string>('LOGISTICA_SERVER_URL');

@Injectable({ providedIn: 'root' })
export class LogisticaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(LOGISTICA_SERVER_URL).replace(/\/$/, '')}/api`;

  listarZonas() {
    return this.http.get<ZonaDto[]>(`${this.base}/zonas`);
  }
  obtenerZona(id: Guid) {
    return this.http.get<ZonaDto>(`${this.base}/zonas/${id}`);
  }
  crearZona(body: CrearZonaRequest) {
    return this.http.post<ZonaDto>(`${this.base}/zonas`, body);
  }
  actualizarZona(id: Guid, body: ActualizarZonaRequest) {
    return this.http.put<ZonaDto>(`${this.base}/zonas/${id}`, body);
  }

  listarRepartidores(soloDisponibles = false) {
    return this.http.get<RepartidorDto[]>(`${this.base}/repartidores`, {
      params: { soloDisponibles },
    });
  }
  crearRepartidor(body: CrearRepartidorRequest) {
    return this.http.post<RepartidorDto>(`${this.base}/repartidores`, body);
  }
  cambiarDisponibilidad(id: Guid, disponible: boolean) {
    return this.http.put<RepartidorDto>(`${this.base}/repartidores/${id}/disponibilidad`, {
      disponible,
    });
  }
  obtenerRutaRepartidor(id: Guid, fecha: Fecha) {
    return this.http.get<RutaDto>(`${this.base}/repartidores/${id}/ruta`, { params: { fecha } });
  }

  listarPedidos(filtro: FiltroPedidos = {}) {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null) params = params.set(clave, String(valor));
    }
    return this.http.get<PaginaDto<PedidoDto>>(`${this.base}/pedidos`, { params });
  }
  obtenerPedido(id: Guid) {
    return this.http.get<PedidoDto>(`${this.base}/pedidos/${id}`);
  }
  registrarPedido(body: RegistrarPedidoRequest) {
    return this.http.post<RegistroPedidoDto>(`${this.base}/pedidos`, body);
  }
  actualizarPedido(id: Guid, body: ActualizarPedidoRequest) {
    return this.http.put<PedidoDto>(`${this.base}/pedidos/${id}`, body);
  }
  resumenPedidos(filtro: FiltroPedidos = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filtro)) {
      if (value !== undefined && value !== null && key !== 'pagina' && key !== 'tamano')
        params = params.set(key, String(value));
    }
    return this.http.get<ResumenPedidosDto>(`${this.base}/resumen/pedidos`, { params });
  }
  ubicaciones(fecha: Fecha, zonaId?: Guid) {
    let params = new HttpParams().set('fecha', fecha);
    if (zonaId) params = params.set('zonaId', zonaId);
    return this.http.get<UbicacionRepartidorDto[]>(`${this.base}/seguimiento/ubicaciones`, {
      params,
    });
  }
  ubicacionRepartidor(id: Guid) {
    return this.http.get<UbicacionRepartidorDto>(`${this.base}/repartidores/${id}/ubicacion`);
  }
  transferirPedido(origenId: Guid, pedidoId: Guid, body: TransferirPedidoRequest) {
    return this.http.post<{ origen: RutaDto; destino: RutaDto }>(
      `${this.base}/rutas/${origenId}/pedidos/${pedidoId}/transferir`,
      body,
    );
  }
  reordenarParadas(id: Guid, pedidosEnOrden: Guid[], version: number, forzar?: boolean) {
    const body: Record<string, unknown> = {
      pedidosEnOrden,
      version,
    };
    if (forzar) body['forzar'] = true;
    return this.http.put<RutaDto>(`${this.base}/rutas/${id}/paradas/orden`, body);
  }
  recalcularEstimaciones(id: Guid) {
    return this.http.post<RutaDto>(`${this.base}/rutas/${id}/estimaciones/recalcular`, null);
  }
  consultarIntervalos(fecha: Fecha, latitud: number, longitud: number) {
    const params = new HttpParams()
      .set('fecha', fecha)
      .set('latitud', latitud)
      .set('longitud', longitud);
    return this.http.get<IntervalosDisponiblesDto>(`${this.base}/entregas/intervalos`, { params });
  }
  cancelarPedido(id: Guid) {
    return this.http.post<PedidoDto>(`${this.base}/pedidos/${id}/cancelar`, null);
  }

  /** Ubicación del local guardada en el servidor; null (204) si no se configuró. */
  obtenerLocal() {
    return this.http.get<UbicacionLocalDto | null>(`${this.base}/local`);
  }
  guardarLocal(body: { nombre: string; direccion: string; latitud: number; longitud: number }) {
    return this.http.put<UbicacionLocalDto>(`${this.base}/local`, body);
  }
  /** Rearma las rutas planificadas con los pendientes; `aplicar: false` solo devuelve la vista previa. */
  reoptimizarRutas(body: ReoptimizarRutasRequest) {
    return this.http.post<ReoptimizacionDto>(`${this.base}/rutas/reoptimizar`, body);
  }
  armarRutas(body: ArmarRutasRequest) {
    return this.http.post<ArmadoRutasDto>(`${this.base}/rutas/armar`, body);
  }
  listarRutas(fecha: Fecha, zonaId?: Guid) {
    let params = new HttpParams().set('fecha', fecha);
    if (zonaId) params = params.set('zonaId', zonaId);
    return this.http.get<RutaDto[]>(`${this.base}/rutas`, { params });
  }
  obtenerRuta(id: Guid) {
    return this.http.get<RutaDto>(`${this.base}/rutas/${id}`);
  }
  agregarPedido(id: Guid, body: AgregarPedidoARutaRequest) {
    return this.http.post<RutaDto>(`${this.base}/rutas/${id}/pedidos`, body);
  }
  quitarPedido(id: Guid, pedidoId: Guid) {
    return this.http.delete<void>(`${this.base}/rutas/${id}/pedidos/${pedidoId}`);
  }
  iniciarRuta(id: Guid) {
    return this.http.post<RutaDto>(`${this.base}/rutas/${id}/iniciar`, null);
  }
  cancelarRuta(id: Guid) {
    return this.http.post<RutaDto>(`${this.base}/rutas/${id}/cancelar`, null);
  }

  marcarEnCamino(pedidoId: Guid) {
    return this.http.post<PedidoDto>(
      `${this.base}/seguimiento/pedidos/${pedidoId}/en-camino`,
      null,
    );
  }
  registrarEntrega(pedidoId: Guid) {
    return this.http.post<PedidoDto>(
      `${this.base}/seguimiento/pedidos/${pedidoId}/entregado`,
      null,
    );
  }

  listarCategorias(incluirInactivas = false) {
    return this.http.get<CategoriaDto[]>(`${this.base}/categorias`, {
      params: incluirInactivas ? { incluirInactivas: true } : {},
    });
  }
  crearCategoria(body: Partial<CategoriaDto> & { nombre: string }) {
    return this.http.post<CategoriaDto>(`${this.base}/categorias`, body);
  }
  actualizarCategoria(id: number | string, body: Partial<CategoriaDto> & { nombre?: string }) {
    return this.http.put<CategoriaDto>(`${this.base}/categorias/${id}`, body);
  }
  listarSubcategorias(categoriaId?: number, incluirInactivas = false) {
    let params = new HttpParams();
    if (categoriaId != null) params = params.set('categoriaId', String(categoriaId));
    if (incluirInactivas) params = params.set('incluirInactivas', 'true');
    return this.http.get<SubcategoriaDto[]>(`${this.base}/subcategorias`, { params });
  }
  crearSubcategoria(body: Partial<SubcategoriaDto> & { nombre: string; categoriaId: number }) {
    return this.http.post<SubcategoriaDto>(`${this.base}/subcategorias`, body);
  }
  actualizarSubcategoria(id: number | string, body: Partial<SubcategoriaDto>) {
    return this.http.put<SubcategoriaDto>(`${this.base}/subcategorias/${id}`, body);
  }

  listarProductos(filtro: FiltroProductosAdmin = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filtro)) {
      if (value !== undefined && value !== null && value !== '')
        params = params.set(key, String(value));
    }
    return this.http.get<PaginaProductosDto | ProductoDto[]>(`${this.base}/productos`, { params });
  }
  obtenerProducto(id: string) {
    return this.http.get<ProductoDto>(`${this.base}/productos/${id}`, {
      params: { incluirInactivos: 'true' },
    });
  }
  crearProducto(body: GuardarProductoRequest) {
    return this.http.post<ProductoDto>(`${this.base}/productos`, body);
  }
  actualizarProducto(id: string, body: GuardarProductoRequest) {
    return this.http.put<ProductoDto>(`${this.base}/productos/${id}`, body);
  }
  actualizarStockProducto(id: string, stock: number) {
    return this.http.patch<ProductoDto>(`${this.base}/productos/${id}/stock`, { stock });
  }
  desactivarProducto(id: string) {
    return this.http.delete<void>(`${this.base}/productos/${id}`);
  }
  activarProducto(id: string) {
    return this.http.post<ProductoDto>(`${this.base}/productos/${id}/activar`, null);
  }

  listarRetirosTienda() {
    return this.http.get<OrdenRetiroDto[] | { items?: OrdenRetiroDto[] }>(
      `${this.base}/ordenes/retiros-tienda`,
    );
  }
  marcarOrdenRetirada(id: string) {
    return this.http.patch<OrdenRetiroDto>(`${this.base}/ordenes/${id}/marcar-retirado`, null);
  }

  poblarEscenarioAltoVolumen() {
    return this.http.post<unknown>(`${this.base}/testing/poblar-escenario-alto-volumen`, null);
  }
}

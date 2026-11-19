export interface CategoriaDto {
  id: number;
  nombre: string;
  activa?: boolean;
  orden?: number;
  cantidadProductos?: number;
  subcategorias?: SubcategoriaDto[];
}

export interface SubcategoriaDto {
  id?: number | string;
  categoriaId?: number;
  nombre: string;
  activa?: boolean;
  orden?: number;
}

export interface MediaProductoDto {
  tipo: 'imagen' | 'video' | string;
  url: string;
  orden?: number;
}

export interface FichaTecnicaItemDto {
  clave: string;
  valor: string;
}

export interface ProductoDto {
  id: string;
  categoriaId: number;
  categoriaNombre?: string;
  subcategoria?: string | null;
  nombre: string;
  marca?: string | null;
  descripcionCorta?: string | null;
  precioBase: number;
  precioOferta?: number | null;
  stock: number;
  activo: boolean;
  imagenPrincipalUrl?: string | null;
  galeriaMultimedia?: MediaProductoDto[];
  fichaTecnica?: FichaTecnicaItemDto[];
  sobreEsteArticulo?: string[];
  calificacionPromedio?: number;
  totalResenas?: number;
  version?: string | number | null;
}

export interface GuardarProductoRequest {
  categoriaId: number;
  subcategoria?: string | null;
  nombre: string;
  marca?: string | null;
  descripcionCorta?: string | null;
  precioBase: number;
  precioOferta?: number | null;
  stock: number;
  activo?: boolean;
  imagenPrincipalUrl?: string | null;
  galeriaMultimedia?: MediaProductoDto[];
  fichaTecnica?: FichaTecnicaItemDto[];
  sobreEsteArticulo?: string[];
  version?: string | number | null;
}

export interface PaginaProductosDto {
  items: ProductoDto[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}

export interface FiltroProductosAdmin {
  buscar?: string;
  categoriaId?: number;
  incluirInactivos?: boolean;
  pagina?: number;
  tamanoPagina?: number;
}

export interface OrdenRetiroDto {
  id: string;
  ordenId?: string;
  numeroOrden?: string;
  estadoOrden?: string;
  estadoPago?: string;
  estadoEntrega?: string;
  total?: number;
  totalPagado?: number;
  codigoRetiro?: string | null;
  clienteNombre?: string;
  fechaRetiro?: string;
  franjaHoraria?: string;
  datosRetiroTienda?: {
    cedulaQuienRetira?: string;
    nombreQuienRetira?: string;
    telefonoContacto?: string;
    fechaRetiro?: string;
    franjaHoraria?: string;
  } | null;
  [key: string]: unknown;
}

export interface ConflictoProductoError {
  codigo?: string;
  mensaje?: string;
  productoId?: string;
  stockDisponible?: number;
  traceId?: string;
}

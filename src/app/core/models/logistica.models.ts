// Contrato JSON actual de Application/DTOs. Fechas y horas se transmiten como strings.
export type Guid = string;
export type Fecha = string; // yyyy-MM-dd; no convertir a UTC con toISOString().
export type Hora = string; // HH:mm:ss
export type EstadoPedido = 'Pendiente' | 'AsignadoARuta' | 'EnCamino' | 'Entregado' | 'Cancelado';
export type EstadoRuta = 'Planificada' | 'EnCurso' | 'Completada' | 'Cancelada';
export type EstadoRepartidor = 'Disponible' | 'EnRuta' | 'NoDisponible';
export type TipoAsignacion = 'RutaExistente' | 'RutaNueva' | 'EnEspera';

export interface PuntoDto {
  latitud: number;
  longitud: number;
}
export interface CrearZonaRequest {
  nombre: string;
  poligono: PuntoDto[];
  maxPedidosPorRuta?: number; // Por defecto 4.
}
export interface ActualizarZonaRequest {
  nombre: string;
  poligono: PuntoDto[];
  maxPedidosPorRuta: number;
  activa: boolean;
}
export interface ZonaDto extends ActualizarZonaRequest {
  id: Guid;
}

export interface CrearRepartidorRequest {
  nombre: string;
  telefono: string;
  capacidadMaxima: number;
}
export interface CambiarDisponibilidadRequest {
  disponible: boolean;
}
export interface RepartidorDto extends CrearRepartidorRequest {
  id: Guid;
  estado: EstadoRepartidor;
}

export interface RegistrarPedidoRequest {
  clienteNombre: string;
  clienteTelefono: string;
  direccion: string;
  latitud: number;
  longitud: number;
  fechaEntrega: Fecha;
  horaEntrega: Hora;
  zonaId?: Guid | null;
  detalles?: DetallesPedidoDto | null;
}
export interface DetallesPedidoDto {
  remitenteNombre?: string | null;
  remitenteTelefono?: string | null;
  remitenteCorreo?: string | null;
  destinatarioCorreo?: string | null;
  observaciones?: string | null;
  tipoCarga?: 'General' | 'Documento' | 'Alimentos' | 'Medicamentos' | 'Otro' | null;
  pesoKg?: number | null;
  fragil?: boolean | null;
  prioridad?: 'Baja' | 'Normal' | 'Alta' | 'Urgente' | null;
}
export interface ActualizarPedidoRequest extends RegistrarPedidoRequest {
  version: number;
}
export interface ResumenPedidosDto {
  total: number;
  noCancelados: number;
  entregados: number;
  porcentajeEntregado: number;
  porEstado: { estado: EstadoPedido; cantidad: number }[];
  porZona: { zonaId: Guid; cantidad: number }[];
  calculadoEn: string;
}
export interface UbicacionRepartidorDto extends PuntoDto {
  repartidorId: Guid;
  rutaId: Guid;
  precisionMetros: number | null;
  capturadaEn: string;
  recibidaEn: string;
  esReciente: boolean;
}
export interface TransferirPedidoRequest {
  destinoRutaId: Guid;
  versionOrigen: number;
  versionDestino: number;
  posicion?: number | null;
  forzar?: boolean;
}
export interface AlertaPuntualidadDto {
  pedidoId: Guid;
  orden: number;
  estado: 'RetrasoPrevisto' | 'PlazoVencido';
  retrasoMinutos: number | null;
}
export interface PedidoEnRiesgo {
  pedidoId: Guid;
  rutaId: Guid;
  finalizacionEstimadaEn: string;
  limiteEn: string | null;
  retrasoMinutos: number | null;
}
export interface ResultadoPuntualidadDto {
  estado:
    | 'SinCompromiso'
    | 'SinEstimacion'
    | 'DentroDelPlazoPrevisto'
    | 'RetrasoPrevisto'
    | 'PlazoVencido'
    | 'EntregadoEnIntervalo'
    | 'EntregadoConRetraso'
    | 'EntregadoAntesDelIntervalo'
    | 'NoAplica'
    | string;
  retrasoMinutos: number | null;
}
export interface PedidoDto {
  version?: number;
  detalles?: DetallesPedidoDto | null;
  destinatarioNombre?: string;
  destinatarioTelefono?: string;
  id: Guid;
  clienteNombre: string;
  clienteTelefono: string;
  direccion: string;
  ubicacion: PuntoDto;
  zonaId: Guid;
  fechaEntrega: Fecha;
  horaEntrega: Hora;
  estado: EstadoPedido;
  rutaId: Guid | null;
  registradoEn: string; // ISO 8601 con offset.
  entregadoEn: string | null;
  compromisoInicioEn?: string | null;
  compromisoFinEn?: string | null;
  tiempoServicioMinutos?: number | null;
  puntualidad?: ResultadoPuntualidadDto | null;
}
export interface ResultadoAsignacionDto {
  tipo: TipoAsignacion;
  rutaId: Guid | null;
}
export interface RegistroPedidoDto {
  pedido: PedidoDto;
  asignacion: ResultadoAsignacionDto | null;
}
export interface FiltroPedidos {
  desde?: Fecha;
  hasta?: Fecha;
  buscar?: string;
  fecha?: Fecha;
  zonaId?: Guid;
  estado?: EstadoPedido;
  pagina?: number;
  tamano?: number;
}
export interface PaginaDto<T> {
  items: T[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface ArmarRutasRequest {
  fecha: Fecha;
  zonaId?: Guid | null;
  origen?: PuntoDto | null;
  salidaProgramadaEn?: string | null;
}
export interface AgregarPedidoARutaRequest {
  pedidoId: Guid;
  posicion?: number | null;
  forzar?: boolean;
}
export interface ReordenarParadasRequest {
  pedidosEnOrden: Guid[];
  version: number;
  forzar?: boolean;
}
export interface ParadaDto {
  orden: number;
  pedido: PedidoDto;
  llegadaEstimadaEn?: string | null;
  inicioAtencionEstimadoEn?: string | null;
  finalizacionEstimadaEn?: string | null;
  trasladoEstimadoMinutos?: number | null;
}
export interface RutaDto {
  version?: number;
  id: Guid;
  fecha: Fecha;
  zonaId: Guid;
  repartidorId: Guid;
  capacidad: number;
  estado: EstadoRuta;
  paradas: ParadaDto[];
  origen?: PuntoDto | null;
  salidaProgramadaEn?: string | null;
  estimacionesActualizadasEn?: string | null;
  modeloEstimacion?: string | null;
  distanciaEstimadaKm?: number | null;
  alertas?: AlertaPuntualidadDto[] | null;
}
export interface IntervaloEntregaDto {
  inicioEn: string;
  finEn: string;
  disponible: boolean;
  motivo?: 'Vencido' | 'SinCapacidad' | string | null;
}
export interface IntervalosDisponiblesDto {
  fecha: Fecha;
  zonaId: Guid;
  zonaNombre: string;
  duracionMinutos: number;
  modeloEstimacion: string;
  calculadoEn: string;
  intervalos: IntervaloEntregaDto[];
}
export interface ArmadoRutasDto {
  fecha: Fecha;
  rutas: RutaDto[];
  pedidosSinAsignar: number;
}

export interface ApiProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}

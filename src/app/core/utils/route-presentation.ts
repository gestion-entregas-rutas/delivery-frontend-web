import { ResultadoPuntualidadDto, RutaDto } from '../models/logistica.models';

/** Hora local del negocio (America/Guayaquil), formato 24 h. */
export function formatHoraEcuador(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Guayaquil',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.length >= 16 ? iso.slice(11, 16) : iso;
  }
}

export type TonoPuntualidad = 'ok' | 'aviso' | 'error' | 'info' | 'neutro';

/** Texto corto de puntualidad (calculada por el backend) y su tono visual. */
export function puntualidadCorta(p?: ResultadoPuntualidadDto | null): { texto: string; tono: TonoPuntualidad } {
  const n = p?.retrasoMinutos ?? 0;
  switch (p?.estado) {
    case 'DentroDelPlazoPrevisto': return { texto: 'A tiempo', tono: 'ok' };
    case 'RetrasoPrevisto': return { texto: `+${n} min previsto`, tono: 'aviso' };
    case 'PlazoVencido': return { texto: `Vencido hace ${n} min`, tono: 'error' };
    case 'EntregadoEnIntervalo': return { texto: 'Entregado a tiempo', tono: 'ok' };
    case 'EntregadoConRetraso': return { texto: `Entregado +${n} min`, tono: 'error' };
    case 'EntregadoAntesDelIntervalo': return { texto: 'Entregado antes', tono: 'info' };
    case 'SinCompromiso': return { texto: 'Flexible', tono: 'neutro' };
    case 'NoAplica': return { texto: 'No aplica', tono: 'neutro' };
    default: return { texto: 'Sin estimación', tono: 'neutro' };
  }
}

export const TONO_TEXTO: Record<TonoPuntualidad, string> = {
  ok: 'text-status-delivered',
  aviso: 'text-status-in-transit',
  error: 'text-status-urgent',
  info: 'text-primary',
  neutro: 'text-on-surface-variant',
};

export const TONO_FONDO: Record<TonoPuntualidad, string> = {
  ok: 'bg-status-delivered/10 text-status-delivered',
  aviso: 'bg-status-in-transit/10 text-status-in-transit',
  error: 'bg-status-urgent/10 text-status-urgent',
  info: 'bg-surface-container text-primary',
  neutro: 'bg-surface-container-high text-on-surface-variant',
};

/** Iniciales para el avatar del repartidor. */
export function iniciales(nombre: string): string {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '?') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

/** Intervalo comprometido "08:00 – 08:30" o null si el pedido no tiene compromiso. */
export function ventana(inicio?: string | null, fin?: string | null): string | null {
  return inicio && fin ? `${formatHoraEcuador(inicio)} – ${formatHoraEcuador(fin)}` : null;
}

/** Minutos de espera previstos en destino (llegada antes del inicio del intervalo). */
export function esperaMinutos(llegada?: string | null, inicioAtencion?: string | null): number | null {
  if (!llegada || !inicioAtencion) return null;
  const diff = Math.round((new Date(inicioAtencion).getTime() - new Date(llegada).getTime()) / 60000);
  return diff > 0 ? diff : null;
}

/** Duración estimada desde la salida hasta la última finalización estimada, en minutos. */
export function duracionEstimadaMin(ruta: RutaDto): number | null {
  const fines = ruta.paradas.map((p) => p.finalizacionEstimadaEn).filter((x): x is string => !!x);
  if (!ruta.salidaProgramadaEn || !fines.length) return null;
  const ultimo = Math.max(...fines.map((f) => new Date(f).getTime()));
  const min = Math.round((ultimo - new Date(ruta.salidaProgramadaEn).getTime()) / 60000);
  return min > 0 ? min : null;
}

export function formatDuracion(min: number | null): string {
  if (min == null) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${m.toString().padStart(2, '0')} min` : `${m} min`;
}

export const ESTADO_RUTA: Record<string, { texto: string; clase: string }> = {
  Planificada: { texto: 'Planificada', clase: 'bg-surface-container text-primary' },
  EnCurso: { texto: 'En curso', clase: 'bg-status-in-transit/10 text-status-in-transit' },
  Completada: { texto: 'Completada', clase: 'bg-status-delivered/10 text-status-delivered' },
  Cancelada: { texto: 'Cancelada', clase: 'bg-status-urgent/10 text-status-urgent' },
};

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LOGISTICA_SERVER_URL } from '../../../core/services/logistica-api.service';
import { OperationsService } from '../../../core/services/operations.service';
import { PedidoDto, RutaDto } from '../../../core/models/logistica.models';
import { RouteDetailModal } from './route-detail-modal';
import { duracionEstimadaMin, esperaMinutos, iniciales, puntualidadCorta } from '../../../core/utils/route-presentation';

const pedido = (id: string, extra: Partial<PedidoDto> = {}): PedidoDto => ({
  id, clienteNombre: 'Cliente ' + id, clienteTelefono: '0991', direccion: 'Dirección ' + id,
  ubicacion: { latitud: -1.24, longitud: -78.62 }, zonaId: 'z', fechaEntrega: '2026-11-24', horaEntrega: '08:00:00',
  estado: 'AsignadoARuta', rutaId: 'r', registradoEn: '2026-11-23T10:00:00Z', entregadoEn: null, ...extra,
});

// 13:00Z = 08:00 en Ecuador.
const ruta: RutaDto = {
  id: 'r', fecha: '2026-11-24', zonaId: 'z', repartidorId: 'd', capacidad: 2, estado: 'Planificada',
  origen: { latitud: -1.25, longitud: -78.63 }, salidaProgramadaEn: '2026-11-24T13:00:00Z',
  estimacionesActualizadasEn: '2026-11-24T12:50:00Z', distanciaEstimadaKm: 7.24,
  paradas: [
    { orden: 2, pedido: pedido('b', { compromisoInicioEn: '2026-11-24T14:00:00Z', compromisoFinEn: '2026-11-24T14:30:00Z',
      puntualidad: { estado: 'DentroDelPlazoPrevisto', retrasoMinutos: 0 }, detalles: { pesoKg: 12, observaciones: 'Timbre 2' } }),
      llegadaEstimadaEn: '2026-11-24T13:39:00Z', inicioAtencionEstimadoEn: '2026-11-24T14:00:00Z',
      finalizacionEstimadaEn: '2026-11-24T14:05:00Z', trasladoEstimadoMinutos: 26.7 },
    { orden: 1, pedido: pedido('a', { compromisoInicioEn: '2026-11-24T13:00:00Z', compromisoFinEn: '2026-11-24T13:30:00Z',
      puntualidad: { estado: 'DentroDelPlazoPrevisto', retrasoMinutos: 0 } }),
      llegadaEstimadaEn: '2026-11-24T13:05:00Z', inicioAtencionEstimadoEn: '2026-11-24T13:05:00Z',
      finalizacionEstimadaEn: '2026-11-24T13:10:00Z', trasladoEstimadoMinutos: 5 },
  ],
};

describe('Detalle de ruta', () => {
  it('formatea datos auxiliares sin inventar valores', () => {
    expect(iniciales('Josue Llumitasig')).toBe('JL');
    expect(esperaMinutos('2026-11-24T13:39:00Z', '2026-11-24T14:00:00Z')).toBe(21);
    expect(esperaMinutos(null, null)).toBeNull();
    expect(duracionEstimadaMin(ruta)).toBe(65);
    expect(puntualidadCorta(null).texto).toBe('Sin estimación');
    expect(puntualidadCorta({ estado: 'SinCompromiso', retrasoMinutos: null }).texto).toBe('Flexible');
  });

  it('arma métricas, itinerario ordenado y trazado con los datos reales de la ruta', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LOGISTICA_SERVER_URL, useValue: 'http://api.test' }],
    });
    const ops = TestBed.inject(OperationsService);
    ops.repartidores.set([{ id: 'd', nombre: 'Josue Llumitasig', telefono: '0998', capacidadMaxima: 4, estado: 'Disponible' }]);
    const fixture = TestBed.createComponent(RouteDetailModal);
    fixture.componentInstance.ruta = ruta;
    fixture.detectChanges();
    const v = fixture.componentInstance.vista();
    expect(v.iniciales).toBe('JL');
    expect(v.paradas.map((p) => p.orden)).toEqual([1, 2]);
    expect(v.distancia).toBe('7.2 km');
    expect(v.duracion).toBe('1 h 05 min');
    expect(v.ventanaGeneral).toBe('08:00 – 09:30');
    expect(v.holgura).toBe(20);
    expect(v.llena).toBe(true);
    expect(v.paradas[1].espera).toBe(21);
    expect(v.paradas[1].carga).toBe('12 kg');
    expect(v.mapa.map((m) => m.tipo)).toEqual(['origen', 'parada', 'parada']);
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Josue Llumitasig');
    expect(texto).toContain('Timbre 2');
    expect(texto).toContain('Receptor: Cliente a');
    expect(texto).not.toContain('Iniciar ruta');
    expect(texto).toContain('El repartidor la inicia desde la app');
    expect(texto).toContain('Espera 21 min');

    const cerrar = vi.fn();
    fixture.componentInstance.cerrar.subscribe(cerrar);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cerrar).toHaveBeenCalled();
  });
});

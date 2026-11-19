import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { OrdenRetiroDto } from '../../core/models/ecommerce.models';
import { LogisticaApiService } from '../../core/services/logistica-api.service';
import { OperationsService } from '../../core/services/operations.service';

@Component({
  selector: 'app-retiros-tienda-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './retiros-tienda.page.html',
})
export class RetirosTiendaPage implements OnInit {
  readonly api = inject(LogisticaApiService);
  readonly operations = inject(OperationsService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly buscar = signal('');
  readonly retiros = signal<OrdenRetiroDto[]>([]);
  readonly tab = signal<'pendientes' | 'completadas' | 'todas'>('pendientes');
  readonly ordenAConfirmar = signal<OrdenRetiroDto | null>(null);

  esRetirada(r: OrdenRetiroDto): boolean {
    const estado = (r.estadoEntrega || r.estadoOrden || '').toLowerCase();
    return estado === 'retirada' || estado === 'retirado';
  }

  readonly conteoPendientes = computed(() => this.retiros().filter((r) => !this.esRetirada(r)).length);
  readonly conteoCompletadas = computed(() => this.retiros().filter((r) => this.esRetirada(r)).length);

  readonly filtrados = computed(() => {
    const q = this.buscar().trim().toLocaleLowerCase();
    const t = this.tab();
    let lista = this.retiros();
    if (t === 'pendientes') {
      lista = lista.filter((r) => !this.esRetirada(r));
    } else if (t === 'completadas') {
      lista = lista.filter((r) => this.esRetirada(r));
    }
    if (!q) return lista;
    return lista.filter((r) => {
      const cedula = r.datosRetiroTienda?.cedulaQuienRetira || '';
      const nombre = r.datosRetiroTienda?.nombreQuienRetira || r.clienteNombre || '';
      const codigo = r.codigoRetiro || r.numeroOrden || '';
      return `${cedula} ${nombre} ${codigo} ${r.id} ${r.ordenId || ''}`.toLocaleLowerCase().includes(q);
    });
  });

  ngOnInit() {
    this.operations.view.set('RetirosTienda');
    void this.cargar();
  }

  async cargar() {
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await firstValueFrom(this.api.listarRetirosTienda());
      const raw = Array.isArray(res) ? res : (res as any)?.items || [];
      const items = raw.map((r: any) => {
        const id = r.id || r.ordenId;
        const nombre = r.retiroNombre || r.datosRetiroTienda?.nombreQuienRetira || r.clienteNombre || '';
        const cedula = r.retiroCedula || r.datosRetiroTienda?.cedulaQuienRetira || '';
        const telefono = r.retiroTelefono || r.datosRetiroTienda?.telefonoContacto || '';
        const fecha = r.retiroFecha || r.fechaRetiro || r.datosRetiroTienda?.fechaRetiro || '';
        const franja = r.retiroFranja || r.franjaHoraria || r.datosRetiroTienda?.franjaHoraria || '';
        return {
          ...r,
          id,
          ordenId: r.ordenId || id,
          numeroOrden: r.numeroOrden,
          estadoOrden: r.estadoOrden,
          estadoPago: r.estadoPago || (r.estadoOrden === 'Pagada' ? 'Pagada' : r.estadoOrden),
          total: r.total ?? r.totalPagado ?? 0,
          codigoRetiro: r.codigoRetiro,
          clienteNombre: nombre,
          fechaRetiro: fecha,
          franjaHoraria: franja,
          datosRetiroTienda: {
            nombreQuienRetira: nombre,
            cedulaQuienRetira: cedula,
            telefonoContacto: telefono,
            fechaRetiro: fecha,
            franjaHoraria: franja,
          },
        };
      });
      this.retiros.set(items);
    } catch (e) {
      this.error.set(this.msgError(e));
    } finally {
      this.loading.set(false);
    }
  }

  abrirModalConfirmacion(r: OrdenRetiroDto) {
    this.error.set('');
    this.ordenAConfirmar.set(r);
  }

  cerrarModal() {
    this.ordenAConfirmar.set(null);
  }

  async confirmarModal() {
    const orden = this.ordenAConfirmar();
    if (!orden) return;
    await this.marcarRetirado(orden);
  }

  async marcarRetirado(r: OrdenRetiroDto) {
    const ordenId = r.id || r.ordenId;
    if (!ordenId) {
      this.error.set('No se encontró el identificador de la orden.');
      return;
    }
    this.loading.set(true);
    try {
      await firstValueFrom(this.api.marcarOrdenRetirada(ordenId));
      this.message.set('Orden marcada como retirada en tienda.');
      this.cerrarModal();
      await this.cargar();
    } catch (e) {
      this.error.set(this.msgError(e));
    } finally {
      this.loading.set(false);
    }
  }

  msgError(e: any) {
    const p = e?.error;
    if (e?.status === 0) return 'No se pudo conectar con la API.';
    return [p?.mensaje || p?.detail || p?.title || e?.message || 'No se pudo completar la operación.', p?.traceId ? 'Referencia: ' + p.traceId : ''].filter(Boolean).join(' ');
  }
}

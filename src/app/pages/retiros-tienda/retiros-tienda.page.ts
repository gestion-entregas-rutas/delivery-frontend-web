import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

  readonly filtrados = computed(() => {
    const q = this.buscar().trim().toLocaleLowerCase();
    if (!q) return this.retiros();
    return this.retiros().filter((r) => {
      const cedula = r.datosRetiroTienda?.cedulaQuienRetira || '';
      const nombre = r.datosRetiroTienda?.nombreQuienRetira || r.clienteNombre || '';
      const codigo = r.codigoRetiro || r.numeroOrden || '';
      return `${cedula} ${nombre} ${codigo} ${r.id}`.toLocaleLowerCase().includes(q);
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
      const items = Array.isArray(res) ? res : res?.items || [];
      this.retiros.set(items);
    } catch (e) {
      this.error.set(this.msgError(e));
    } finally {
      this.loading.set(false);
    }
  }

  async marcarRetirado(r: OrdenRetiroDto) {
    if (!confirm(`¿Confirmar entrega en mostrador de la orden ${r.numeroOrden || r.id}?`)) return;
    try {
      await firstValueFrom(this.api.marcarOrdenRetirada(r.id));
      this.message.set('Orden marcada como retirada en tienda.');
      await this.cargar();
    } catch (e) {
      this.error.set(this.msgError(e));
    }
  }

  msgError(e: any) {
    const p = e?.error;
    if (e?.status === 0) return 'No se pudo conectar con la API.';
    return [p?.mensaje || p?.detail || p?.title || e?.message || 'No se pudo completar la operación.', p?.traceId ? 'Referencia: ' + p.traceId : ''].filter(Boolean).join(' ');
  }
}

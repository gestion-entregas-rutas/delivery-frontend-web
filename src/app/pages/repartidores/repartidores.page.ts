import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { RutaDto } from '../../core/models/logistica.models';

@Component({
  selector: 'app-repartidores-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repartidores.page.html',
  styleUrl: './repartidores.page.css',
})
export class RepartidoresPage {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);

  readonly searchQuery = signal('');
  readonly statusFilter = signal<'Todos' | 'Disponible' | 'EnRuta' | 'NoDisponible'>('Todos');

  constructor() {
    this.operations.view.set('Repartidores');
  }

  readonly totalRepartidores = computed(() => this.operations.repartidores().length);
  readonly disponiblesCount = computed(
    () => this.operations.repartidores().filter((d) => d.estado === 'Disponible').length
  );
  readonly enRutaCount = computed(
    () => this.operations.repartidores().filter((d) => d.estado === 'EnRuta').length
  );
  readonly noDisponiblesCount = computed(
    () => this.operations.repartidores().filter((d) => d.estado === 'NoDisponible').length
  );
  readonly capacidadTotal = computed(() =>
    this.operations.repartidores().reduce((acc, d) => acc + (d.capacidadMaxima || 0), 0)
  );
  readonly rutasHoyCount = computed(() => this.operations.rutas().length);

  readonly filteredRepartidores = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    return this.operations.repartidores().filter((d) => {
      const matchSearch =
        !q ||
        d.nombre.toLowerCase().includes(q) ||
        d.telefono.toLowerCase().includes(q);
      const matchStatus = status === 'Todos' || d.estado === status;
      return matchSearch && matchStatus;
    });
  });

  getRutaInfo(repartidorId: string): {
    ruta: RutaDto;
    zonaNombre: string;
    paradasTotal: number;
    entregadas: number;
    progreso: number;
  } | null {
    const r = this.operations.rutas().find((rt) => rt.repartidorId === repartidorId);
    if (!r) return null;
    const zona = this.operations.zonas().find((z) => z.id === r.zonaId);
    const paradasTotal = r.paradas?.length || 0;
    const entregadas = r.paradas?.filter((p) => p.pedido?.estado === 'Entregado').length || 0;
    const progreso = paradasTotal > 0 ? Math.round((entregadas / paradasTotal) * 100) : 0;
    return {
      ruta: r,
      zonaNombre: zona?.nombre || 'Zona asignada',
      paradasTotal,
      entregadas,
      progreso,
    };
  }

  verRuta(ruta: RutaDto): void {
    this.operations.zona = '';
    this.operations.selectRoute(ruta);
    this.operations.navigate('Rutas');
  }
}

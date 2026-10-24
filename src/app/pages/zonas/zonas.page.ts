import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { ZoneCoverageMap } from '../../shared/components/zone-coverage-map/zone-coverage-map';
import { ZonaDto } from '../../core/models/logistica.models';

export interface DriverRosterUI {
  id: string;
  nombre: string;
  telefono: string;
  avatar: string;
  zonaId: string;
  zonaNombre: string;
  estado: 'EnRuta' | 'Disponible' | 'Pausa';
  vehiculo: string;
  bateria: number;
  lat: number;
  lng: number;
  capacidadUsada: number;
  capacidadTotal: number;
}

@Component({
  selector: 'app-zonas-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ZoneCoverageMap],
  templateUrl: './zonas.page.html',
})
export class ZonasPage {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);

  readonly activeTab = signal<'dual' | 'zonas' | 'repartidores'>('dual');
  readonly selectedZoneId = signal<string | null>(null);
  readonly toastVisible = signal<boolean>(false);
  readonly toastTitle = signal<string>('');
  readonly toastMessage = signal<string>('');

  // Driver roster matching DiseoZonaGeografica.html
  readonly driversList = signal<DriverRosterUI[]>([
    {
      id: 'REP-01',
      nombre: 'Carlos Mendoza',
      telefono: '+56 9 8123 4567',
      avatar: 'CM',
      zonaId: 'zona-oriente',
      zonaNombre: 'Zona Oriente - Las Condes',
      estado: 'EnRuta',
      vehiculo: 'Moto Eléctrica • ABC-12',
      bateria: 84,
      lat: -33.4132,
      lng: -70.5983,
      capacidadUsada: 3,
      capacidadTotal: 4,
    },
    {
      id: 'REP-02',
      nombre: 'Rodrigo Araya',
      telefono: '+56 9 7444 3322',
      avatar: 'RA',
      zonaId: 'zona-centro',
      zonaNombre: 'Zona Centro - Santiago D',
      estado: 'EnRuta',
      vehiculo: 'Furgón Ligero • DFR-88',
      bateria: 92,
      lat: -33.4489,
      lng: -70.6693,
      capacidadUsada: 4,
      capacidadTotal: 4,
    },
    {
      id: 'REP-03',
      nombre: 'Matías Silva',
      telefono: '+56 9 6111 8900',
      avatar: 'MS',
      zonaId: 'zona-norte',
      zonaNombre: 'Zona Norte - Chicureo',
      estado: 'Disponible',
      vehiculo: 'Moto Combustión • KLP-90',
      bateria: 100,
      lat: -33.328,
      lng: -70.672,
      capacidadUsada: 0,
      capacidadTotal: 4,
    },
    {
      id: 'REP-04',
      nombre: 'Esteban Morales',
      telefono: '+56 9 5222 1199',
      avatar: 'EM',
      zonaId: 'zona-sur',
      zonaNombre: 'Zona Sur - San Miguel',
      estado: 'EnRuta',
      vehiculo: 'Bicicleta Cargo • E-CARGO',
      bateria: 68,
      lat: -33.498,
      lng: -70.652,
      capacidadUsada: 2,
      capacidadTotal: 4,
    },
  ]);

  readonly activeDriversCount = computed(
    () => this.driversList().filter((d) => d.estado === 'EnRuta' || d.estado === 'Disponible').length,
  );

  constructor() {
    this.operations.view.set('Zonas');
  }

  routeCount(id: string): number {
    return this.operations.rutas().filter((r) => r.zonaId === id && r.estado !== 'Cancelada').length;
  }

  selectZone(zone: ZonaDto) {
    this.selectedZoneId.set(zone.id);
  }

  showToast(title: string, message: string) {
    this.toastTitle.set(title);
    this.toastMessage.set(message);
    this.toastVisible.set(true);
    setTimeout(() => this.toastVisible.set(false), 3500);
  }
}

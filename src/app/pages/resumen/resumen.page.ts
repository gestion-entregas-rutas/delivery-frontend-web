import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { OrdersTable } from '../../shared/components/orders-table/orders-table';

export interface RouteManifestItemUI {
  id: string;
  rutaCodigo: string;
  zonaNombre: string;
  zonaColor: string;
  operadorNombre: string;
  vehiculo: string;
  avatarUrl: string;
  capacidadOcupada: number;
  capacidadTotal: number;
  capacidadPct: string;
  paradas: { numero: number; estado: 'ok' | 'curso' | 'prog' | 'vacio' | 'trafico'; label: string }[];
  eta: string;
  estadoSla: 'tiempo' | 'riesgo';
}

export interface LastMinuteAlertUI {
  id: string;
  codigo: string;
  tiempo: string;
  direccion: string;
  zona: string;
  estado: 'smart-assigned' | 'saturated' | 'auto-batch' | 'vip';
  mensaje: string;
  submensaje?: string;
  etaOInfo: string;
  vipTag?: string;
  descartada?: boolean;
}

@Component({
  selector: 'app-resumen-page',
  standalone: true,
  imports: [CommonModule, FormsModule, OrdersTable],
  templateUrl: './resumen.page.html',
})
export class ResumenPage {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);

  readonly selectedZoneChip = signal<string>('todos');
  readonly routeFilterQuery = signal<string>('');
  readonly toastVisible = signal<boolean>(false);
  readonly toastTitle = signal<string>('');
  readonly toastMessage = signal<string>('');

  // Real-time last minute alerts stream from CentroControlDespacho.html
  readonly alerts = signal<LastMinuteAlertUI[]>([
    {
      id: 'alert-1',
      codigo: '#ORD-9942',
      tiempo: 'Hace 2m',
      direccion: 'Av. Horacio 1420, Polanco (Zona Poniente)',
      zona: 'Poniente',
      estado: 'smart-assigned',
      mensaje: 'Insertado en Ruta #14 (3/4 cupos)',
      etaOInfo: 'ETA +12m',
    },
    {
      id: 'alert-2',
      codigo: '#ORD-9943',
      tiempo: 'Hace 4m',
      direccion: 'Insurgentes Sur 2200, San Ángel (Zona Sur)',
      zona: 'Sur',
      estado: 'saturated',
      mensaje: 'Sin cupo en zona - Se requiere nueva ruta',
      submensaje: 'Rutas #21, #22 y #24 ya alcanzaron el tope (4/4 pedidos).',
      etaOInfo: 'Crítico',
    },
    {
      id: 'alert-3',
      codigo: '#ORD-9944',
      tiempo: 'Hace 7m',
      direccion: 'Paseo de la Reforma 250, Juárez (Zona Centro)',
      zona: 'Centro',
      estado: 'auto-batch',
      mensaje: 'Insertado en Ruta #08 (4/4 cupos)',
      etaOInfo: 'Llenado Completo',
    },
    {
      id: 'alert-4',
      codigo: '#ORD-9945',
      tiempo: 'Hace 11m',
      direccion: 'Av. Universidad 1800, Coyoacán',
      zona: 'Sur',
      estado: 'vip',
      vipTag: 'VIP Florería',
      mensaje: 'Insertado en Ruta #19 (2/4 cupos)',
      etaOInfo: 'Ventana < 40 min',
    },
  ]);

  // Route Manifest items from CentroControlDespacho.html
  readonly manifestRoutes = signal<RouteManifestItemUI[]>([
    {
      id: 'R-14',
      rutaCodigo: 'Ruta #14',
      zonaNombre: 'Zona Poniente (Polanco)',
      zonaColor: 'text-primary',
      operadorNombre: 'Marco Soto',
      vehiculo: 'Van Transit • 482-BXZ',
      avatarUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAISh5W5Bx-W9nEjO53-T7Z_wByqTFOpdjqM4Jt1FuxTKi1EsJ9W0f3wiA4SPY9zK4gdgeVbPaWFy7dKNOSs4wEagoaOxmkl-pSv_ngz3z8QlTdEk0tL4v5FHz5saXRH7eL58--o5JxZ5_9HGgb17eXFuBNe-Q4ovlUqviiM86k5TWP0lfQCAsZjJYctbOY65rUNgD5Vr-eTF_YLrGLpijh52cVRruviiM58WGtBY6yjN-wGwEFuVUILg',
      capacidadOcupada: 3,
      capacidadTotal: 4,
      capacidadPct: '75%',
      paradas: [
        { numero: 1, estado: 'ok', label: '1. OK' },
        { numero: 2, estado: 'curso', label: '2. En curso' },
        { numero: 3, estado: 'prog', label: '3. Prog' },
        { numero: 4, estado: 'vacio', label: '4. Vacío' },
      ],
      eta: '15:18 (8 min)',
      estadoSla: 'tiempo',
    },
    {
      id: 'R-08',
      rutaCodigo: 'Ruta #08',
      zonaNombre: 'Zona Centro (Roma - Condesa)',
      zonaColor: 'text-status-routing',
      operadorNombre: 'Valeria Paredes',
      vehiculo: 'E-Scooter Cargo • M-90',
      avatarUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuD-qGexCQGV-LwL96Rb08wDQglR38weIeuHjeWZbRsJYf0iwxzOegDDkFErp0-ffLrq7OM6_IKA_moUOx-qcEHPpIQcZ0Nl4zo8R8FiJ269du9w597fzOsYe_h-I7iNxWPQph95SIBVQwMNPdc7p2Tj9LeyfqYlkbq6-BF1XbVJVJ2-J3dsdGu0fIMX7no9TU4QukCaPwpHiw5COQolXRK626wPjFWAA_d4_iXfqcjc191iUI8Ddcf_Gw',
      capacidadOcupada: 4,
      capacidadTotal: 4,
      capacidadPct: '100% LLENO',
      paradas: [
        { numero: 1, estado: 'ok', label: '1. OK' },
        { numero: 2, estado: 'ok', label: '2. OK' },
        { numero: 3, estado: 'curso', label: '3. Prox' },
        { numero: 4, estado: 'prog', label: '4. San Val' },
      ],
      eta: '15:32 (22 min)',
      estadoSla: 'tiempo',
    },
    {
      id: 'R-22',
      rutaCodigo: 'Ruta #22',
      zonaNombre: 'Zona Sur (Coyoacán - Tlalpan)',
      zonaColor: 'text-primary',
      operadorNombre: 'Carlos Mendoza',
      vehiculo: 'Partner EV • 731-NPR',
      avatarUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBrTHg-qlYoHi4sIRR1ab3oCBjE6MF1Ci8AOLhjSlVbw2dCF7U_ccQw8kUvQzl9Htluqn5cO1RqldaJASWVFMMP3ydD3U9zhaXRwD9MYRmRgBUN53f1fenD_d5fpsSxQdxkOdq--5Njj_U0d-qfFJJMjUo_cFuWXrHeXFra-C6hF8UcEEyLLWsgxlfZOYPBMF2UFO8Ww6dOv2pN0vU3ApmRn2taA3SrwjLjRFTwMAhWx-SMYARE8dbL6A',
      capacidadOcupada: 4,
      capacidadTotal: 4,
      capacidadPct: '100% LLENO',
      paradas: [
        { numero: 1, estado: 'ok', label: '1. OK' },
        { numero: 2, estado: 'trafico', label: '2. Tráfico (+18m)' },
        { numero: 3, estado: 'prog', label: '3. Pend' },
        { numero: 4, estado: 'prog', label: '4. Pend' },
      ],
      eta: '16:05 (Demora)',
      estadoSla: 'riesgo',
    },
  ]);

  readonly activeAlerts = computed(() => this.alerts().filter((a) => !a.descartada));

  readonly filteredRoutes = computed(() => {
    const q = this.routeFilterQuery().toLowerCase().trim();
    if (!q) return this.manifestRoutes();
    return this.manifestRoutes().filter(
      (r) =>
        r.operadorNombre.toLowerCase().includes(q) ||
        r.rutaCodigo.toLowerCase().includes(q) ||
        r.zonaNombre.toLowerCase().includes(q),
    );
  });

  constructor() {
    this.operations.view.set('Resumen');
  }

  setZoneChip(chip: string) {
    this.selectedZoneChip.set(chip);
    this.showToast('Filtro de Zona', `Filtrando cuadrante ${chip.toUpperCase()}`);
  }

  createExpressRoute(alert: LastMinuteAlertUI) {
    this.showToast(
      'Ruta Express Creada',
      `Asignado pedido ${alert.codigo} a unidad de apoyo para ${alert.zona}`,
    );
    this.dismissAlert(alert.id);
  }

  dismissAlert(id: string) {
    this.alerts.update((prev) =>
      prev.map((a) => (a.id === id ? { ...a, descartada: true } : a)),
    );
  }

  reassignStop(route: RouteManifestItemUI) {
    this.showToast(
      'Reasignación Dinámica',
      `Ventana de transferencia abierta para ${route.rutaCodigo}`,
    );
  }

  showToast(title: string, message: string) {
    this.toastTitle.set(title);
    this.toastMessage.set(message);
    this.toastVisible.set(true);
    setTimeout(() => this.toastVisible.set(false), 3500);
  }
}

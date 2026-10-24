import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { RouteWorkspace } from '../../shared/components/route-workspace/route-workspace';

export interface PendingOrder {
  code: string;
  zone: 'Centro' | 'Norte' | 'Sur';
  zoneLabel: string;
  badgeClass: string;
  window: string;
  isUrgent: boolean;
  client: string;
  address: string;
  details: string;
  tag: string;
}

export interface SimulationEvent {
  id: string;
  type: 'auto' | 'new_route' | 'evaluating';
  badge: string;
  badgeClass: string;
  timeAgo: string;
  borderClass: string;
  icon: string;
  iconClass: string;
  titleHtml: string;
  subtitle: string;
  actionText?: string;
  capacityText: string;
  capacityBadge: string;
  capacityBadgeClass: string;
}

export interface RouteStop {
  num: number;
  address: string;
  time: string;
  status: 'delivered' | 'in_transit' | 'pending' | 'auto_inserted';
}

export interface RouteCardItem {
  id: string;
  routeNumber: string;
  zone: string;
  zoneBadgeClass: string;
  driverName: string;
  driverAvatar: string;
  vehicle: string;
  vehicleIcon: string;
  statusText: string;
  statusBadgeClass: string;
  cupoText: string;
  cupoSubtext: string;
  cupoSubtextClass: string;
  progressPercent: number;
  progressBarClass: string;
  stops: RouteStop[];
  hasDropPlaceholder?: boolean;
  distanceTime: string;
  actionButtonLabel: string;
}

@Component({
  selector: 'app-rutas-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouteWorkspace],
  templateUrl: './rutas.page.html',
})
export class RutasPage {
  readonly operations = inject(OperationsService);

  readonly selectedModel = signal('Capacitated VRP con Ventanas Horarias (CVRPTW)');
  readonly batchCount = signal(48);
  readonly pendingFilter = signal<'Todas' | 'Centro' | 'Norte' | 'Sur'>('Todas');
  readonly pendingSearch = signal('');
  readonly viewMode = signal<'mosaico' | 'cronograma' | 'mapa'>('mosaico');
  readonly optimizingMock = signal(false);
  readonly toastMessage = signal<string | null>(null);

  readonly models = [
    'Capacitated VRP con Ventanas Horarias (CVRPTW)',
    'Clustering K-Means + Vecino Más Cercano (NN)',
    'Asignación Húngara Bipartita (Mínima Distancia)',
    'Metaheurística Recocido Simulado (Simulated Annealing)',
  ];

  readonly liveEvents = signal<SimulationEvent[]>([
    {
      id: '#9841',
      type: 'auto',
      badge: 'Auto-Insertado',
      badgeClass: 'bg-status-delivered/15 text-status-delivered',
      timeAgo: 'Hace 2m',
      borderClass: 'bg-status-delivered',
      icon: 'alt_route',
      iconClass: 'text-status-delivered',
      titleHtml: 'Insertado en <strong class="text-primary">Ruta R-04</strong>',
      subtitle: 'Repartidor: Carlos Mendoza (Van EV)',
      capacityText: 'Capacidad Resultante',
      capacityBadge: 'Cupo 4/4 Completo',
      capacityBadgeClass: 'bg-status-urgent/15 text-status-urgent',
    },
    {
      id: '#9842',
      type: 'new_route',
      badge: 'Nueva Ruta Creada',
      badgeClass: 'bg-status-routing/15 text-status-routing',
      timeAgo: 'Hace 4m',
      borderClass: 'bg-status-routing',
      icon: 'add_circle',
      iconClass: 'text-status-routing',
      titleHtml: 'Zona Sur saturada → <strong class="text-secondary">Ruta R-19 Generada</strong>',
      subtitle: 'Asignado: Diego Morales (Flota de Reserva)',
      capacityText: 'Capacidad Inicial',
      capacityBadge: 'Cupo 1/4 (3 disponibles)',
      capacityBadgeClass: 'bg-status-delivered/15 text-status-delivered',
    },
    {
      id: '#9843',
      type: 'evaluating',
      badge: 'Evaluando Concurrencia',
      badgeClass: 'bg-status-in-transit/15 text-status-in-transit',
      timeAgo: 'Hace 30s',
      borderClass: 'bg-status-in-transit',
      icon: 'sync',
      iconClass: 'text-status-in-transit',
      titleHtml: 'Afinidad: <strong class="text-on-surface">Ruta R-02 (Zona Norte)</strong>',
      subtitle: 'Desvío marginal calculado: +1.2 km / 4 min',
      actionText: 'Validar Inserción',
      capacityText: 'Decisión Heurística',
      capacityBadge: 'En evaluación',
      capacityBadgeClass: 'bg-status-in-transit/15 text-status-in-transit',
    },
  ]);

  readonly pendingOrders = signal<PendingOrder[]>([
    {
      code: '#ORD-9901',
      zone: 'Centro',
      zoneLabel: 'Zona Centro',
      badgeClass: 'bg-tint-teal/15 text-tint-teal',
      window: '11:00 - 12:00',
      isUrgent: true,
      client: 'Boutique Los Conquistadores',
      address: 'Av. Pedro de Valdivia 1240, Providencia',
      details: '2 bultos (3.4 kg)',
      tag: 'Cobro: Pagado',
    },
    {
      code: '#ORD-9904',
      zone: 'Norte',
      zoneLabel: 'Zona Norte',
      badgeClass: 'bg-status-routing/15 text-status-routing',
      window: '12:00 - 13:30',
      isUrgent: false,
      client: 'Clínica Odontológica Bellavista',
      address: 'Constitución 184, Recoleta',
      details: '1 paquete delicado (0.8 kg)',
      tag: 'Firma Requerida',
    },
    {
      code: '#ORD-9908',
      zone: 'Centro',
      zoneLabel: 'Zona Centro',
      badgeClass: 'bg-tint-teal/15 text-tint-teal',
      window: '13:00 - 14:00',
      isUrgent: false,
      client: 'Estudio Arquitectura PlanV',
      address: 'Miraflores 455, Of. 802, Santiago',
      details: '1 caja planos (1.2 kg)',
      tag: 'Prioritario',
    },
    {
      code: '#ORD-9912',
      zone: 'Sur',
      zoneLabel: 'Zona Sur (Baja Densidad)',
      badgeClass: 'bg-tint-purple/15 text-tint-purple',
      window: '14:00 - 16:00',
      isUrgent: false,
      client: 'Residencial Valle Lo Campino',
      address: 'Av. Las Parcelas 8802, San Bernardo',
      details: '3 bultos (14.0 kg)',
      tag: 'Ruta Simple Permitida',
    },
    {
      code: '#ORD-9915',
      zone: 'Centro',
      zoneLabel: 'Zona Centro',
      badgeClass: 'bg-tint-teal/15 text-tint-teal',
      window: '15:00 - 16:30',
      isUrgent: false,
      client: 'Librería & Café Metropolitano',
      address: 'Huérfanos 830, Local 14, Santiago',
      details: '1 bulto (2.1 kg)',
      tag: 'Cobro: Pagado',
    },
    {
      code: '#ORD-9918',
      zone: 'Norte',
      zoneLabel: 'Zona Norte',
      badgeClass: 'bg-status-routing/15 text-status-routing',
      window: '16:00 - 17:00',
      isUrgent: false,
      client: 'Laboratorio Farmacéutico Sanitas',
      address: 'Av. Recoleta 1450, Recoleta',
      details: '1 contenedor térmico (1.5 kg)',
      tag: 'Frío Controlado',
    },
    {
      code: '#ORD-9922',
      zone: 'Sur',
      zoneLabel: 'Zona Sur',
      badgeClass: 'bg-tint-purple/15 text-tint-purple',
      window: '16:30 - 18:00',
      isUrgent: false,
      client: 'Distribuidora Alimentos del Sur',
      address: 'Gran Avenida 7200, La Cisterna',
      details: '4 bultos (18.5 kg)',
      tag: 'Descarga con Asistente',
    },
  ]);

  readonly routeCards = signal<RouteCardItem[]>([
    {
      id: 'r-01',
      routeNumber: 'Ruta #01',
      zone: 'Centro Norte',
      zoneBadgeClass: 'bg-tint-teal/15 text-tint-teal',
      driverName: 'Valentina Silva',
      driverAvatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDNUEdtz55qDQWaOdylbFel_GTgG4azg6E_U4M3u4ogO1qbPH3U7ZT_VUEW75NQGGksbYuVwwHCk85a1h1KiAHa6dEl9slI6Jwye5xN5DHiGQVNdOKidqhwW10Tli596OUh0Hf7hF9_00cJ6fTdPnA5q2zq5-TRBMxY_Sw01XArBr4cMLRGwoiKMb0rp3kRYO4ds6XQPXqA-8nghOygGZCJLHs-T8LHbzKlMJbczDR37h6gvPUgJiqt6w',
      vehicle: 'Moto Eléctrica',
      vehicleIcon: 'two_wheeler',
      statusText: 'En Ruta',
      statusBadgeClass: 'bg-status-delivered/15 text-status-delivered',
      cupoText: 'Cupo: 3/4 Pedidos',
      cupoSubtext: '1 cupo libre',
      cupoSubtextClass: 'text-primary font-medium',
      progressPercent: 75,
      progressBarClass: 'bg-primary',
      distanceTime: '8.4 km total • 52 min',
      actionButtonLabel: 'Reordenar',
      stops: [
        {
          num: 1,
          address: "Av. Libertador Bernardo O'Higgins 1449",
          time: '10:15 hrs • Entregado #9820',
          status: 'delivered',
        },
        {
          num: 2,
          address: 'Los Leones 2200, Providencia',
          time: '10:48 hrs (Estimado) • En camino',
          status: 'in_transit',
        },
        {
          num: 3,
          address: 'Eliodoro Yáñez 850',
          time: '11:20 hrs • Pendiente',
          status: 'pending',
        },
      ],
    },
    {
      id: 'r-02',
      routeNumber: 'Ruta #02',
      zone: 'Zona Centro',
      zoneBadgeClass: 'bg-tint-teal/15 text-tint-teal',
      driverName: 'Mateo Alarcón',
      driverAvatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuD7m9vutJ11cLZM1KV3A57orgXIoGOo7gdjjUbEFpB6rKXhsCxv54os3on4ffxallw00eXUOavG8huc28hcKcUJxJ1GRAjPZ77T0LFcKaz7wuaTDapGsHhJfr2skNEaS13fjOQBdGQRFq4tzQ_V8v1mIYSBx-xwZ_o8AINHfQG5TrPtKfqybCKc2dmXnIkRzZVuvh_XcSOYd9P8UVOw8LPexUioM7mw_HgeCZvNR0x7A5wuxm0dhpzLlw',
      vehicle: 'Furgón L1',
      vehicleIcon: 'local_shipping',
      statusText: 'En Despacho',
      statusBadgeClass: 'bg-status-in-transit/15 text-status-in-transit',
      cupoText: 'Cupo: 4/4 Pedidos [Lleno]',
      cupoSubtext: 'Máximo alcanzado',
      cupoSubtextClass: 'text-status-urgent font-bold',
      progressPercent: 100,
      progressBarClass: 'bg-status-urgent',
      distanceTime: '11.2 km total • 1h 15m',
      actionButtonLabel: 'Secuencia',
      stops: [
        {
          num: 1,
          address: 'Moneda 920, Santiago Centro',
          time: '10:05 hrs',
          status: 'delivered',
        },
        {
          num: 2,
          address: 'Agustinas 1442, Torre B',
          time: '10:35 hrs',
          status: 'in_transit',
        },
        {
          num: 3,
          address: 'Huérfanos 1102',
          time: '11:10 hrs',
          status: 'pending',
        },
        {
          num: 4,
          address: 'Mac Iver 325',
          time: '11:45 hrs',
          status: 'pending',
        },
      ],
    },
    {
      id: 'r-03',
      routeNumber: 'Ruta #03',
      zone: 'Zona Oriente',
      zoneBadgeClass: 'bg-tint-purple/15 text-tint-purple',
      driverName: 'Gonzalo Parra',
      driverAvatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDJDAkXNmjnqTnJviqngVVPVdgWvjy-YgpNVvrHS7FrjsOwuVZgs_lLotUj24ltmf06Bcq7wcSttZ5vK0c998TEoTe7s8fsbFmb22QVBsC0DdFxIs137iN0fOXD3llDHUqWOOmMYRV0V9oB33zOqqmzobMFyEVy2aXvuK1MXmxfU02_7PkXE0EplmJ9RXS7Ee8Ss9augRcQbqfDIPpQsm4qf_MqnpaCrVZRvqZE5PRGkhOdZpDjf7Tfow',
      vehicle: 'Utilitario EV',
      vehicleIcon: 'electric_car',
      statusText: 'En Armado',
      statusBadgeClass: 'bg-status-routing/15 text-status-routing',
      cupoText: 'Cupo: 2/4 Pedidos',
      cupoSubtext: '2 espacios disponibles',
      cupoSubtextClass: 'text-status-delivered font-semibold',
      progressPercent: 50,
      progressBarClass: 'bg-status-delivered',
      distanceTime: '9.1 km total • 44 min',
      actionButtonLabel: 'Completar',
      hasDropPlaceholder: true,
      stops: [
        {
          num: 1,
          address: 'Alonso de Córdova 3890, Vitacura',
          time: '12:15 hrs',
          status: 'pending',
        },
        {
          num: 2,
          address: 'Av. Las Condes 10400',
          time: '12:50 hrs',
          status: 'pending',
        },
      ],
    },
    {
      id: 'r-04',
      routeNumber: 'Ruta #04',
      zone: 'Zona Centro',
      zoneBadgeClass: 'bg-tint-teal/15 text-tint-teal',
      driverName: 'Carlos Mendoza',
      driverAvatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDP8QnyffdtMLuSR9iTBZ_Ej-LJr2tfWoUeBNxu929c6HFOKb3vicBTmFhoishLg0zjc8ElNs2wNaD6dIQKqIH7rM79sgeMlE0TZa0PKIlP0rOFyBOIZ5ePJup9QGBvuAlYiFFojiQqbn1tw7mr-DrJ7MzkhSraQ13XWMBJu-hHOXcpUQUcMMO5NuU57Y4pOF9mfS3MAjXCGAwj2AKVvPZXNd2_pppUbQALgvni4z9O_-dbrDrCQGdHGg',
      vehicle: 'Van EV Express',
      vehicleIcon: 'local_shipping',
      statusText: 'En Ruta',
      statusBadgeClass: 'bg-status-delivered/15 text-status-delivered',
      cupoText: 'Cupo: 4/4 [Reoptimizado Same-Day]',
      cupoSubtext: 'Completo',
      cupoSubtextClass: 'text-status-urgent font-bold',
      progressPercent: 100,
      progressBarClass: 'bg-status-urgent',
      distanceTime: '14.6 km total • 1h 22m',
      actionButtonLabel: 'Ver Mapa',
      stops: [
        {
          num: 1,
          address: 'Santa Isabel 0412',
          time: '10:10 hrs',
          status: 'delivered',
        },
        {
          num: 2,
          address: 'Vicuña Mackenna 102',
          time: '10:40 hrs',
          status: 'in_transit',
        },
        {
          num: 3,
          address: 'Bustamante 88',
          time: '11:05 hrs',
          status: 'pending',
        },
        {
          num: 4,
          address: 'Portugal 340 (Auto #9841)',
          time: '11:35 hrs',
          status: 'auto_inserted',
        },
      ],
    },
    {
      id: 'r-05',
      routeNumber: 'Ruta #05',
      zone: 'Periferia Sur',
      zoneBadgeClass: 'bg-tint-purple/15 text-tint-purple',
      driverName: 'Felipe Santander',
      driverAvatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuByZE0gqokaAJsf69xkajKdQEPY829dg36AV_aQf_u3SyuZiYK6kHswER7pOgpW6niM7e6nS6_11rg8vb3tannrxmig9yFpOP8Bp4UMIiOpWgcCjo7gWnm-ugEuFooOceZjT6WQN6Atwca_xGjElzxbTrX4_zY54mcKDQu7dEyzlOChafLrZhQngXy5c0aBa9LQ_cR8X-pcXWF2prjSeW3qNVq-0IzqvX5gfejBmO4jhJMxw7-_o6-h9A',
      vehicle: 'Camioneta 4x2',
      vehicleIcon: 'local_shipping',
      statusText: 'Excepción Baja Densidad',
      statusBadgeClass: 'bg-status-delivered/15 text-status-delivered',
      cupoText: 'Cupo: 2/2 Pedidos (Regla Baja Densidad)',
      cupoSubtext: 'Ruta Optimizada',
      cupoSubtextClass: 'text-tint-purple font-bold',
      progressPercent: 100,
      progressBarClass: 'bg-tint-purple',
      distanceTime: '32.8 km total • 1h 45m',
      actionButtonLabel: 'Modificar',
      stops: [
        {
          num: 1,
          address: 'Camino Lonquén 10240, Calera de Tango',
          time: '11:30 hrs',
          status: 'in_transit',
        },
        {
          num: 2,
          address: 'Av. San Ignacio 451, Padre Hurtado',
          time: '12:20 hrs',
          status: 'pending',
        },
      ],
    },
    {
      id: 'r-06',
      routeNumber: 'Ruta #06',
      zone: 'Zona Norte',
      zoneBadgeClass: 'bg-status-routing/15 text-status-routing',
      driverName: 'Javiera Núñez',
      driverAvatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDSUZNwxOCbGRXQgWkMeaBmpHXlDtMpFRdrfu-kWhV5Sm6xSszwaDJRtGYORf7tb0xYCsM0FuPBnBHmWXzeqaubLUU8SUx3LreVShCYyzNi7x7Z56jinC7PBJaByP8wkFm31hhFK28egw16FvMm3kZacNo3zMzeZ1hPjTJcLgyfT38ziRbONKPuOG0Jhap62oyH52fc54TXpzXN_7tj_4nARzUlBNJyXr7hNoHlnP5Eig3B6Xk0XYWkRQ',
      vehicle: 'Scooter Cargo',
      vehicleIcon: 'two_wheeler',
      statusText: 'En Ruta',
      statusBadgeClass: 'bg-status-delivered/15 text-status-delivered',
      cupoText: 'Cupo: 3/4 Pedidos',
      cupoSubtext: '1 cupo libre',
      cupoSubtextClass: 'text-primary font-medium',
      progressPercent: 75,
      progressBarClass: 'bg-primary',
      distanceTime: '7.9 km total • 48 min',
      actionButtonLabel: 'Reordenar',
      stops: [
        {
          num: 1,
          address: 'Santos Dumont 990, Recoleta',
          time: '10:20 hrs',
          status: 'delivered',
        },
        {
          num: 2,
          address: 'Av. Recoleta 2400',
          time: '10:55 hrs',
          status: 'in_transit',
        },
        {
          num: 3,
          address: 'Dorsal 1340, Independencia',
          time: '11:30 hrs',
          status: 'pending',
        },
      ],
    },
  ]);

  readonly filteredPendingOrders = computed(() => {
    const filter = this.pendingFilter();
    const search = this.pendingSearch().trim().toLowerCase();

    return this.pendingOrders().filter((order) => {
      const matchFilter = filter === 'Todas' ? true : order.zone === filter;
      if (!matchFilter) return false;
      if (!search) return true;
      return (
        order.code.toLowerCase().includes(search) ||
        order.client.toLowerCase().includes(search) ||
        order.address.toLowerCase().includes(search) ||
        order.zoneLabel.toLowerCase().includes(search)
      );
    });
  });

  constructor() {
    this.operations.view.set('Rutas');
  }

  triggerOptimization(): void {
    this.optimizingMock.set(true);
    this.operations.buildRoutes();

    setTimeout(() => {
      this.optimizingMock.set(false);
      this.showToast(
        'Optimización heurística VRP ejecutada con éxito. 48 pedidos balanceados en 6 rutas operativas.',
      );
    }, 1200);
  }

  simulateInjection(): void {
    const nextId = `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const newEvent: SimulationEvent = {
      id: nextId,
      type: 'auto',
      badge: 'Auto-Insertado',
      badgeClass: 'bg-status-delivered/15 text-status-delivered',
      timeAgo: 'Justo ahora',
      borderClass: 'bg-status-delivered',
      icon: 'dynamic_feed',
      iconClass: 'text-status-delivered',
      titleHtml: `Inyectado en <strong class="text-primary">Ruta R-03</strong>`,
      subtitle: 'Repartidor: Gonzalo Parra (Utilitario EV)',
      capacityText: 'Capacidad Resultante',
      capacityBadge: 'Cupo 3/4',
      capacityBadgeClass: 'bg-primary/15 text-primary',
    };

    this.liveEvents.update((evs) => [newEvent, ...evs.slice(0, 3)]);
    this.batchCount.update((c) => c + 1);

    // Also update Ruta #03 capacity
    this.routeCards.update((cards) =>
      cards.map((c) => {
        if (c.id === 'r-03') {
          return {
            ...c,
            cupoText: 'Cupo: 3/4 Pedidos',
            cupoSubtext: '1 espacio disponible',
            cupoSubtextClass: 'text-primary font-medium',
            progressPercent: 75,
            progressBarClass: 'bg-primary',
            stops: [
              ...c.stops,
              {
                num: 3,
                address: 'Isidora Goyenechea 3000, Las Condes',
                time: '13:15 hrs (Same-Day)',
                status: 'auto_inserted' as const,
              },
            ],
            hasDropPlaceholder: false,
          };
        }
        return c;
      }),
    );

    this.showToast(`Nuevo pedido Same-Day ${nextId} inyectado y asignado dinámicamente a Ruta #03.`);
  }

  validateInsertion(ev: SimulationEvent): void {
    ev.type = 'auto';
    ev.badge = 'Auto-Insertado';
    ev.badgeClass = 'bg-status-delivered/15 text-status-delivered';
    ev.borderClass = 'bg-status-delivered';
    ev.capacityBadge = 'Cupo Confirmado';
    ev.capacityBadgeClass = 'bg-status-delivered/15 text-status-delivered';
    ev.actionText = undefined;
    this.showToast(`Inserción del pedido ${ev.id} validada y programada en Ruta R-02.`);
  }

  rebalanceAll(): void {
    this.showToast(
      'Rebalanceo global heurístico completado: Cargas niveladas equitativamente entre las 6 rutas activas.',
    );
  }

  assignPendingToFreeSlot(order: PendingOrder): void {
    this.pendingOrders.update((list) => list.filter((o) => o.code !== order.code));
    this.showToast(`Pedido ${order.code} asignado satisfactoriamente al espacio libre en Ruta #03.`);
  }

  showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => {
      if (this.toastMessage() === message) {
        this.toastMessage.set(null);
      }
    }, 4000);
  }
}

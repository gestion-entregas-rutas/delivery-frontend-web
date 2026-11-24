import {
  Component,
  computed,
  inject,
  signal,
  ViewChild,
  OnDestroy,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { ZoneCoverageMap } from '../../shared/components/zone-coverage-map/zone-coverage-map';
import { ZonaDto } from '../../core/models/logistica.models';
import { recentLocation } from '../../core/utils/gps-markers';
import { LocalLocationService } from '../../core/services/local-location.service';
import { containsPoint } from '../../core/utils/presentation';
import { firstValueFrom } from 'rxjs';
export interface DriverRosterUI {
  gpsText: string;
  routeId: string | null;
  id: string;
  nombre: string;
  telefono: string;
  avatar: string;
  zonaId: string;
  zonaNombre: string;
  estado: 'EnRuta' | 'Disponible' | 'NoDisponible';
  vehiculo: string;
  bateria: number | null;
  lat: number | null;
  lng: number | null;
  capacidadUsada: number;
  capacidadTotal: number;
}

@Component({
  selector: 'app-zonas-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ZoneCoverageMap],
  templateUrl: './zonas.page.html',
  styleUrl: './zonas.page.css',
})
export class ZonasPage implements OnDestroy {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);
  readonly local = inject(LocalLocationService);
  readonly editingZoneId = signal<string | null>(null);
  readonly localZones = computed(() => {
    const location = this.local.location();
    return location
      ? this.operations.zonas().filter((z) => containsPoint(location.ubicacion, z.poligono))
      : [];
  });
  @ViewChild(ZoneCoverageMap) coverage?: ZoneCoverageMap;
  readonly activeTab = signal<'dual' | 'zonas' | 'repartidores'>('dual');
  readonly selectedZoneId = signal<string | null>(null);
  readonly toastVisible = signal(false);
  readonly toastTitle = signal('');
  readonly toastMessage = signal('');
  private timer?: ReturnType<typeof setTimeout>;
  private gpsTimer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  private now = signal(Date.now());
  readonly driversList = computed<DriverRosterUI[]>(() =>
    this.operations.repartidores().map((d) => {
      const route = this.operations
        .rutas()
        .find(
          (r) => r.repartidorId === d.id && (r.estado === 'EnCurso' || r.estado === 'Planificada'),
        );
      const gps = this.operations.ubicaciones().find((p) => p.repartidorId === d.id);
      return {
        id: d.id,
        routeId: route?.id || null,
        nombre: d.nombre,
        telefono: d.telefono,
        avatar: d.nombre.slice(0, 2).toUpperCase(),
        zonaId: route?.zonaId || '',
        zonaNombre: route ? this.operations.zoneName(route.zonaId) : 'Sin ruta para esta fecha',
        estado: d.estado,
        vehiculo: 'No informado',
        bateria: null,
        lat: gps?.latitud ?? null,
        lng: gps?.longitud ?? null,
        gpsText: gps
          ? `${recentLocation(gps, this.now()) && route?.estado === 'EnCurso' ? 'Ubicación reciente' : 'Última ubicación conocida'} · ${new Date(gps.capturadaEn).toLocaleString('es-EC')} · Precisión: ${gps.precisionMetros == null ? 'No informada' : gps.precisionMetros + ' m'}`
          : 'Sin ubicación',
        capacidadUsada: route?.paradas.length || 0,
        capacidadTotal: route?.capacidad || d.capacidadMaxima,
      };
    }),
  );
  readonly activeDriversCount = computed(
    () =>
      this.driversList().filter((d) => d.estado === 'EnRuta' || d.estado === 'Disponible').length,
  );
  constructor() {
    afterNextRender(() => {
      this.gpsTimer = setInterval(() => this.now.set(Date.now()), 30000);
    });
    this.operations.view.set('Zonas');
  }
  routeCount(id: string) {
    return this.operations
      .rutas()
      .filter((r) => r.zonaId === id && (r.estado === 'Planificada' || r.estado === 'EnCurso'))
      .length;
  }
  selectZone(zone: ZonaDto) {
    this.selectedZoneId.set(zone.id);
    this.coverage?.focusZone(zone.id);
  }
  async editZone(zone: ZonaDto) {
    if (this.operations.saving() || this.editingZoneId()) return;
    this.editingZoneId.set(zone.id);
    this.operations.error.set('');
    try {
      const current = await firstValueFrom(this.operations.api.obtenerZona(zone.id));
      if (!this.destroyed) this.forms.open('Zona', current);
    } catch (e) {
      this.operations.showError(e);
    } finally {
      this.editingZoneId.set(null);
    }
  }
  viewRoute(driver: DriverRosterUI) {
    if (driver.routeId) this.operations.showOrderRoute(driver.routeId);
    else
      this.showToast(
        'Sin ruta activa',
        'Este repartidor no tiene una ruta para la fecha seleccionada.',
      );
  }
  async changeAvailability(driver: DriverRosterUI) {
    if (driver.estado === 'EnRuta') return;
    await this.operations.action(
      this.operations.api.cambiarDisponibilidad(driver.id, driver.estado !== 'Disponible'),
      'Disponibilidad actualizada.',
    );
  }
  showToast(title: string, message: string) {
    this.operations.message.set(message); // toast global
    clearTimeout(this.timer);
    this.toastTitle.set(title);
    this.toastMessage.set(message);
    this.toastVisible.set(true);
    this.timer = setTimeout(() => this.toastVisible.set(false), 3500);
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearInterval(this.gpsTimer);
    clearTimeout(this.timer);
  }
}

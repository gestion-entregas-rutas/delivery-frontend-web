import { TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { deliveryCoverage, distanceMiles } from '../utils/delivery-coverage';
import { ZonaDto } from '../models/logistica.models';
import { OperationsService } from './operations.service';
import { LOGISTICA_SERVER_URL } from './logistica-api.service';
import { LocalLocationService } from './local-location.service';
import { PedidosPage } from '../../pages/pedidos/pedidos.page';
import { AddressPicker } from '../../shared/components/address-picker/address-picker';

const fake = vi.hoisted(() => ({ polygons: [] as any[], markers: [] as any[] }));
vi.mock('leaflet', () => ({
  map: () => ({
    setView: vi.fn().mockReturnThis(),
    on: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
    invalidateSize: vi.fn(),
  }),
  tileLayer: () => ({ addTo: vi.fn() }),
  layerGroup: () => ({ addTo: vi.fn().mockReturnThis(), clearLayers: vi.fn() }),
  polygon: (points: any) => {
    fake.polygons.push(points);
    return { bindTooltip: vi.fn().mockReturnThis(), addTo: vi.fn() };
  },
  latLngBounds: vi.fn(),
  divIcon: (options: any) => options,
  marker: (coordinates: any) => {
    const marker = {
      coordinates,
      events: {} as Record<string, () => void>,
      addTo: vi.fn().mockReturnThis(),
      bindPopup: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      on(name: string, callback: () => void) {
        this.events[name] = callback;
        return this;
      },
      getLatLng() {
        return { lat: this.coordinates[0], lng: this.coordinates[1] };
      },
      dragging: { disable: vi.fn(), enable: vi.fn() },
    };
    fake.markers.push(marker);
    return marker;
  },
}));
const zone: ZonaDto = {
  id: 'zone',
  nombre: 'Zona central',
  activa: true,
  maxPedidosPorRuta: 4,
  poligono: [
    { latitud: 0, longitud: 0 },
    { latitud: 0, longitud: 1 },
    { latitud: 1, longitud: 1 },
    { latitud: 1, longitud: 0 },
  ],
};
const shop = {
  nombre: 'Tienda',
  direccion: 'Dirección del local',
  ubicacion: { latitud: 0, longitud: 0 },
};
describe('Cobertura real al registrar un pedido', () => {
  let http: HttpTestingController, operations: OperationsService, page: PedidosPage | undefined;
  beforeEach(() => {
    fake.polygons = [];
    fake.markers = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: LOGISTICA_SERVER_URL, useValue: 'http://localhost:5289' },
      ],
    });
    operations = TestBed.inject(OperationsService);
    operations.zonas.set([zone]);
    TestBed.inject(LocalLocationService).location.set(shop);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    page?.ngOnDestroy();
    page = undefined;
    http.verify();
  });
  it('calcula millas en línea recta y muestra la distancia real con dos decimales', () => {
    const outside = { latitud: -((((16.1 * 1609.344) / 6371008.8) * 180) / Math.PI), longitud: 0 };
    const result = deliveryCoverage(outside, [zone], shop.ubicacion);
    expect(result.covered).toBe(false);
    expect(result.message).toBe(
      'Este punto está a 16.10 mi de la tienda, fuera del área de cobertura real. Por favor elige otro punto más cercano.',
    );
    expect(distanceMiles(shop.ubicacion, shop.ubicacion)).toBe(0);
    expect(distanceMiles({ latitud: 0, longitud: 0 }, { latitud: 0, longitud: 1 })).toBeCloseTo(
      69.0934,
      3,
    );
  });
  it('usa la unión de polígonos activos, sin asumir cobertura por cercanía o por rectángulo global', () => {
    const second = {
      ...zone,
      id: 'second',
      poligono: zone.poligono.map((p) => ({ latitud: p.latitud, longitud: p.longitud + 3 })),
    };
    expect(
      deliveryCoverage({ latitud: 0.5, longitud: 3.5 }, [zone, second], shop.ubicacion).covered,
    ).toBe(true);
    expect(
      deliveryCoverage({ latitud: 0.5, longitud: 2 }, [zone, second], shop.ubicacion).covered,
    ).toBe(false);
    expect(deliveryCoverage({ latitud: -0.001, longitud: 0 }, [zone], shop.ubicacion).covered).toBe(
      false,
    );
    expect(
      deliveryCoverage(
        { latitud: 0.5, longitud: 0.5 },
        [{ ...zone, activa: false }],
        shop.ubicacion,
      ).covered,
    ).toBe(false);
  });
  it('no inventa distancia si el local no está configurado y mantiene la validación de cobertura', () => {
    const result = deliveryCoverage({ latitud: -1, longitud: -1 }, [zone], null);
    expect(result.miles).toBeNull();
    expect(result.message).not.toContain(' mi ');
    expect(result.message).toContain('Configura');
    expect(deliveryCoverage({ latitud: 0.5, longitud: 0.5 }, [zone], null).covered).toBe(true);
  });
  it('bloquea el envío fuera de cobertura incluso si se invoca guardar directamente', async () => {
    page = TestBed.runInInjectionContext(() => new PedidosPage());
    page.openOrderSheet();
    page.formCliente.set('Destinatario');
    page.formTelefono.set('099');
    page.formDireccion.set('Dirección');
    page.formPoint.set({ latitud: -1, longitud: -1 });
    await page.saveOrderAndRoute();
    http.expectNone('http://localhost:5289/api/pedidos');
    expect(page.drawerOpen()).toBe(true);
    expect(operations.error()).toContain('fuera del área de cobertura real');
  });
  it('revalida si se desactiva una zona después de seleccionar el punto', async () => {
    page = TestBed.runInInjectionContext(() => new PedidosPage());
    page.openOrderSheet();
    page.formCliente.set('Destinatario');
    page.formTelefono.set('099');
    page.formDireccion.set('Dirección');
    page.formPoint.set({ latitud: 0.5, longitud: 0.5 });
    expect(page.coverage().covered).toBe(true);
    operations.zonas.set([{ ...zone, activa: false }]);
    expect(page.coverage().covered).toBe(false);
    await page.saveOrderAndRoute();
    http.expectNone('http://localhost:5289/api/pedidos');
  });
  it('dibuja todas las zonas activas y el local, conservando la selección cuando cambia la cobertura', async () => {
    const picker = TestBed.createComponent(AddressPicker).componentInstance;
    const second = {
      ...zone,
      id: 'second',
      nombre: 'Zona este',
      poligono: zone.poligono.map((p) => ({ latitud: p.latitud, longitud: p.longitud + 3 })),
    };
    picker.coverageZones = [zone, second, { ...zone, id: 'inactive', activa: false }];
    picker.shopLocation = shop;
    await picker.init();
    expect(fake.polygons).toHaveLength(2);
    expect(fake.markers).toHaveLength(1);
    const emit = vi.spyOn(picker.locationChange, 'emit');
    picker.setPoint(0.5, 0.5);
    expect(picker.coverage.covered).toBe(true);
    picker.coverageZones = [{ ...zone, activa: false }];
    picker.ngOnChanges({ coverageZones: new SimpleChange([zone], picker.coverageZones, false) });
    expect(picker.point()).toEqual({ latitud: 0.5, longitud: 0.5 });
    expect(picker.coverage.covered).toBe(false);
    expect(emit).not.toHaveBeenCalledWith(null);
    picker.ngOnDestroy();
  });
  it('revalida el arrastre del marcador y conserva coordenadas exactas', async () => {
    const picker = TestBed.createComponent(AddressPicker).componentInstance;
    picker.coverageZones = [zone];
    picker.shopLocation = shop;
    await picker.init();
    picker.setPoint(0.500123456789, 0.5);
    expect(picker.point()?.latitud).toBe(0.500123456789);
    expect(picker.coverage.covered).toBe(true);
    const marker = fake.markers.at(-1);
    marker.coordinates = [-1, -1];
    marker.events['dragend']();
    expect(picker.coverage.covered).toBe(false);
    expect(picker.coverage.message).toContain('fuera del área');
    marker.coordinates = [0.5, 0.5];
    marker.events['dragend']();
    expect(picker.coverage.covered).toBe(true);
    picker.ngOnDestroy();
  });
  it('el selector del local conserva su funcionamiento sin exigir zonas de entrega', async () => {
    const picker = TestBed.createComponent(AddressPicker).componentInstance;
    await picker.init();
    picker.setPoint(-2.18, -79.9);
    expect(picker.coverageZones).toBeNull();
    expect(picker.selected()).toBe(true);
    expect(picker.point()).toEqual({ latitud: -2.18, longitud: -79.9 });
    picker.ngOnDestroy();
  });
});

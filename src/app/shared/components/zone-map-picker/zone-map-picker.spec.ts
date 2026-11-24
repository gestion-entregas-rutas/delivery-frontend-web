import { TestBed } from '@angular/core/testing';
import { ZoneMapPicker } from './zone-map-picker';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
const fake = vi.hoisted(() => ({
  events: {} as Record<string, (event: any) => void>,
  markers: [] as any[],
  dots: [] as any[],
  remove: vi.fn(),
}));
vi.mock('leaflet', () => {
  const shape = () => ({ addTo: vi.fn().mockReturnThis(), remove: vi.fn(), setLatLngs: vi.fn() });
  return {
    map: () => ({
      setView: vi.fn().mockReturnThis(),
      on: (name: string, fn: any) => {
        fake.events[name] = fn;
      },
      fitBounds: vi.fn(),
      invalidateSize: vi.fn(),
      remove: fake.remove,
    }),
    tileLayer: () => ({ on: vi.fn().mockReturnThis(), addTo: vi.fn() }),
    layerGroup: () => ({ addTo: vi.fn().mockReturnThis(), clearLayers: vi.fn() }),
    polygon: shape,
    polyline: shape,
    latLngBounds: () => ({ isValid: () => true }),
    divIcon: (options: any) => options,
    circleMarker: (position: number[]) => {
      const dot = {
        position,
        events: {} as Record<string, () => void>,
        addTo: vi.fn().mockReturnThis(),
        on(name: string, fn: any) {
          this.events[name] = fn;
          return this;
        },
      };
      fake.dots.push(dot);
      return dot;
    },
    marker: (position: number[]) => {
      const marker = {
        position,
        events: {} as Record<string, () => void>,
        addTo: vi.fn().mockReturnThis(),
        on(name: string, fn: any) {
          this.events[name] = fn;
          return this;
        },
        getLatLng() {
          return { wrap: () => ({ lat: this.position[0], lng: this.position[1] }) };
        },
      };
      fake.markers.push(marker);
      return marker;
    },
  };
});
describe('Mapa de zonas', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
    fake.events = {};
    fake.markers = [];
    fake.dots = [];
    vi.clearAllMocks();
  });
  const circulo = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      latitud: -1.27 + 0.02 * Math.sin((i / n) * 2 * Math.PI),
      longitud: -78.63 + 0.02 * Math.cos((i / n) * 2 * Math.PI),
    }));
  it('con muchos vértices dibuja puntos pequeños no arrastrables y solo el seleccionado como pin', async () => {
    const picker = TestBed.createComponent(ZoneMapPicker).componentInstance;
    picker.points = circulo(100);
    await picker.init();
    expect(fake.dots).toHaveLength(100);
    expect(fake.markers).toHaveLength(0);
    fake.dots[5].events['click']();
    expect(picker.selected()).toBe(5);
    expect(fake.markers).toHaveLength(1);
    picker.ngOnDestroy();
  });
  it('pide confirmación antes de agregar un punto lejano al contorno', async () => {
    const picker = TestBed.createComponent(ZoneMapPicker).componentInstance;
    picker.points = circulo(10);
    await picker.init();
    fake.events['click']({ latlng: { wrap: () => ({ lat: -1.4, lng: -78.3 }) } });
    expect(picker.points).toHaveLength(10);
    expect(picker.pendingFar()?.km).toBeGreaterThan(3);
    picker.confirmFar();
    expect(picker.points).toHaveLength(11);
    picker.ngOnDestroy();
  });
  it('simplifica un contorno grande y permite recuperar el anterior', async () => {
    const picker = TestBed.createComponent(ZoneMapPicker).componentInstance;
    const emit = vi.spyOn(picker.pointsChange, 'emit');
    picker.points = circulo(351);
    picker.simplify();
    expect(picker.points.length).toBeLessThanOrEqual(60);
    expect(emit).toHaveBeenCalled();
    picker.restorePreviousContour();
    expect(picker.points).toHaveLength(351);
  });
  it('convierte clics y arrastres en un polígono sin redondear ni repetir el primer punto', async () => {
    const fixture = TestBed.createComponent(ZoneMapPicker);
    const picker = fixture.componentInstance;
    const emit = vi.spyOn(picker.pointsChange, 'emit');
    await picker.init();
    for (const [lat, lng] of [
      [-2.18, -79.9],
      [-2.19, -79.88],
      [-2.2, -79.9],
    ])
      fake.events['click']({ latlng: { wrap: () => ({ lat, lng }) } });
    expect(picker.points).toHaveLength(3);
    const marker = fake.markers.at(-1);
    marker.position = [-2.200123456789, -79.900987654321];
    marker.events['dragend']();
    expect(emit).toHaveBeenLastCalledWith([
      { latitud: -2.18, longitud: -79.9 },
      { latitud: -2.19, longitud: -79.88 },
      { latitud: -2.200123456789, longitud: -79.900987654321 },
    ]);
    picker.ngOnDestroy();
    expect(fake.remove).toHaveBeenCalled();
  });
  it('no modifica el polígono original al ajustar o eliminar vértices', () => {
    const picker = TestBed.createComponent(ZoneMapPicker).componentInstance;
    const original = [
      { latitud: -2.18, longitud: -79.9 },
      { latitud: -2.19, longitud: -79.88 },
      { latitud: -2.2, longitud: -79.9 },
    ];
    picker.points = original;
    picker.movePoint(0, { latitud: -2.17, longitud: -79.91 });
    picker.selected.set(1);
    picker.removeSelected();
    expect(original).toHaveLength(3);
    expect(original[0].latitud).toBe(-2.18);
    expect(picker.points).toHaveLength(2);
  });
  it('bloquea cambios durante el guardado y permite reiniciar el dibujo', () => {
    const picker = TestBed.createComponent(ZoneMapPicker).componentInstance;
    picker.points = [{ latitud: -2.18, longitud: -79.9 }];
    picker.disabled = true;
    picker.clear();
    picker.addPoint({ latitud: -2.19, longitud: -79.88 });
    expect(picker.points).toHaveLength(1);
    picker.disabled = false;
    picker.clear();
    expect(picker.points).toEqual([]);
  });
});

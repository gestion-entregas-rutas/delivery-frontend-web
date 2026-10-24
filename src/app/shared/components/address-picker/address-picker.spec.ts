import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AddressSearchService } from '../../../core/services/address-search.service';
import { AddressPicker } from './address-picker';

describe('Selección de dirección', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('busca solo la dirección y transforma las coordenadas GeoJSON', () => {
    const service = TestBed.inject(AddressSearchService);
    let result: any;
    service.search('  Av. Quito, Guayaquil  ').subscribe((r) => (result = r));
    const req = TestBed.inject(HttpTestingController).expectOne(
      (r) => r.url === 'https://photon.komoot.io/api/',
    );
    expect(req.request.params.get('q')).toBe('Av. Quito, Guayaquil');
    req.flush({
      features: [
        {
          geometry: { coordinates: [-79.9, -2.18] },
          properties: { name: 'Av. Quito', city: 'Guayaquil' },
        },
      ],
    });
    expect(result).toEqual([{ label: 'Av. Quito, Guayaquil', latitud: -2.18, longitud: -79.9 }]);
  });
  it('invalida el punto anterior al cambiar la dirección y descarta resultados pendientes', () => {
    const picker = TestBed.createComponent(AddressPicker).componentInstance;
    const emit = vi.spyOn(picker.locationChange, 'emit');
    picker.address = 'Guayaquil';
    picker.search();
    const req = TestBed.inject(HttpTestingController).expectOne(
      (r) => r.url === 'https://photon.komoot.io/api/',
    );
    picker.selected.set(true);
    picker.address = 'Quito';
    picker.ngOnChanges();
    expect(req.cancelled).toBe(true);
    expect(picker.selected()).toBe(false);
    expect(picker.busy()).toBe(false);
    expect(emit).toHaveBeenCalledWith(null);
  });
  it('ofrece selección manual cuando falla el buscador', () => {
    const picker = TestBed.createComponent(AddressPicker).componentInstance;
    picker.address = 'Guayaquil';
    picker.search();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url === 'https://photon.komoot.io/api/')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(picker.message()).toContain('seleccionar el punto directamente');
    expect(picker.busy()).toBe(false);
  });
});

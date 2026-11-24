import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AddressSearchService } from '../../../core/services/address-search.service';
import { AddressPicker } from './address-picker';
import { OperationForm } from '../operation-form/operation-form';
import { LOGISTICA_SERVER_URL } from '../../../core/services/logistica-api.service';

describe('Ubicación del local', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LOGISTICA_SERVER_URL, useValue: 'http://api.test' }],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('obtiene la dirección de un punto enviando solo sus coordenadas', () => {
    let direccion: string | null | undefined;
    TestBed.inject(AddressSearchService).reverse(-1.2416, -78.6197).subscribe((d) => (direccion = d));
    const req = TestBed.inject(HttpTestingController).expectOne((r) => r.url === 'https://photon.komoot.io/reverse');
    expect(req.request.params.get('lat')).toBe('-1.2416');
    expect(req.request.params.get('lon')).toBe('-78.6197');
    req.flush({ features: [{ properties: { street: 'Av. Cevallos', housenumber: '12', district: 'Centro', city: 'Ambato' } }] });
    expect(direccion).toBe('Av. Cevallos 12, Centro, Ambato');
  });

  it('usa la ubicación del dispositivo al pedirla', () => {
    const picker = TestBed.createComponent(AddressPicker).componentInstance;
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: -1.24, longitude: -78.62, accuracy: 20 } } as GeolocationPosition),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const setPoint = vi.spyOn(picker, 'setPoint').mockImplementation(() => {});
    picker.locate();
    expect(getCurrentPosition).toHaveBeenCalled();
    expect(setPoint).toHaveBeenCalledWith(-1.24, -78.62);
    expect(picker.locating()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('avisa si no se da permiso de ubicación', () => {
    const picker = TestBed.createComponent(AddressPicker).componentInstance;
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (_: PositionCallback, err: PositionErrorCallback) =>
        err({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError) },
    });
    picker.locate();
    expect(picker.message()).toContain('No se dio permiso');
    vi.unstubAllGlobals();
  });

  it('para el local, editar la dirección no borra el punto elegido', () => {
    const picker = TestBed.createComponent(AddressPicker).componentInstance;
    picker.addressResetsPoint = false;
    picker.point.set({ latitud: -1.24, longitud: -78.62 });
    picker.ngOnChanges({ address: { firstChange: false } } as any);
    expect(picker.point()).toEqual({ latitud: -1.24, longitud: -78.62 });
  });

  it('autocompleta la dirección, pero no pisa lo que el usuario escribió', () => {
    const form = TestBed.createComponent(OperationForm).componentInstance;
    form.forms.form = { direccion: '' };
    form.onDireccionSugerida('Av. Cevallos 12, Ambato');
    expect(form.forms.form.direccion).toBe('Av. Cevallos 12, Ambato');
    // Un punto nuevo actualiza la dirección autocompletada…
    form.onDireccionSugerida('Calle Bolívar 5, Ambato');
    expect(form.forms.form.direccion).toBe('Calle Bolívar 5, Ambato');
    // …pero si el usuario la editó, solo queda como sugerencia.
    form.forms.form.direccion = 'Calle Bolívar 5, local 2, Ambato';
    form.onDireccionSugerida('Av. Los Andes, Ambato');
    expect(form.forms.form.direccion).toBe('Calle Bolívar 5, local 2, Ambato');
    expect(form.direccionSugerida()).toBe('Av. Los Andes, Ambato');
    form.usarDireccionSugerida();
    expect(form.forms.form.direccion).toBe('Av. Los Andes, Ambato');
  });
});

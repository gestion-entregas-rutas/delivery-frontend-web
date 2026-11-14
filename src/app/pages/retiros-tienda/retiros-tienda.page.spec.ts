import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { RetirosTiendaPage } from './retiros-tienda.page';
import { LogisticaApiService } from '../../core/services/logistica-api.service';
import { OperationsService } from '../../core/services/operations.service';

describe('RetirosTiendaPage (sin API real, mocks)', () => {
  const retiro = {
    id: 'ord-1',
    numeroOrden: 'ORD-2026-000145',
    codigoRetiro: 'RET-1234',
    estadoOrden: 'Pagada',
    datosRetiroTienda: {
      cedulaQuienRetira: '1804567890',
      nombreQuienRetira: 'María López',
      telefonoContacto: '0987654321',
      fechaRetiro: '2026-11-15',
      franjaHoraria: '10:00 - 12:00',
    },
  };

  let api: any;
  let operations: any;

  beforeEach(async () => {
    api = {
      listarRetirosTienda: vi.fn(() => of([retiro])),
      marcarOrdenRetirada: vi.fn(() => of({ ...retiro, estadoEntrega: 'Retirado' })),
    };
    operations = { view: signal('Resumen') };

    await TestBed.configureTestingModule({
      imports: [RetirosTiendaPage],
      providers: [
        { provide: LogisticaApiService, useValue: api },
        { provide: OperationsService, useValue: operations },
      ],
    }).compileComponents();
  });

  it('carga retiros y filtra por cédula/nombre/código/orden', async () => {
    const fixture = TestBed.createComponent(RetirosTiendaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.cargar();
    fixture.detectChanges();

    const page = fixture.componentInstance;
    expect(operations.view()).toBe('RetirosTienda');
    expect(api.listarRetirosTienda).toHaveBeenCalled();
    expect(page.retiros().length).toBe(1);
    expect(page.filtrados().length).toBe(1);

    page.buscar.set('1804567890');
    expect(page.filtrados().length).toBe(1);
    page.buscar.set('María');
    expect(page.filtrados().length).toBe(1);
    page.buscar.set('RET-1234');
    expect(page.filtrados().length).toBe(1);
    page.buscar.set('ord-1');
    expect(page.filtrados().length).toBe(1);
    page.buscar.set('no-coincide');
    expect(page.filtrados().length).toBe(0);
  });

  it('marca orden como retirada y refresca el listado', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(RetirosTiendaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.cargar();
    const page = fixture.componentInstance;

    await page.marcarRetirado(retiro as any);

    expect(api.marcarOrdenRetirada).toHaveBeenCalledWith('ord-1');
    expect(api.listarRetirosTienda.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(page.message()).toContain('retirada en tienda');

    confirmSpy.mockRestore();
  });

  it('muestra error controlado cuando falla la carga (sin backend)', async () => {
    api.listarRetirosTienda.mockReturnValue(throwError(() => ({ status: 500, error: { detail: 'Fallo' } })));
    const fixture = TestBed.createComponent(RetirosTiendaPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.error()).toContain('Fallo');
  });
});

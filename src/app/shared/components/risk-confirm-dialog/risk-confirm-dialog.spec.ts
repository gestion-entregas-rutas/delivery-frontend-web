import { TestBed } from '@angular/core/testing';
import { RiskConfirmDialog } from './risk-confirm-dialog';

describe('Confirmación de entregas en riesgo', () => {
  it('lista las entregas afectadas y responde según el botón', () => {
    const fixture = TestBed.createComponent(RiskConfirmDialog);
    fixture.componentInstance.items = [
      { pedidoId: 'p1', rutaId: 'r', finalizacionEstimadaEn: '2026-11-24T14:22:00Z', limiteEn: '2026-11-24T13:30:00Z', retrasoMinutos: 53 },
    ];
    fixture.componentInstance.nombre = () => 'Neptali';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Neptali');
    expect(el.textContent).toContain('+53 min');
    expect(el.textContent).toContain('Límite 08:30');
    expect(el.textContent).toContain('llegaría 09:22');

    const respuestas: boolean[] = [];
    fixture.componentInstance.responder.subscribe((r) => respuestas.push(r));
    const botones = Array.from(el.querySelectorAll('button'));
    botones.find((b) => b.textContent?.includes('Aplicar'))!.click();
    botones.find((b) => b.textContent?.includes('Cancelar'))!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(respuestas).toEqual([true, false, false]);
  });
});

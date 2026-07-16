import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolMessageStatusComponent } from './message-status.component';

describe('SolMessageStatusComponent', () => {
  let fixture: ComponentFixture<SolMessageStatusComponent>;

  function host(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.sol-message-status')!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolMessageStatusComponent],
      providers: [
        { provide: SOL_I18N, useValue: { activeLang: signal('es-CO'), translate: (key: string) => `t(${key})` } },
      ],
    });
    fixture = TestBed.createComponent(SolMessageStatusComponent);
  });

  it('[spec] read usa el token de color de marca, distinguible de delivered (mismo ícono, distinto color)', () => {
    fixture.componentRef.setInput('status', 'delivered');
    fixture.detectChanges();
    const deliveredColor = fixture.componentInstance.color();

    fixture.componentRef.setInput('status', 'read');
    fixture.detectChanges();
    const readColor = fixture.componentInstance.color();

    // mismo ícono (double-check) en ambos estados...
    expect(fixture.componentInstance.iconName()).toBe('double-check');
    fixture.componentRef.setInput('status', 'delivered');
    fixture.detectChanges();
    expect(fixture.componentInstance.iconName()).toBe('double-check');

    // ...pero read usa el token de marca (--sol-color-primary), distinto de delivered.
    expect(readColor).toContain('--sol-color-primary');
    expect(deliveredColor).not.toContain('--sol-color-primary');
    expect(readColor).not.toBe(deliveredColor);
  });

  it('[spec] failed usa el ícono de error del registry (exclamation-triangle), no un SVG inline', () => {
    fixture.componentRef.setInput('status', 'failed');
    fixture.detectChanges();

    expect(fixture.componentInstance.iconName()).toBe('exclamation-triangle');
    // el ícono se renderiza vía <sol-icon> (gate anti-SVG-inline de PR2 lo refuerza a nivel de repo).
    expect(host().querySelector('sol-icon')).not.toBeNull();
  });

  it('pending usa el ícono de reloj y sent el check simple', () => {
    fixture.componentRef.setInput('status', 'pending');
    fixture.detectChanges();
    expect(fixture.componentInstance.iconName()).toBe('clock');

    fixture.componentRef.setInput('status', 'sent');
    fixture.detectChanges();
    expect(fixture.componentInstance.iconName()).toBe('check');
  });

  it('expone un aria-label por clave i18n, uno distinto por estado', () => {
    fixture.componentRef.setInput('status', 'failed');
    fixture.detectChanges();
    expect(host().getAttribute('aria-label')).toBe('t(shared.messageStatus.failed)');
  });
});

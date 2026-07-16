import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import {
  SolTrendComponent,
  resolveTrendDirection,
  defaultTrendFormat,
} from './trend.component';

describe('resolveTrendDirection / defaultTrendFormat (puras)', () => {
  it('delta positivo → up', () => {
    expect(resolveTrendDirection(15)).toBe('up');
  });

  it('delta negativo → down', () => {
    expect(resolveTrendDirection(-15)).toBe('down');
  });

  it('delta 0 → flat (neutro)', () => {
    expect(resolveTrendDirection(0)).toBe('flat');
  });

  it('defaultTrendFormat antepone el signo "+" a los positivos y preserva el "-" de los negativos', () => {
    expect(defaultTrendFormat(5)).toBe('+5');
    expect(defaultTrendFormat(-15)).toBe('-15');
    expect(defaultTrendFormat(0)).toBe('0');
  });
});

describe('SolTrendComponent', () => {
  let fixture: ComponentFixture<SolTrendComponent>;

  function value(): string {
    return (fixture.nativeElement as HTMLElement).querySelector('.sol-trend__value')!.textContent!.trim();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolTrendComponent],
      providers: [
        { provide: SOL_I18N, useValue: { activeLang: signal('es-CO'), translate: (key: string) => `t(${key})` } },
      ],
    });
    fixture = TestBed.createComponent(SolTrendComponent);
  });

  it('[spec] current=40, previous=55 → flecha descendente y delta "-15"', () => {
    fixture.componentRef.setInput('current', 40);
    fixture.componentRef.setInput('previous', 55);
    fixture.detectChanges();

    expect(fixture.componentInstance.direction()).toBe('down');
    expect(value()).toBe('-15');
    expect((fixture.nativeElement as HTMLElement).querySelector('sol-icon')).not.toBeNull();
  });

  it('delta positivo muestra tono de éxito (sin invert)', () => {
    fixture.componentRef.setInput('current', 70);
    fixture.componentRef.setInput('previous', 55);
    fixture.detectChanges();

    expect(fixture.componentInstance.tone()).toBe('success');
    expect(value()).toBe('+15');
  });

  it('delta 0 es SIEMPRE neutro, incluso con invert=true', () => {
    fixture.componentRef.setInput('current', 50);
    fixture.componentRef.setInput('previous', 50);
    fixture.componentRef.setInput('invert', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.direction()).toBe('flat');
    expect(fixture.componentInstance.tone()).toBe('neutral');
    expect(value()).toBe('0');
  });

  it('invert=true intercambia el tono de subir/bajar (p. ej. tasa de abandono)', () => {
    fixture.componentRef.setInput('current', 70);
    fixture.componentRef.setInput('previous', 55);
    fixture.componentRef.setInput('invert', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.direction()).toBe('up');
    expect(fixture.componentInstance.tone()).toBe('danger'); // subir es malo cuando invert=true
  });

  it('sin previous, muestra el texto de "sin dato" por clave i18n', () => {
    fixture.componentRef.setInput('current', 40);
    fixture.detectChanges();
    expect(value()).toBe('t(shared.trend.noData)');
  });

  it('acepta un formateador propio del delta', () => {
    fixture.componentRef.setInput('current', 70);
    fixture.componentRef.setInput('previous', 55);
    fixture.componentRef.setInput('format', (d: number) => `${d}%`);
    fixture.detectChanges();
    expect(value()).toBe('15%');
  });
});

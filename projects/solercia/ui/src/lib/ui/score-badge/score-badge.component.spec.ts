import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import {
  SolScoreBadgeComponent,
  resolveScoreTone,
  DEFAULT_SCORE_THRESHOLDS,
  type SolScoreThreshold,
} from './score-badge.component';

describe('resolveScoreTone (pura)', () => {
  it('[spec] score=85 con umbrales por defecto usa el tono de éxito', () => {
    expect(resolveScoreTone(85, DEFAULT_SCORE_THRESHOLDS)).toBe('success');
  });

  it('score=50 (frontera inclusiva de advertencia) usa warning', () => {
    expect(resolveScoreTone(50, DEFAULT_SCORE_THRESHOLDS)).toBe('warning');
  });

  it('score=49 usa danger (justo debajo de la frontera de advertencia)', () => {
    expect(resolveScoreTone(49, DEFAULT_SCORE_THRESHOLDS)).toBe('danger');
  });

  it('score=80 (frontera inclusiva de éxito) usa success', () => {
    expect(resolveScoreTone(80, DEFAULT_SCORE_THRESHOLDS)).toBe('success');
  });

  it('acepta umbrales propios sin acoplarse al default', () => {
    const custom: SolScoreThreshold[] = [
      { upTo: 30, tone: 'danger' },
      { upTo: 60, tone: 'info' },
      { upTo: Infinity, tone: 'success' },
    ];
    expect(resolveScoreTone(45, custom)).toBe('info');
  });
});

describe('SolScoreBadgeComponent', () => {
  let fixture: ComponentFixture<SolScoreBadgeComponent>;

  function text(): string {
    return (fixture.nativeElement as HTMLElement).querySelector('.sol-score-badge')!.textContent!.trim();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolScoreBadgeComponent],
      providers: [
        { provide: SOL_I18N, useValue: { activeLang: signal('es-CO'), translate: (key: string) => `t(${key})` } },
      ],
    });
    fixture = TestBed.createComponent(SolScoreBadgeComponent);
  });

  it('muestra el valor crudo cuando hay dato', () => {
    fixture.componentRef.setInput('value', 85);
    fixture.detectChanges();
    expect(text()).toBe('85');
  });

  it('value=null muestra el texto de "sin dato" por clave i18n', () => {
    fixture.detectChanges();
    expect(text()).toBe('t(shared.scoreBadge.empty)');
  });

  it('pending=true muestra el texto "en curso" por clave i18n, incluso con value presente', () => {
    fixture.componentRef.setInput('value', 90);
    fixture.componentRef.setInput('pending', true);
    fixture.detectChanges();
    expect(text()).toBe('t(shared.scoreBadge.pending)');
  });

  it('normaliza value/max a escala 0-100 antes de evaluar los umbrales', () => {
    // 7/10 = 70% → banda de advertencia (50-79) con los umbrales por defecto.
    fixture.componentRef.setInput('value', 7);
    fixture.componentRef.setInput('max', 10);
    fixture.detectChanges();
    expect(fixture.componentInstance.tone()).toBe('warning');
    expect(text()).toBe('7'); // el texto muestra el valor crudo, no el normalizado
  });
});

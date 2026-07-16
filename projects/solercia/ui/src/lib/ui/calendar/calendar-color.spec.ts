import { TestBed } from '@angular/core/testing';
import { SOL_CALENDAR_COLOR, type SolCalendarColorStrategy } from './calendar-color';
import type { SolCalendarEvent, StateColorSet } from './calendar.model';

function baseEvent(overrides: Partial<SolCalendarEvent> = {}): SolCalendarEvent {
  return { id: '1', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0), title: 'Evento', ...overrides };
}

describe('SOL_CALENDAR_COLOR (D3 — Strategy inyectable, default null-object)', () => {
  it('[spec] estrategia por defecto: un evento SIN color explícito resuelve una superficie neutra, sin lanzar', () => {
    TestBed.configureTestingModule({});
    const strategy = TestBed.inject(SOL_CALENDAR_COLOR);

    const result = strategy.resolve(baseEvent(), false);

    expect(result.bg).toContain('var(--sol-bg-sunken');
    expect(result.border).toContain('var(--sol-border-color-default');
    expect(result.text).toContain('var(--sol-color-text-primary');
  });

  it('[spec] estrategia por defecto: un evento CON color explícito deriva {bg,border,text} vía color-mix(), sin hardcodear paleta', () => {
    TestBed.configureTestingModule({});
    const strategy = TestBed.inject(SOL_CALENDAR_COLOR);

    const result = strategy.resolve(baseEvent({ color: '#3B82F6' }), false);

    expect(result.border).toBe('#3B82F6');
    expect(result.bg).toContain('color-mix(in srgb, #3B82F6');
    expect(result.text).toContain('color-mix(in srgb, #3B82F6');
  });

  it('modo oscuro: cambia las proporciones de color-mix (más saturado, mezcla hacia blanco en vez de negro)', () => {
    TestBed.configureTestingModule({});
    const strategy = TestBed.inject(SOL_CALENDAR_COLOR);

    const light = strategy.resolve(baseEvent({ color: '#3B82F6' }), false);
    const dark = strategy.resolve(baseEvent({ color: '#3B82F6' }), true);

    expect(light.text).toContain('black');
    expect(dark.text).toContain('white');
    expect(light.bg).not.toBe(dark.bg);
  });

  it('[spec] estrategia inyectada por el consumidor: reemplaza el default (p. ej. simulando la paleta de 6 estados de cita)', () => {
    const domainStrategy: SolCalendarColorStrategy = {
      resolve: (event): StateColorSet => {
        const stateId = (event.data as { stateId?: number } | undefined)?.stateId ?? 1;
        return stateId === 2
          ? { bg: '#D1FAE5', border: '#22C55E', text: '#166534' }
          : { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' };
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: SOL_CALENDAR_COLOR, useValue: domainStrategy }],
    });
    const strategy = TestBed.inject(SOL_CALENDAR_COLOR);

    const result = strategy.resolve(baseEvent({ color: '#000000', data: { stateId: 2 } }), false);

    // La estrategia inyectada IGNORA `color` (usa su propia regla de dominio) — confirma que reemplaza, no complementa, al default.
    expect(result).toEqual({ bg: '#D1FAE5', border: '#22C55E', text: '#166534' });
  });

  it('[robustez] event null/undefined no lanza — cae a la superficie neutra', () => {
    TestBed.configureTestingModule({});
    const strategy = TestBed.inject(SOL_CALENDAR_COLOR);

    expect(() => strategy.resolve(null as unknown as SolCalendarEvent, false)).not.toThrow();
    expect(() => strategy.resolve(undefined as unknown as SolCalendarEvent, false)).not.toThrow();
  });

  it('[robustez] color no-string (dato malformado) no lanza — cae a la superficie neutra', () => {
    TestBed.configureTestingModule({});
    const strategy = TestBed.inject(SOL_CALENDAR_COLOR);

    const result = strategy.resolve(baseEvent({ color: 42 as unknown as string }), false);

    expect(result.bg).toContain('var(--sol-bg-sunken');
  });

  it('[robustez] color = cadena vacía se trata como "sin color" (no produce color-mix con string vacío)', () => {
    TestBed.configureTestingModule({});
    const strategy = TestBed.inject(SOL_CALENDAR_COLOR);

    const result = strategy.resolve(baseEvent({ color: '' }), false);

    expect(result.bg).toContain('var(--sol-bg-sunken');
  });
});

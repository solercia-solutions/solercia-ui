import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChartConfiguration } from 'chart.js';
import { ThemeService } from '../../tokens';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SOL_CHART_ENGINE, SolChartComponent } from './chart.component';
import type { SolChartData } from './chart-theme';

/**
 * Specs de `SolChartComponent` con el motor MOCKEADO vía `SOL_CHART_ENGINE`
 * (sin canvas real): se prueba el ciclo de vida declarativo — creación,
 * re-render al alternar light/dark, re-render al cambiar datos, destrucción —
 * y la a11y del canvas (role + aria-label i18n).
 */

interface EngineCall {
  canvas: HTMLCanvasElement;
  config: ChartConfiguration;
  destroyed: boolean;
}

describe('SolChartComponent', () => {
  let engineCalls: EngineCall[];
  let isDark: ReturnType<typeof signal<boolean>>;
  let activeTheme: ReturnType<typeof signal<object | null>>;

  const DATA: SolChartData = {
    labels: ['Ene', 'Feb'],
    series: [{ label: 'Citas', data: [1, 2] }],
  };

  beforeEach(() => {
    engineCalls = [];
    isDark = signal(false);
    activeTheme = signal<object | null>(null);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ThemeService,
          useValue: { isDark: isDark.asReadonly(), activeTheme: activeTheme.asReadonly() },
        },
        {
          provide: SOL_I18N,
          useValue: {
            activeLang: signal('es-CO'),
            translate: (key: string) => `t(${key})`,
          },
        },
        {
          provide: SOL_CHART_ENGINE,
          useValue: (canvas: HTMLCanvasElement, config: ChartConfiguration) => {
            const call: EngineCall = { canvas, config, destroyed: false };
            engineCalls.push(call);
            return { destroy: () => (call.destroyed = true) };
          },
        },
      ],
    });
  });

  function createChart(type = 'line') {
    const fixture = TestBed.createComponent(SolChartComponent);
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('data', DATA);
    fixture.componentRef.setInput('ariaLabelKey', 'pages.dashboard.charts.byState.aria');
    fixture.detectChanges();
    TestBed.tick(); // flush del effect de render
    return fixture;
  }

  it('crea la instancia del motor sobre el canvas con la config del adapter', () => {
    const fixture = createChart('bar');

    expect(engineCalls).toHaveLength(1);
    expect(engineCalls[0].config.type).toBe('bar');
    expect(engineCalls[0].canvas.tagName).toBe('CANVAS');
    expect(fixture.nativeElement.querySelector('canvas')).toBe(engineCalls[0].canvas);
  });

  it('el canvas expone role="img" y aria-label resuelto por la clave i18n', () => {
    const fixture = createChart();
    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('canvas');
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('t(pages.dashboard.charts.byState.aria)');
  });

  it('al alternar light/dark destruye la instancia y re-renderiza con el tema vigente', () => {
    createChart();
    expect(engineCalls).toHaveLength(1);

    isDark.set(true);
    TestBed.tick();

    expect(engineCalls).toHaveLength(2);
    expect(engineCalls[0].destroyed).toBe(true);
    expect(engineCalls[1].destroyed).toBe(false);
  });

  it('al cambiar el tema del tenant (mismo modo) destruye la instancia y re-renderiza (E6)', () => {
    createChart();
    expect(engineCalls).toHaveLength(1);

    // El tema del tenant llega en runtime: activeTheme cambia SIN tocar isDark.
    activeTheme.set({ meta: { tenant: 'acme' } });
    TestBed.tick();

    expect(engineCalls).toHaveLength(2);
    expect(engineCalls[0].destroyed).toBe(true);
    expect(engineCalls[1].destroyed).toBe(false);
  });

  it('al cambiar los datos re-renderiza con la nueva config', () => {
    const fixture = createChart();

    fixture.componentRef.setInput('data', {
      labels: ['Mar'],
      series: [{ label: 'Citas', data: [7] }],
    } satisfies SolChartData);
    fixture.detectChanges();
    TestBed.tick();

    expect(engineCalls).toHaveLength(2);
    expect(engineCalls[1].config.data.labels).toEqual(['Mar']);
  });

  it('sparkline se traduce al motor como line', () => {
    createChart('sparkline');
    expect(engineCalls[0].config.type).toBe('line');
  });

  it('destruye la instancia del motor al destruir el componente', () => {
    const fixture = createChart();
    fixture.destroy();
    expect(engineCalls[0].destroyed).toBe(true);
  });
});

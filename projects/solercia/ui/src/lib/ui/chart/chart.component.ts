import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  InjectionToken,
  computed,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  LineElement,
  PointElement,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler,
} from 'chart.js';
import type { ChartConfiguration } from 'chart.js';
import { ThemeService } from '../../tokens';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import {
  buildChartConfig,
  readChartTheme,
  type SolChartData,
  type SolChartOptions,
  type SolChartType,
} from './chart-theme';

let chartJsRegistered = false;

/**
 * Registers only what the four declarative chart types need (never chart.js/auto). It runs lazily
 * on the first real chart, not at module load: a top-level `Chart.register()` is a side effect
 * that keeps chart.js in the initial bundle of every app importing anything from `@solercia/ui`.
 */
function ensureChartJsRegistered(): void {
  if (chartJsRegistered) return;
  Chart.register(
    LineController,
    BarController,
    DoughnutController,
    LineElement,
    PointElement,
    BarElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    Legend,
    Tooltip,
    Filler,
  );
  chartJsRegistered = true;
}

/** Contrato mínimo que sol-chart necesita de una instancia del motor. */
export interface SolChartEngineHandle {
  destroy(): void;
}

/** Fábrica de instancias del motor de gráficas (canvas + config → handle). */
export type SolChartEngineFactory = (
  canvas: HTMLCanvasElement,
  config: ChartConfiguration,
) => SolChartEngineHandle;

/**
 * Punto ÚNICO de acople con Chart.js: la fábrica por defecto instancia
 * `new Chart(...)`. Los specs la sustituyen para probar el componente sin
 * canvas real; un eventual cambio de motor se resuelve aquí y en el adapter.
 */
export const SOL_CHART_ENGINE = /* @__PURE__ */ new InjectionToken<SolChartEngineFactory>('SOL_CHART_ENGINE', {
  factory: () => (canvas, config) => {
    ensureChartJsRegistered();
    return new Chart(canvas, config);
  },
});

/**
 * `sol-chart` (E3): envoltura propia de Chart.js con API declarativa.
 *
 * - Las vistas declaran `type` + `data` (+ `options` mínimas) y NUNCA
 *   importan Chart.js — regla del proyecto (theming por tenant y cambio de
 *   motor centralizados).
 * - Los colores/fuentes/grid salen de las variables `--sol-*` del tema
 *   ACTIVO, leídas en runtime con getComputedStyle; al alternar light/dark
 *   (`ThemeService.isDark`) el chart se re-renderiza solo.
 * - A11y: el canvas expone `role="img"` + `aria-label` resuelto por clave
 *   i18n (`ariaLabelKey`), reactivo al idioma activo.
 *
 * Uso:
 * ```html
 * <sol-chart
 *   type="doughnut"
 *   [data]="{ labels: estados(), series: [{ label: citasLabel(), data: conteos() }] }"
 *   ariaLabelKey="pages.dashboard.charts.byState.aria"
 * />
 * ```
 */
@Component({
  selector: 'sol-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-chart" [style.height]="height()">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sol-chart {
      position: relative;
      width: 100%;
    }
  `,
})
export class SolChartComponent {
  private readonly themeService = inject(ThemeService);
  private readonly i18n = injectSolI18n();
  private readonly engineFactory = inject(SOL_CHART_ENGINE);
  private readonly destroyRef = inject(DestroyRef);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  /** Tipo declarativo de la gráfica. */
  readonly type = input.required<SolChartType>();

  /** Etiquetas + series. Los textos llegan YA resueltos por i18n. */
  readonly data = input.required<SolChartData>();

  /** Configuración mínima opcional (leyenda, tope del eje Y). */
  readonly options = input<SolChartOptions>({});

  /** Clave i18n del `aria-label` del canvas (obligatoria — a11y). */
  readonly ariaLabelKey = input.required<string>();

  /** Alto del contenedor (el canvas es responsive dentro de él). */
  readonly height = input<string>('260px');

  /** La clave es un input dinámico: se recalcula al cambiar el idioma activo. */
  readonly ariaLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(this.ariaLabelKey());
  });

  private chart: SolChartEngineHandle | null = null;

  constructor() {
    // Re-render declarativo: cualquier cambio de tipo/datos/opciones, el
    // toggle light/dark (isDark) o un CAMBIO DE TEMA DE TENANT (E6:
    // activeTheme cambia cuando el tema del tenant carga/cambia en runtime
    // con el MISMO modo) destruye y recrea la instancia con los tokens del
    // tema vigente. Volúmenes de dashboard: recrear es más simple y seguro
    // que mutar la config del motor en sitio.
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      this.themeService.isDark(); // tracking explícito del modo
      this.themeService.activeTheme(); // tracking del tema efectivo (tenant/default)
      const type = this.type();
      const data = this.data();
      const options = this.options();
      if (!canvas) return;
      untracked(() => this.render(canvas, type, data, options));
    });

    this.destroyRef.onDestroy(() => {
      this.chart?.destroy();
      this.chart = null;
    });
  }

  private render(
    canvas: HTMLCanvasElement,
    type: SolChartType,
    data: SolChartData,
    options: SolChartOptions,
  ): void {
    this.chart?.destroy();
    // Lectura en runtime del tema ACTIVO: ThemeService ya aplicó las --sol-*
    // del modo vigente en :root cuando este effect corre.
    const style = getComputedStyle(document.documentElement);
    const theme = readChartTheme(name => style.getPropertyValue(name));
    this.chart = this.engineFactory(canvas, buildChartConfig(type, data, theme, options));
  }
}

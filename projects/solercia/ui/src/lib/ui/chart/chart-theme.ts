import type { ChartConfiguration, ChartDataset, ChartOptions } from 'chart.js';

/**
 * Adapter puro tokens → Chart.js (E3).
 *
 * Traduce los tokens `--sol-*` del tema activo (light/dark) a una
 * `ChartConfiguration` de Chart.js. TODO lo que decide colores, fuentes,
 * grid, leyenda y tooltips vive aquí como funciones puras — sin canvas, sin
 * DOM — para que los specs de Vitest lo cubran sin mockear el motor.
 *
 * `SolChartComponent` es el ÚNICO consumidor: lee las variables CSS en
 * runtime (getComputedStyle) y delega en `buildChartConfig`. Las vistas
 * jamás importan Chart.js ni este archivo directamente — usan `<sol-chart>`.
 */

/** Tipos declarativos soportados por sol-chart. `sparkline` es una línea minimalista sin ejes ni leyenda. */
export type SolChartType = 'line' | 'bar' | 'doughnut' | 'sparkline';

/** Serie de datos. El `label` llega YA resuelto por i18n (sol-chart no traduce datos). */
export interface SolChartSeries {
  label: string;
  data: number[];
  /** Color explícito (CSS). Si falta, se asigna cíclicamente de la paleta de tokens. */
  color?: string;
}

/** Datos declarativos del chart: etiquetas del eje + series. */
export interface SolChartData {
  labels: string[];
  series: SolChartSeries[];
}

/** Configuración mínima opcional de sol-chart. */
export interface SolChartOptions {
  /** Fuerza mostrar/ocultar la leyenda. Por defecto se decide por tipo y número de series. */
  legend?: boolean;
  /** Límite superior del eje Y (ej. 100 para porcentajes de ocupación). */
  yMax?: number;
}

/** Tokens del tema resueltos a valores concretos consumibles por el canvas. */
export interface ChartThemeTokens {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  mutedColor: string;
  gridColor: string;
  surfaceColor: string;
  /** Paleta categórica para series/segmentos, en orden de asignación. */
  palette: string[];
  /**
   * Duración de la animación de entrada en ms (v2: `--sol-dur-slow`). El token
   * llega YA escalado por intensity/prefers-reduced-motion desde ThemeService,
   * así que con motion "none" la animación es imperceptible (~5ms).
   */
  animationMs: number;
}

/**
 * Variables `--sol-*` que alimentan el chart y su fallback (valores del modo
 * light de `styles.css`). El fallback solo aplica si la variable no resuelve
 * (ej. specs en jsdom); en la app, ThemeService ya las dejó en `:root`.
 */
export const CHART_TOKEN_FALLBACKS: ReadonlyArray<readonly [name: string, fallback: string]> = [
  ['--sol-font-family', "'Inter', system-ui, -apple-system, sans-serif"],
  ['--sol-font-size-sm', '12px'],
  ['--sol-color-text-secondary', '#64748B'],
  ['--sol-color-text-muted', '#94A3B8'],
  ['--sol-border-color-default', '#E2E8F0'],
  ['--sol-bg-surface', '#FFFFFF'],
  // Paleta v2 del tema (`component.chart.palette` → --sol-chart-1..6). Los
  // fallbacks replican los defaults de la EMIT_TABLE (primary, info, success,
  // warning, danger, secondary del modo light de default.json).
  ['--sol-chart-1', '#2563EB'],
  ['--sol-chart-2', '#3B82F6'],
  ['--sol-chart-3', '#10B981'],
  ['--sol-chart-4', '#F59E0B'],
  ['--sol-chart-5', '#EF4444'],
  ['--sol-chart-6', '#7C3AED'],
  // Motion v2: duración de entrada (el default replica la EMIT_TABLE).
  ['--sol-dur-slow', '480ms'],
];

/**
 * Resuelve los tokens del tema ACTIVO a valores concretos. Recibe el lector
 * de variables como función (`getVar`) para mantenerse pura: el componente
 * pasa `getComputedStyle(document.documentElement)`, los specs un mapa fijo.
 */
export function readChartTheme(getVar: (name: string) => string): ChartThemeTokens {
  const resolved = new Map<string, string>();
  for (const [name, fallback] of CHART_TOKEN_FALLBACKS) {
    const raw = (getVar(name) ?? '').trim();
    resolved.set(name, raw !== '' ? raw : fallback);
  }
  const get = (name: string): string => resolved.get(name) as string;

  return {
    fontFamily: get('--sol-font-family'),
    fontSize: parsePx(get('--sol-font-size-sm'), 12),
    textColor: get('--sol-color-text-secondary'),
    mutedColor: get('--sol-color-text-muted'),
    gridColor: get('--sol-border-color-default'),
    surfaceColor: get('--sol-bg-surface'),
    palette: [
      get('--sol-chart-1'),
      get('--sol-chart-2'),
      get('--sol-chart-3'),
      get('--sol-chart-4'),
      get('--sol-chart-5'),
      get('--sol-chart-6'),
    ],
    animationMs: parseMs(get('--sol-dur-slow'), 480),
  };
}

/** `'12px'` → `12`. Si no parsea, devuelve el fallback. */
export function parsePx(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `'480ms'` → `480`, `'0.5s'` → `500`. Si no parsea, devuelve el fallback. */
export function parseMs(value: string, fallback: number): number {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return fallback;
  const isSeconds = /s$/i.test(trimmed) && !/ms$/i.test(trimmed);
  return isSeconds ? parsed * 1000 : parsed;
}

/**
 * Agrega alpha a un color hex (`#RGB` o `#RRGGBB`) → `rgba(...)`. El canvas
 * NO soporta `color-mix()`, así que la translucidez se calcula aquí. Colores
 * no-hex (rgb(), nombres) se devuelven intactos (sin alpha) — mejor color
 * sólido correcto que un valor inválido.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;

  let value = match[1];
  if (value.length === 3) {
    value = value.split('').map(c => c + c).join('');
  }
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Color efectivo de la serie `i`: explícito o cíclico de la paleta. */
function seriesColor(series: SolChartSeries, index: number, theme: ChartThemeTokens): string {
  return series.color ?? theme.palette[index % theme.palette.length];
}

/**
 * Núcleo del adapter: datos declarativos + tokens → `ChartConfiguration`.
 * Pura y determinista: misma entrada, misma configuración.
 */
export function buildChartConfig(
  type: SolChartType,
  data: SolChartData,
  theme: ChartThemeTokens,
  options: SolChartOptions = {},
): ChartConfiguration {
  const engineType = type === 'doughnut' ? 'doughnut' : type === 'bar' ? 'bar' : 'line';
  const datasets = data.series.map((s, i) => buildDataset(type, s, i, theme));

  return {
    type: engineType,
    data: { labels: [...data.labels], datasets },
    options: buildEngineOptions(type, data, theme, options),
  } as ChartConfiguration;
}

function buildDataset(
  type: SolChartType,
  series: SolChartSeries,
  index: number,
  theme: ChartThemeTokens,
): ChartDataset {
  const color = seriesColor(series, index, theme);
  const base = { label: series.label, data: [...series.data] };

  switch (type) {
    case 'doughnut':
      // En la dona cada PUNTO es un segmento: paleta por punto, no por serie.
      return {
        ...base,
        backgroundColor: series.data.map((_, i) => theme.palette[i % theme.palette.length]),
        borderColor: theme.surfaceColor,
        borderWidth: 2,
        hoverOffset: 6,
      } as ChartDataset;
    case 'bar':
      return {
        ...base,
        backgroundColor: color,
        borderRadius: 4,
        maxBarThickness: 36,
      } as ChartDataset;
    case 'sparkline':
      return {
        ...base,
        borderColor: color,
        backgroundColor: withAlpha(color, 0.12),
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      } as ChartDataset;
    case 'line':
      return {
        ...base,
        borderColor: color,
        backgroundColor: withAlpha(color, 0.15),
        fill: false,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: color,
        borderWidth: 2,
      } as ChartDataset;
  }
}

/**
 * Animación de entrada nativa de Chart.js con motion del tema (v2):
 * - Duración: `--sol-dur-slow` (ya escalada por intensity/reduced-motion).
 * - Easing: `easeOutQuart` — Chart.js solo acepta easings con nombre (no
 *   `cubic-bezier`), y es la aproximación nativa más cercana a
 *   `--sol-ease-entrance`.
 * - Barras/líneas: delay por índice de dato (opción nativa `animation.delay`
 *   del sample "delayed" de Chart.js). Las barras crecen desde la base de
 *   forma escalonada y las líneas se revelan de izquierda a derecha (trazo
 *   progresivo). El stagger total ≈ una duración extra, proporcional al
 *   número de puntos, así que también colapsa con motion "none".
 * - Doughnut: la rotación nativa de entrada anima todos los segmentos como
 *   conjunto — un delay por segmento la rompería.
 */
function buildEntranceAnimation(
  type: SolChartType,
  data: SolChartData,
  theme: ChartThemeTokens,
): ChartOptions['animation'] {
  const duration = theme.animationMs;
  const animation: NonNullable<ChartOptions['animation']> = {
    duration,
    easing: 'easeOutQuart',
  };
  if (type !== 'doughnut') {
    const delayUnit = duration / Math.max(data.labels.length, 1);
    animation.delay = context =>
      context.type === 'data' && context.mode === 'default' ? context.dataIndex * delayUnit : 0;
  }
  return animation;
}

function buildEngineOptions(
  type: SolChartType,
  data: SolChartData,
  theme: ChartThemeTokens,
  options: SolChartOptions,
): ChartOptions {
  const font = { family: theme.fontFamily, size: theme.fontSize };
  const isSparkline = type === 'sparkline';
  const showLegend =
    options.legend ?? (type === 'doughnut' || (!isSparkline && data.series.length > 1));

  const engineOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: buildEntranceAnimation(type, data, theme),
    plugins: {
      legend: {
        display: showLegend,
        position: type === 'doughnut' ? 'bottom' : 'top',
        labels: {
          color: theme.textColor,
          font,
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
        },
      },
      tooltip: isSparkline
        ? { enabled: false }
        : {
            enabled: true,
            backgroundColor: theme.surfaceColor,
            titleColor: theme.textColor,
            bodyColor: theme.mutedColor,
            borderColor: theme.gridColor,
            borderWidth: 1,
            titleFont: font,
            bodyFont: font,
            padding: 10,
            displayColors: true,
            boxPadding: 4,
          },
    },
  };

  if (type === 'doughnut') {
    (engineOptions as ChartOptions<'doughnut'>).cutout = '68%';
    return engineOptions;
  }

  engineOptions.scales = {
    x: {
      display: !isSparkline,
      grid: { display: false },
      ticks: { color: theme.mutedColor, font, maxRotation: 45 },
      border: { color: theme.gridColor },
    },
    y: {
      display: !isSparkline,
      beginAtZero: true,
      ...(options.yMax !== undefined ? { max: options.yMax } : {}),
      grid: { color: theme.gridColor },
      ticks: { color: theme.mutedColor, font, precision: 0 },
      border: { display: false },
    },
  };
  return engineOptions;
}

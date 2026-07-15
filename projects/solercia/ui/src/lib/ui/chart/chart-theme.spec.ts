import {
  CHART_TOKEN_FALLBACKS,
  buildChartConfig,
  parseMs,
  parsePx,
  readChartTheme,
  withAlpha,
  type ChartThemeTokens,
  type SolChartData,
} from './chart-theme';

/**
 * Specs del adapter puro tokens → Chart.js (E3). Sin canvas, sin DOM, sin
 * mockear el motor: `buildChartConfig` es una función pura y aquí se prueba
 * la traducción completa (tipos, paleta, leyenda, ejes, tooltips).
 */

/** Cast utilitario: los tipos de Chart.js no tienen index signature. */
function asRecord(value: unknown): Record<string, any> {
  return value as Record<string, any>;
}

/** Tema de prueba con valores distinguibles por token. */
const THEME: ChartThemeTokens = {
  fontFamily: 'TestFont',
  fontSize: 11,
  textColor: '#111111',
  mutedColor: '#222222',
  gridColor: '#333333',
  surfaceColor: '#444444',
  palette: ['#AA0000', '#00BB00', '#0000CC'],
  animationMs: 400,
};

const ONE_SERIES: SolChartData = {
  labels: ['Ene', 'Feb', 'Mar'],
  series: [{ label: 'Citas', data: [1, 2, 3] }],
};

const TWO_SERIES: SolChartData = {
  labels: ['Ene', 'Feb'],
  series: [
    { label: 'A', data: [1, 2] },
    { label: 'B', data: [3, 4] },
  ],
};

describe('readChartTheme', () => {
  it('resuelve todos los tokens desde el lector de variables', () => {
    const vars = new Map(CHART_TOKEN_FALLBACKS.map(([name]) => [name, `valor(${name})`]));
    vars.set('--sol-font-size-sm', '15px');
    vars.set('--sol-dur-slow', '320ms');

    const theme = readChartTheme(name => vars.get(name) ?? '');

    expect(theme.fontFamily).toBe('valor(--sol-font-family)');
    expect(theme.fontSize).toBe(15);
    expect(theme.textColor).toBe('valor(--sol-color-text-secondary)');
    expect(theme.mutedColor).toBe('valor(--sol-color-text-muted)');
    expect(theme.gridColor).toBe('valor(--sol-border-color-default)');
    expect(theme.surfaceColor).toBe('valor(--sol-bg-surface)');
    expect(theme.palette).toEqual([
      'valor(--sol-chart-1)',
      'valor(--sol-chart-2)',
      'valor(--sol-chart-3)',
      'valor(--sol-chart-4)',
      'valor(--sol-chart-5)',
      'valor(--sol-chart-6)',
    ]);
    expect(theme.animationMs).toBe(320);
  });

  it('usa el fallback light cuando la variable no resuelve (jsdom/tema aún no aplicado)', () => {
    const theme = readChartTheme(() => '');
    expect(theme.palette[0]).toBe('#2563EB'); // --sol-chart-1 (default = primary light)
    expect(theme.fontSize).toBe(12);
    expect(theme.surfaceColor).toBe('#FFFFFF');
    expect(theme.animationMs).toBe(480); // --sol-dur-slow (default EMIT_TABLE)
  });

  it('recorta espacios de los valores leídos (getPropertyValue devuelve " #FFF")', () => {
    const theme = readChartTheme(() => '  #ABCDEF  ');
    expect(theme.textColor).toBe('#ABCDEF');
  });
});

describe('parsePx / withAlpha', () => {
  it('parsePx extrae el número y cae al fallback si no parsea', () => {
    expect(parsePx('14px', 12)).toBe(14);
    expect(parsePx('0.875rem', 12)).toBe(0.875);
    expect(parsePx('sin-numero', 12)).toBe(12);
  });

  it('withAlpha convierte hex de 6 y 3 dígitos a rgba', () => {
    expect(withAlpha('#2563EB', 0.15)).toBe('rgba(37, 99, 235, 0.15)');
    expect(withAlpha('#F00', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('withAlpha deja intactos colores no-hex (el canvas no soporta color-mix)', () => {
    expect(withAlpha('rgb(1, 2, 3)', 0.5)).toBe('rgb(1, 2, 3)');
    expect(withAlpha('tomato', 0.5)).toBe('tomato');
  });

  it('parseMs entiende ms y s, y cae al fallback si no parsea', () => {
    expect(parseMs('480ms', 480)).toBe(480);
    expect(parseMs(' 672ms ', 480)).toBe(672); // 480 × 1.4 (intensity expressive)
    expect(parseMs('0.5s', 480)).toBe(500);
    expect(parseMs('sin-numero', 480)).toBe(480);
  });
});

describe('buildChartConfig — animación de entrada (motion v2)', () => {
  it('usa la duración del tema y un easing nativo de entrada', () => {
    const options = buildChartConfig('bar', ONE_SERIES, THEME).options as unknown as Record<string, any>;
    expect(options['animation']['duration']).toBe(400);
    expect(options['animation']['easing']).toBe('easeOutQuart');
  });

  it('barras/líneas escalonan por índice de dato: stagger total ≈ una duración', () => {
    const options = buildChartConfig('bar', ONE_SERIES, THEME).options as unknown as Record<string, any>;
    const delay = options['animation']['delay'] as (ctx: Record<string, unknown>) => number;
    // 3 labels → unidad de delay 400/3 por punto, solo en la entrada inicial.
    expect(delay({ type: 'data', mode: 'default', dataIndex: 0 })).toBe(0);
    expect(delay({ type: 'data', mode: 'default', dataIndex: 2 })).toBeCloseTo((400 / 3) * 2);
    // Otras fases (resize, updates) no se retrasan.
    expect(delay({ type: 'data', mode: 'resize', dataIndex: 2 })).toBe(0);
    expect(delay({ type: 'dataset', mode: 'default', dataIndex: 2 })).toBe(0);
  });

  it('el doughnut NO escalona (la rotación de entrada anima el conjunto)', () => {
    const options = buildChartConfig('doughnut', ONE_SERIES, THEME).options as unknown as Record<string, any>;
    expect(options['animation']['duration']).toBe(400);
    expect(options['animation']['delay']).toBeUndefined();
  });
});

describe('buildChartConfig — tipos', () => {
  it('line: dataset con color de la paleta, tension y fill apagado', () => {
    const config = buildChartConfig('line', ONE_SERIES, THEME);
    expect(config.type).toBe('line');
    const ds = asRecord(config.data.datasets[0]);
    expect(ds['borderColor']).toBe('#AA0000');
    expect(ds['backgroundColor']).toBe('rgba(170, 0, 0, 0.15)');
    expect(ds['fill']).toBe(false);
    expect(ds['pointRadius']).toBe(3);
  });

  it('bar: barras sólidas con esquinas redondeadas', () => {
    const config = buildChartConfig('bar', ONE_SERIES, THEME);
    expect(config.type).toBe('bar');
    const ds = asRecord(config.data.datasets[0]);
    expect(ds['backgroundColor']).toBe('#AA0000');
    expect(ds['borderRadius']).toBe(4);
  });

  it('doughnut: paleta POR SEGMENTO, borde del color de superficie y cutout', () => {
    const config = buildChartConfig('doughnut', ONE_SERIES, THEME);
    expect(config.type).toBe('doughnut');
    const ds = asRecord(config.data.datasets[0]);
    // 3 puntos → 3 segmentos ciclando la paleta de 3.
    expect(ds['backgroundColor']).toEqual(['#AA0000', '#00BB00', '#0000CC']);
    expect(ds['borderColor']).toBe('#444444');
    expect((asRecord(config.options))['cutout']).toBe('68%');
    expect((asRecord(config.options))['scales']).toBeUndefined();
  });

  it('sparkline: motor line, sin ejes visibles, sin puntos, sin tooltip', () => {
    const config = buildChartConfig('sparkline', ONE_SERIES, THEME);
    expect(config.type).toBe('line');
    const ds = asRecord(config.data.datasets[0]);
    expect(ds['pointRadius']).toBe(0);
    expect(ds['fill']).toBe(true);
    const options = config.options as unknown as Record<string, any>;
    expect(options['scales']['x']['display']).toBe(false);
    expect(options['scales']['y']['display']).toBe(false);
    expect(options['plugins']['tooltip']['enabled']).toBe(false);
    expect(options['plugins']['legend']['display']).toBe(false);
  });
});

describe('buildChartConfig — paleta y colores explícitos', () => {
  it('asigna la paleta cíclicamente cuando hay más series que colores', () => {
    const data: SolChartData = {
      labels: ['X'],
      series: [
        { label: 'S1', data: [1] },
        { label: 'S2', data: [1] },
        { label: 'S3', data: [1] },
        { label: 'S4', data: [1] }, // paleta de 3 → recicla el primero
      ],
    };
    const config = buildChartConfig('line', data, THEME);
    const colors = config.data.datasets.map(d => asRecord(d)['borderColor']);
    expect(colors).toEqual(['#AA0000', '#00BB00', '#0000CC', '#AA0000']);
  });

  it('respeta el color explícito de la serie por encima de la paleta', () => {
    const data: SolChartData = {
      labels: ['X'],
      series: [{ label: 'S', data: [1], color: '#123456' }],
    };
    const config = buildChartConfig('bar', data, THEME);
    expect((asRecord(config.data.datasets[0]))['backgroundColor']).toBe('#123456');
  });
});

describe('buildChartConfig — leyenda, ejes y tooltips tematizados', () => {
  it('leyenda: oculta con una serie, visible con varias, siempre en doughnut', () => {
    const one = buildChartConfig('line', ONE_SERIES, THEME).options as unknown as Record<string, any>;
    const two = buildChartConfig('line', TWO_SERIES, THEME).options as unknown as Record<string, any>;
    const donut = buildChartConfig('doughnut', ONE_SERIES, THEME).options as unknown as Record<string, any>;
    expect(one['plugins']['legend']['display']).toBe(false);
    expect(two['plugins']['legend']['display']).toBe(true);
    expect(donut['plugins']['legend']['display']).toBe(true);
    expect(donut['plugins']['legend']['position']).toBe('bottom');
  });

  it('la opción legend fuerza el default por tipo', () => {
    const forced = buildChartConfig('line', TWO_SERIES, THEME, { legend: false })
      .options as unknown as Record<string, any>;
    expect(forced['plugins']['legend']['display']).toBe(false);
  });

  it('ejes y tooltip usan los tokens del tema (grid, ticks, superficie, fuente)', () => {
    const options = buildChartConfig('line', ONE_SERIES, THEME).options as unknown as Record<string, any>;
    expect(options['scales']['y']['grid']['color']).toBe('#333333');
    expect(options['scales']['x']['ticks']['color']).toBe('#222222');
    expect(options['scales']['x']['ticks']['font']).toEqual({ family: 'TestFont', size: 11 });
    expect(options['plugins']['tooltip']['backgroundColor']).toBe('#444444');
    expect(options['plugins']['tooltip']['titleColor']).toBe('#111111');
    expect(options['plugins']['legend']['labels']['color']).toBe('#111111');
  });

  it('yMax acota el eje Y solo cuando se pide (ej. porcentaje de ocupación)', () => {
    const sin = buildChartConfig('bar', ONE_SERIES, THEME).options as unknown as Record<string, any>;
    const con = buildChartConfig('bar', ONE_SERIES, THEME, { yMax: 100 }).options as unknown as Record<string, any>;
    expect(sin['scales']['y']['max']).toBeUndefined();
    expect(con['scales']['y']['max']).toBe(100);
    expect(con['scales']['y']['beginAtZero']).toBe(true);
  });

  it('no muta los datos de entrada (labels y data se copian)', () => {
    const labels = ['A'];
    const serieData = [1, 2];
    const config = buildChartConfig('line', { labels, series: [{ label: 'S', data: serieData }] }, THEME);
    config.data.labels!.push('B');
    (config.data.datasets[0].data as number[]).push(99);
    expect(labels).toEqual(['A']);
    expect(serieData).toEqual([1, 2]);
  });
});

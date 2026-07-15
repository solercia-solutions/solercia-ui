import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  SOL_TENANT_RESOLVER,
  SOL_DEFAULT_THEME,
  THEME_SOURCE,
} from './theme-host';
import { sanitizeAssetUrl } from './url-sanitizer';
import {
  ThemeFile,
  ThemeFont,
  ThemeComponent,
  ThemeLogo,
  ThemePrimitives,
  ThemeSemantic,
} from './theme.model';

const THEME_PREF_KEY = 'sol-dark-mode';

/** Modo visual soportado por todo tema (el toggle es preferencia local del usuario). */
export type ThemeMode = 'light' | 'dark';

/** Contexto que recibe un default v2 calculado: modo activo + resolutor de rutas del contrato. */
export interface EmitDefaultContext {
  mode: ThemeMode;
  /** Resuelve otra ruta del contrato (garantizada por las filas v1) al valor final del modo. */
  resolve: (path: string) => string;
}

/**
 * Default v1 de una fila v2: literal CSS, o función del contexto para defaults
 * derivados de otra ruta ya resuelta o dependientes del modo.
 */
export type EmitDefaultV1 = string | ((ctx: EmitDefaultContext) => string);

/**
 * Fila de la tabla de emisión. SIN default ⇒ token v1 OBLIGATORIO (ruta ausente
 * o rota lanza y el tema se descarta). CON default ⇒ token v2 opcional (ruta
 * ausente emite el default = look del `default.json` actual).
 */
export type EmitRow = readonly [name: string, path: string, defaultV1?: EmitDefaultV1];

/** Atajo para defaults v2 que copian otra ruta ya resuelta del contrato (respeta el modo). */
const sameAs = (path: string): EmitDefaultV1 => (ctx: EmitDefaultContext) => ctx.resolve(path);

/**
 * Tabla única de "qué variables existen": 95 filas (47 v1 obligatorias + 48 v2
 * con default). Cada fila es [nombreCssVar, rutaDelToken, defaultV1?]; la ruta
 * apunta dentro de `{ primitives, semantic, component }` (ver `resolveCssVars`).
 * Agregar/quitar una fila cambia el conjunto emitido — por eso el test de tokens
 * fija el conteo total y el de filas v1.
 */
export const EMIT_TABLE: ReadonlyArray<EmitRow> = [
  // Colors
  ['--sol-color-primary', 'semantic.color.primary'],
  ['--sol-color-secondary', 'semantic.color.secondary'],
  ['--sol-color-accent', 'semantic.color.accent'],
  ['--sol-color-success', 'semantic.color.success'],
  ['--sol-color-warning', 'semantic.color.warning'],
  ['--sol-color-danger', 'semantic.color.danger'],
  ['--sol-color-info', 'semantic.color.info'],
  ['--sol-color-text-primary', 'semantic.text.primary'],
  ['--sol-color-text-secondary', 'semantic.text.secondary'],
  ['--sol-color-text-muted', 'semantic.text.muted'],
  // Typography
  ['--sol-font-family', 'primitives.font.family.sans'],
  ['--sol-font-family-mono', 'primitives.font.family.mono'],
  ['--sol-font-size-base', 'primitives.font.size.base'],
  ['--sol-font-size-sm', 'primitives.font.size.sm'],
  ['--sol-font-size-lg', 'primitives.font.size.lg'],
  ['--sol-font-size-xl', 'primitives.font.size.xl'],
  ['--sol-font-weight-normal', 'primitives.font.weight.normal'],
  ['--sol-font-weight-bold', 'primitives.font.weight.bold'],
  ['--sol-line-height', 'primitives.font.lineHeight.base'],
  // Borders
  ['--sol-border-radius-sm', 'primitives.radius.sm'],
  ['--sol-border-radius-md', 'primitives.radius.md'],
  ['--sol-border-radius-lg', 'primitives.radius.lg'],
  ['--sol-border-radius-full', 'primitives.radius.full'],
  ['--sol-border-width-default', 'semantic.border.width'],
  ['--sol-border-color-default', 'semantic.border.color'],
  // Sizing
  ['--sol-size-input-height', 'component.control.inputHeight'],
  ['--sol-size-button-height', 'component.control.buttonHeight'],
  ['--sol-size-component-sm', 'primitives.size.control.sm'],
  ['--sol-size-component-md', 'primitives.size.control.md'],
  ['--sol-size-component-lg', 'primitives.size.control.lg'],
  ['--sol-size-sidebar-width', 'component.layout.sidebarWidth'],
  ['--sol-size-header-height', 'component.layout.headerHeight'],
  // Spacing
  ['--sol-space-xs', 'primitives.space.xs'],
  ['--sol-space-sm', 'primitives.space.sm'],
  ['--sol-space-md', 'primitives.space.md'],
  ['--sol-space-lg', 'primitives.space.lg'],
  ['--sol-space-xl', 'primitives.space.xl'],
  // Shadows
  ['--sol-shadow-sm', 'semantic.shadow.sm'],
  ['--sol-shadow-md', 'semantic.shadow.md'],
  ['--sol-shadow-lg', 'semantic.shadow.lg'],
  ['--sol-shadow-card', 'component.shadow.card'],
  // Z-Index
  ['--sol-z-dropdown', 'semantic.layer.dropdown'],
  ['--sol-z-modal', 'semantic.layer.modal'],
  ['--sol-z-tooltip', 'semantic.layer.tooltip'],
  // Backgrounds
  ['--sol-bg-page', 'semantic.surface.page'],
  ['--sol-bg-surface', 'semantic.surface.surface'],
  ['--sol-bg-overlay', 'semantic.surface.overlay'],

  // ——— v2 (opcionales, con default = look del default.json actual) ———
  // Superficie v2
  ['--sol-bg-sunken', 'semantic.surface.sunken', sameAs('semantic.surface.page')],
  ['--sol-bg-page-texture', 'semantic.surface.texture', 'none'],
  // Tipografía v2 (titulares + cifras)
  ['--sol-font-display', 'primitives.font.family.display', sameAs('primitives.font.family.sans')],
  ['--sol-display-weight', 'component.typography.displayWeight', sameAs('primitives.font.weight.bold')],
  ['--sol-display-tracking', 'component.typography.displayTracking', '0em'],
  ['--sol-display-transform', 'component.typography.displayTransform', 'none'],
  ['--sol-font-numeric', 'component.typography.numericFamily', sameAs('primitives.font.family.sans')],
  // Card
  ['--sol-card-bg', 'component.card.bg', sameAs('semantic.surface.surface')],
  ['--sol-card-border', 'component.card.border',
    ctx => `${ctx.resolve('semantic.border.width')} solid ${ctx.resolve('semantic.border.color')}`],
  ['--sol-card-radius', 'component.card.radius', sameAs('primitives.radius.lg')],
  ['--sol-card-shadow', 'component.card.shadow', sameAs('component.shadow.card')],
  // v1 no cambia la sombra al hover: el default de shadowHover es la misma sombra base.
  ['--sol-card-shadow-hover', 'component.card.shadowHover', sameAs('component.shadow.card')],
  ['--sol-card-blur', 'component.card.blur', 'none'],
  ['--sol-hover-lift', 'component.card.hoverLift', '0px'],
  // Input (defaults = estilos actuales de sol-input)
  ['--sol-input-bg', 'component.input.bg', sameAs('semantic.surface.surface')],
  ['--sol-input-border', 'component.input.border',
    ctx => `${ctx.resolve('semantic.border.width')} solid ${ctx.resolve('semantic.border.color')}`],
  ['--sol-input-radius', 'component.input.radius', sameAs('primitives.radius.md')],
  ['--sol-input-shadow', 'component.input.shadow', 'none'],
  ['--sol-input-focus-border', 'component.input.focusBorder',
    ctx => `${ctx.resolve('semantic.border.width')} solid ${ctx.resolve('semantic.color.primary')}`],
  ['--sol-input-focus-ring', 'component.input.focusRing',
    ctx => `0 0 0 2px color-mix(in srgb, ${ctx.resolve('semantic.color.primary')} 20%, transparent)`],
  // Botón (defaults = estilos actuales de sol-button)
  ['--sol-button-radius', 'component.button.radius', sameAs('primitives.radius.md')],
  ['--sol-button-shadow', 'component.button.shadow', 'none'],
  ['--sol-button-weight', 'component.button.weight', '500'],
  ['--sol-button-transform', 'component.button.transform', 'none'],
  // Sidebar (defaults = estilos actuales del widget sidebar; bg/texto siguen el modo)
  ['--sol-sidebar-bg', 'component.sidebar.bg', sameAs('semantic.surface.surface')],
  ['--sol-sidebar-text', 'component.sidebar.text', sameAs('semantic.text.secondary')],
  ['--sol-sidebar-active-bg', 'component.sidebar.activeBg',
    ctx => `color-mix(in srgb, ${ctx.resolve('semantic.color.primary')} 10%, transparent)`],
  ['--sol-sidebar-active-text', 'component.sidebar.activeText', sameAs('semantic.color.primary')],
  ['--sol-sidebar-item-radius', 'component.sidebar.itemRadius', sameAs('primitives.radius.md')],
  // v1 marca el item activo con barra izquierda de 3px — como box-shadow inset.
  ['--sol-sidebar-indicator', 'component.sidebar.indicator',
    ctx => `inset 3px 0 0 ${ctx.resolve('semantic.color.primary')}`],
  // Header
  ['--sol-header-bg', 'component.header.bg', sameAs('semantic.surface.surface')],
  ['--sol-header-blur', 'component.header.blur', 'none'],
  // Auth (heroBg se sanitiza: SOLO gradients o "none")
  ['--sol-auth-hero-bg', 'component.auth.heroBg', 'none'],
  // Motion (duraciones/distancia se escalan por `component.motion.intensity` antes de emitir)
  ['--sol-dur-fast', 'primitives.motion.duration.fast', '120ms'],
  ['--sol-dur-base', 'primitives.motion.duration.base', '240ms'],
  ['--sol-dur-slow', 'primitives.motion.duration.slow', '480ms'],
  ['--sol-ease', 'primitives.motion.easing.standard', 'cubic-bezier(0.2, 0, 0, 1)'],
  ['--sol-ease-entrance', 'primitives.motion.easing.entrance', 'cubic-bezier(0.2, 0, 0, 1)'],
  ['--sol-reveal-dist', 'component.motion.revealDistance', '12px'],
  ['--sol-press-scale', 'component.motion.pressScale', '0.98'],
  // Derivada: revealStyle → nombre del keyframe (los keyframes llegan en el Paso 3).
  ['--sol-reveal-name', 'component.motion.revealStyle', 'solRevealFade'],
  // Chart (defaults = paleta actual de sol-chart: primary, info, success, warning, danger, secondary)
  ['--sol-chart-1', 'component.chart.palette.0', sameAs('semantic.color.primary')],
  ['--sol-chart-2', 'component.chart.palette.1', sameAs('semantic.color.info')],
  ['--sol-chart-3', 'component.chart.palette.2', sameAs('semantic.color.success')],
  ['--sol-chart-4', 'component.chart.palette.3', sameAs('semantic.color.warning')],
  ['--sol-chart-5', 'component.chart.palette.4', sameAs('semantic.color.danger')],
  ['--sol-chart-6', 'component.chart.palette.5', sameAs('semantic.color.secondary')],
  // Overlay de diálogos: desenfoque del fondo (frosted glass detrás de todo
  // modal/confirm). Default con blur visible — pedido del fundador para que TODO
  // cuadro de diálogo lo lleve por defecto; un tema puede subirlo (glass) o
  // anularlo ("none", p. ej. skins planos/brutalistas).
  ['--sol-overlay-blur', 'component.overlay.blur', 'blur(3px)'],
];

interface ResolverContext {
  primitives: ThemePrimitives;
  semantic: ThemeSemantic;
  component: ThemeComponent;
}

/**
 * Referencias `{ruta}` — GLOBAL: los temas v2 embeben refs dentro de shorthands
 * ("2px solid {color.ink.900}", "inset 0 -1px 0 {color.ink.200}"); una ref que
 * ocupa todo el valor se comporta igual que en v1.
 */
const REF_PATTERN = /\{([^}]+)\}/g;

/** Variante NO lanzante de `getIn`: `undefined` cuando la ruta no existe (filas v2). */
function tryGetIn(source: unknown, path: string): unknown {
  let acc: unknown = source;
  for (const key of path.split('.')) {
    if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      acc = (acc as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return acc;
}

function getIn(source: unknown, path: string): unknown {
  const value = tryGetIn(source, path);
  if (value === undefined) {
    throw new Error(`resolveCssVars: ruta de token no encontrada "${path}"`);
  }
  return value;
}

/** Interpola TODAS las refs `{ruta}` de un valor (completas o embebidas) contra `primitives`. */
function interpolateRefs(value: string, primitives: ThemePrimitives): string {
  return value.replace(REF_PATTERN, (_match, refPath: string) => String(getIn(primitives, refPath)));
}

/** Puro: resuelve un valor del contrato — refs contra `primitives`, literales intactos. Lanza si falta. */
function resolveToken(ctx: ResolverContext, path: string): string {
  const raw = getIn(ctx, path);
  if (raw === null) {
    throw new Error(`resolveCssVars: valor sin resolver para "${path}"`);
  }
  return interpolateRefs(String(raw), ctx.primitives);
}

/** Multiplicador global de movimiento por intensidad. Sin bloque motion ⇒ 1 (look v1 intacto). */
const MOTION_INTENSITY_SCALE: Record<string, number> = {
  none: 0.01,
  subtle: 0.6,
  smooth: 1.0,
  expressive: 1.4,
};

/** Variables afectadas por el multiplicador (duraciones + distancia de reveal; pressScale NO se escala). */
const MOTION_SCALED_VARS: ReadonlySet<string> = new Set([
  '--sol-dur-fast',
  '--sol-dur-base',
  '--sol-dur-slow',
  '--sol-reveal-dist',
]);

/** Variables de background-image sanitizadas: SOLO gradients o "none" (jamás `url(`). */
const GRADIENT_GUARDED_VARS: ReadonlySet<string> = new Set([
  '--sol-bg-page-texture',
  '--sol-auth-hero-bg',
]);

const SAFE_GRADIENT_START =
  /^(?:linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\s*\(/i;

/**
 * Un background-image del tenant es seguro si es "none" o comienza con un
 * gradient permitido y NO contiene `url(` en ninguna posición (tolera varios
 * gradients separados por coma). Caso contrario se emite el default.
 */
export function isSafeBackgroundImage(value: string): boolean {
  const trimmed = value.trim();
  if (/^none$/i.test(trimmed)) return true;
  if (/url\s*\(/i.test(trimmed)) return false;
  return SAFE_GRADIENT_START.test(trimmed);
}

/** Mapa revealStyle → keyframe (los keyframes viven en `styles.css`). */
const REVEAL_KEYFRAME_BY_STYLE: Record<string, string> = {
  rise: 'solRevealRise',
  fade: 'solRevealFade',
  pop: 'solRevealPop',
  slide: 'solRevealSlide',
  zoom: 'solRevealZoom',
};

/** Escala del multiplicador de motion. `prefers-reduced-motion: reduce` fuerza "none" (0.01x). */
function motionScaleFor(component: ThemeComponent, reducedMotion: boolean): number {
  if (reducedMotion) return MOTION_INTENSITY_SCALE['none'];
  const intensity = component.motion?.intensity;
  return (intensity !== undefined ? MOTION_INTENSITY_SCALE[intensity] : undefined) ?? 1;
}

const SCALABLE_VALUE = /^(-?\d+(?:\.\d+)?)(ms|s|px|rem|em)$/;

/** Multiplica un valor CSS `<número><unidad>` conservando la unidad; valores compuestos quedan intactos. */
function scaleMotionValue(value: string, scale: number): string {
  if (scale === 1) return value;
  const match = SCALABLE_VALUE.exec(value.trim());
  if (!match) return value;
  const scaled = Number.parseFloat((Number.parseFloat(match[1]) * scale).toFixed(2));
  return `${scaled}${match[2]}`;
}

/**
 * Normaliza el bloque `chart` del componente: la paleta del tenant (3-6 colores)
 * se expande CÍCLICAMENTE o se recorta a exactamente 6 entradas para que las
 * filas `--sol-chart-1..6` resuelvan uniformemente. Paleta inválida o vacía ⇒
 * se ignora el bloque y aplican los defaults.
 */
function normalizeComponent(component: ThemeComponent): ThemeComponent {
  const palette = component.chart?.palette;
  if (!Array.isArray(palette) || palette.length === 0) {
    if (component.chart === undefined) return component;
    const withoutChart: ThemeComponent = { ...component };
    delete withoutChart.chart;
    return withoutChart;
  }
  const six = Array.from({ length: 6 }, (_, i) => String(palette[i % palette.length]));
  return { ...component, chart: { palette: six } };
}

/** Opciones de resolución dependientes del entorno (se mantienen fuera de la función pura). */
export interface ResolveCssVarsOptions {
  /** `prefers-reduced-motion: reduce` del sistema: fuerza el multiplicador "none". */
  reducedMotion?: boolean;
}

/**
 * Puro y exportado: aplana los 3 niveles (primitivos→semántico→componente) del
 * `ThemeFile` para un modo dado hacia el mapa plano nombre→valor de las
 * variables `--sol-*` de la EMIT_TABLE. Filas v1 son obligatorias (lanzan si
 * faltan); filas v2 ausentes emiten su default — un tema v1 emite el conjunto
 * completo. Es el núcleo testeable del sistema de tokens.
 */
export function resolveCssVars(
  file: ThemeFile,
  mode: ThemeMode,
  options: ResolveCssVarsOptions = {},
): Map<string, string> {
  const modeConfig = file.modes[mode];
  const ctx: ResolverContext = {
    primitives: file.primitives,
    semantic: modeConfig.semantic,
    component: normalizeComponent(modeConfig.component),
  };
  const defaultCtx: EmitDefaultContext = { mode, resolve: path => resolveToken(ctx, path) };
  const applyDefault = (d: EmitDefaultV1): string => (typeof d === 'string' ? d : d(defaultCtx));
  const motionScale = motionScaleFor(ctx.component, options.reducedMotion === true);

  const out = new Map<string, string>();
  for (const [name, path, defaultV1] of EMIT_TABLE) {
    let value: string;
    if (defaultV1 === undefined) {
      // Fila v1: obligatoria — ruta ausente o ref rota lanza (tema no renderizable).
      value = resolveToken(ctx, path);
    } else {
      const raw = tryGetIn(ctx, path);
      if (raw === undefined || raw === null) {
        value = applyDefault(defaultV1);
      } else if (name === '--sol-reveal-name') {
        // Derivada: revealStyle → keyframe; estilo desconocido cae al default.
        value = REVEAL_KEYFRAME_BY_STYLE[String(raw)] ?? applyDefault(defaultV1);
      } else {
        value = interpolateRefs(String(raw), ctx.primitives);
        if (GRADIENT_GUARDED_VARS.has(name) && !isSafeBackgroundImage(value)) {
          console.warn(
            `ThemeService: valor rechazado para ${name} (solo gradients o "none", sin "url("); se emite el default.`,
          );
          value = applyDefault(defaultV1);
        }
      }
    }
    if (MOTION_SCALED_VARS.has(name)) {
      value = scaleMotionValue(value, motionScale);
    }
    out.set(name, value);
  }
  return out;
}

/**
 * Construye la URL de Google Fonts EXCLUSIVAMENTE con `family` + `weights`
 * (sanitización por construcción: jamás se usa una URL cruda del tenant).
 * Entradas con `provider !== "google"` se ignoran. `null` = sin fuentes.
 */
export function buildGoogleFontsUrl(fonts: ThemeFont[] | undefined): string | null {
  const families = (fonts ?? [])
    .filter(f => f?.provider === 'google' && typeof f.family === 'string' && f.family.trim() !== '')
    .map(f => {
      const weights = [...new Set((f.weights ?? []).filter(w => Number.isFinite(w)))].sort(
        (a, b) => a - b,
      );
      const family = encodeURIComponent(f.family.trim());
      return weights.length > 0 ? `family=${family}:wght@${weights.join(';')}` : `family=${family}`;
    });
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

/**
 * Validación previa a aplicar un ThemeFile llegado en RUNTIME (asset o API):
 * un tema es renderizable si TODAS sus variables resuelven en AMBOS modos
 * (las v1 desde el tema; las v2 desde el tema o su default). Referencias
 * rotas, niveles ausentes o valores nulos lo descartan — el llamador cae al
 * tema anterior/default en vez de dejar el `:root` a medias.
 */
export function isRenderableTheme(file: ThemeFile | null | undefined): file is ThemeFile {
  if (!file || typeof file !== 'object' || !file.modes) return false;
  try {
    resolveCssVars(file, 'light');
    resolveCssVars(file, 'dark');
    return true;
  } catch {
    return false;
  }
}

/**
 * ThemeService — runtime de theming white-label, AGNÓSTICO del host.
 *
 * Emite los 95 tokens `--sol-*` sobre `:root` a partir de un `ThemeFile` y
 * reacciona a tres entradas: el tema del tenant (cargado por el puerto
 * `THEME_SOURCE` que provee el host), el default empaquetado
 * (`SOL_DEFAULT_THEME`) y el toggle light/dark. NO conoce el ORIGEN del tema
 * (HTTP, archivo, mock…): eso vive en el adaptador `ThemeSource` del host.
 *
 * RED DE FALLBACKS (de mejor a peor):
 * 1. tema del tenant (vía `THEME_SOURCE`),
 * 2. default empaquetado (`SOL_DEFAULT_THEME`),
 * 3. variables inline de `:root` (styles.css del host, red final).
 * Un source que falla / devuelve `null`, un `ThemeFile` de tenant inválido, o
 * un `SOL_DEFAULT_THEME` malformado degradan al siguiente nivel con un log,
 * sin dejar la app sin tema.
 *
 * ANTI-RACE: si el tenant activo cambia mientras su tema viaja, la respuesta
 * tardía se descarta (`isStaleResponse`).
 *
 * BRANDING: `logo` (URL SANITIZADA — solo http/https/relativas, jamás
 * `javascript:`), `brandName` y favicon del tenant (restaurado al volver al
 * default). Logo DUAL: `meta.logo.urlDark` es la variante para modo oscuro;
 * `logo()` expone la URL efectiva del modo actual y el favicon la sigue al
 * togglear. `activeTheme` expone el tema efectivo para consumidores reactivos
 * (ej. `sol-chart` re-renderiza al cambiar de tenant).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Puerto de carga del tema por tenant (lo provee el host; null-object por defecto → sin tema de tenant). */
  private readonly source = inject(THEME_SOURCE);
  /** Opcional: sin resolver (specs/otros hosts) el servicio se comporta como single-theme (solo default). */
  private readonly tenantResolver = inject(SOL_TENANT_RESOLVER, { optional: true });

  private readonly rawDefault = inject(SOL_DEFAULT_THEME);
  /**
   * Default empaquetado EN la librería (Vértice por defecto; el host puede
   * sobreescribir SOL_DEFAULT_THEME). VALIDADO como cualquier tema: un default
   * malformado cae a `null` → se activa la 3ª red (CSS inline de `:root`), sin
   * dejar la app rota (misma garantía que `tenantTheme`).
   */
  private readonly defaultTheme = signal<ThemeFile | null>(
    isRenderableTheme(this.rawDefault) ? this.rawDefault : null,
  );
  /** Tema del tenant activo, ya validado. `null` = usar el default. */
  private readonly tenantTheme = signal<ThemeFile | null>(null);
  private readonly _isDark = signal(this.loadDarkPreference());

  /** Tema EFECTIVO aplicado sobre `:root` (tenant → default → null = red de styles.css). */
  readonly activeTheme = computed<ThemeFile | null>(
    () => this.tenantTheme() ?? this.defaultTheme(),
  );

  readonly isDark = this._isDark.asReadonly();

  /**
   * Logo EFECTIVO del tema con URL sanitizada. URL insegura → sin logo (jamás
   * javascript:). Logo dual: en modo dark `url` expone la variante `urlDark`
   * si existe y es segura; sin `urlDark` (o insegura), `url` sirve en ambos
   * modos. Depende de `_isDark`, así que reacciona al toggle en runtime.
   */
  readonly logo = computed<ThemeLogo | null>(() => {
    const meta = this.activeTheme()?.meta;
    if (!meta?.logo) return null;
    const url = sanitizeAssetUrl(meta.logo.url);
    if (!url) return null;
    const urlDark = sanitizeAssetUrl(meta.logo.urlDark) ?? undefined;
    const effectiveUrl = this._isDark() && urlDark ? urlDark : url;
    return { ...meta.logo, url: effectiveUrl, urlDark };
  });

  /** Nombre de marca del tenant (branding runtime): altText del logo o el slug del tenant. */
  readonly brandName = computed<string | null>(() => {
    const meta = this.activeTheme()?.meta;
    if (!meta) return null;
    return meta.logo?.altText?.trim() || meta.tenant || null;
  });

  /** href original del favicon empaquetado (index.html); se captura una sola vez. */
  private faviconOriginalHref: string | null = null;
  private faviconCaptured = false;

  constructor() {
    if (this.defaultTheme() === null) {
      console.warn(
        'ThemeService: SOL_DEFAULT_THEME es inválido; se usa la red final (CSS inline de :root).',
      );
    }

    effect(() => {
      const file = this.activeTheme();
      const mode = this._isDark() ? 'dark' : 'light';
      if (file) {
        this.applyCssVariables(file, mode);
      } else {
        // Sin tema aplicable: se retiran las vars inline para que gobierne
        // la red final — el bloque :root de styles.css.
        this.clearCssVariables();
        this.applyDarkClass(this._isDark());
      }
    });

    // Favicon: SOLO el tema del tenant rebrandea; el default restaura el de
    // index.html. `logo()` ya es la variante efectiva del modo actual (logo
    // dual), así que el favicon reacciona también al toggle light/dark.
    effect(() => {
      const tenantLogo = this.tenantTheme() ? this.logo() : null;
      this.applyFavicon(tenantLogo?.url ?? null);
    });

    // Fuentes web por tenant (v2): un ÚNICO <link> a Google Fonts construido
    // por código (family + weights). Cambiar de tema reemplaza el link; un
    // tema sin `meta.fonts` lo retira.
    effect(() => {
      this.applyFonts(this.activeTheme()?.meta?.fonts);
    });

    if (this.tenantResolver) {
      const resolver = this.tenantResolver;
      effect(() => {
        const tenantId = resolver.activeTenantId();
        untracked(() => void this.onTenantChange(tenantId));
      });
    }
  }

  /**
   * Aplica directamente un ThemeFile de tenant (enfoque PUSH: el host lo empuja
   * en vez de que la librería tire vía THEME_SOURCE). Validado como cualquier
   * tema: uno inválido cae al default. Útil para hosts que ya tienen el tema en
   * memoria (SSR, caché) o que no quieren implementar un ThemeSource.
   */
  setTenantTheme(theme: ThemeFile | null): void {
    this.tenantTheme.set(isRenderableTheme(theme) ? theme : null);
  }

  toggleMode(): void {
    const newValue = !this._isDark();
    this._isDark.set(newValue);
    localStorage.setItem(THEME_PREF_KEY, String(newValue));
    this.applyDarkClass(newValue);
  }

  /**
   * Fuerza la recarga del tema del tenant activo (Theme Studio: tras el PUT
   * de `:id/theme` el tema recién persistido debe verse sin re-login ni
   * cambio de empresa). Re-lanza la misma petición del cambio de tenant —
   * hereda el anti-race y la red de fallbacks. Sin resolver o sin tenant
   * activo no hace nada (sigue el default).
   */
  refresh(): void {
    const tenantId = this.tenantResolver?.activeTenantId() ?? null;
    if (tenantId !== null) {
      void this.onTenantChange(tenantId);
    }
  }

  /**
   * Reacción al cambio de tenant (login, cambio de empresa activa, logout).
   * `null` (pre-login/logout) limpia el tema de tenant → vuelve el default.
   */
  private async onTenantChange(companyId: number | null): Promise<void> {
    if (companyId === null) {
      this.tenantTheme.set(null);
      return;
    }

    try {
      // La librería NO sabe de dónde viene el tema: se lo pide al puerto que
      // el host proveyó (HTTP, archivo, mock…). Sin adaptador → null → default.
      const file = await this.source.loadTheme(companyId);
      if (this.isStaleResponse(companyId)) return;
      if (isRenderableTheme(file)) {
        this.tenantTheme.set(file);
      } else {
        console.warn(
          `ThemeService: el tema de la empresa ${companyId} llegó inválido o vacío; se aplica el tema por defecto.`,
        );
        this.tenantTheme.set(null);
      }
    } catch {
      if (this.isStaleResponse(companyId)) return;
      // Cualquier fallo de carga (red, 404, 403, permisos…) degrada en
      // silencio al default: el theming nunca deja la app sin tema.
      console.warn(
        `ThemeService: tema del tenant ${companyId} no disponible; se aplica el tema por defecto.`,
      );
      this.tenantTheme.set(null);
    }
  }

  /** Anti-race: la respuesta pertenece a un tenant que ya no es el activo. */
  private isStaleResponse(companyId: number): boolean {
    return companyId !== (this.tenantResolver?.activeTenantId() ?? null);
  }

  private loadDarkPreference(): boolean {
    const stored = localStorage.getItem(THEME_PREF_KEY);
    if (stored !== null) return stored === 'true';
    // matchMedia no existe en jsdom — sin señal del sistema, modo claro.
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  }

  private applyDarkClass(dark: boolean): void {
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      html.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }

  private applyCssVariables(file: ThemeFile, mode: ThemeMode): void {
    const root = document.documentElement.style;
    const reducedMotion = this.prefersReducedMotion();
    for (const [name, value] of resolveCssVars(file, mode, { reducedMotion })) {
      root.setProperty(name, value);
    }
    this.applyDarkClass(this._isDark());
  }

  /** `prefers-reduced-motion: reduce` del sistema fuerza la intensidad "none" al emitir. */
  private prefersReducedMotion(): boolean {
    // matchMedia no existe en jsdom — sin señal del sistema, motion normal.
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Inyecta/reemplaza/retira el único <link> de fuentes del tenant (v2). */
  private applyFonts(fonts: ThemeFont[] | undefined): void {
    const href = buildGoogleFontsUrl(fonts);
    let link = document.head.querySelector<HTMLLinkElement>('link[data-sol-tenant-fonts]');
    if (href === null) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('data-sol-tenant-fonts', '');
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) {
      link.setAttribute('href', href);
    }
  }

  private clearCssVariables(): void {
    const root = document.documentElement.style;
    for (const [name] of EMIT_TABLE) {
      root.removeProperty(name);
    }
  }

  /** Aplica el favicon del tenant o restaura el empaquetado (`url === null`). */
  private applyFavicon(url: string | null): void {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!this.faviconCaptured) {
      this.faviconOriginalHref = link?.getAttribute('href') ?? null;
      this.faviconCaptured = true;
    }

    if (url === null) {
      if (!link) return;
      if (this.faviconOriginalHref === null) {
        // El link lo creó este servicio (no venía en index.html): se retira.
        link.remove();
      } else {
        link.setAttribute('href', this.faviconOriginalHref);
      }
      return;
    }

    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'icon');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}

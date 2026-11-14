/**
 * Constructor headless del Theme Studio: formulario curado → `ThemeFile` v2 completo (siempre
 * ambos modos) y el mapeo inverso (tema → formulario). Funciones puras, sin inyección de Angular.
 *
 * - Los campos COMPARTIDOS se emiten idénticos en ambos modos.
 * - Los campos POR MODO (`form.light` / `form.dark`) se emiten tal cual: el oscuro no se deriva
 *   del claro. Primario, acento, superficie, secundario, texto y roles son WYSIWYG.
 * - GUARDA DE CONTRASTE: con fondo de página oscuro (luminancia < 0.45) las superficies
 *   rebajadas, el overlay y el borde se derivan hacia negro; con fondo claro, hacia blanco.
 * - El tema base se PRESERVA: todo lo que el formulario no controla (colores primitivos extra,
 *   tamaños táctiles, `alerts.duration`, `auth.heroBg`, `table.mobile`, campos opacos de `meta`,
 *   etc.) sale intacto del `baseTheme`.
 */

import {
  SOL_BUNDLED_DEFAULT_THEME,
  SOL_TABLE_VARIANTS,
  resolveCssVars,
  type SolTableVariant,
  type ThemeFile,
  type ThemeFont,
  type ThemeMode,
  type ThemeModeConfig,
  type ThemeSemantic,
} from '@solercia/ui';
import { type DeepPartial, deepMerge } from './deep-merge';
import {
  BASE_SIZE_MAX,
  BASE_SIZE_MIN,
  DEFAULT_STUDIO_FORM,
  HEX_COLOR_PATTERN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  RADIUS_MAX,
  RADIUS_MIN,
  SERIF_DISPLAY_FONTS,
  STUDIO_BODY_FONTS,
  STUDIO_DISPLAY_FONTS,
  cloneStudioForm,
  type StudioAuthLayout,
  type StudioBorderWidth,
  type StudioButtonShape,
  type StudioDensity,
  type StudioDisplayTransform,
  type StudioDisplayWeight,
  type StudioHeaderStyle,
  type StudioInputStyle,
  type StudioMotionDuration,
  type StudioMotionIntensity,
  type StudioOverlayBlur,
  type StudioRevealStyle,
  type StudioShadowDirection,
  type StudioShadowSize,
  type StudioShadowStyle,
  type StudioSidebarStyle,
  type StudioTexture,
  type ThemeStudioForm,
  type ThemeStudioModeForm,
} from '../model/theme-studio-form.model';

// ─── Utilidades de color ───────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** rgba(...) CSS desde un hex #RRGGBB. */
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Mezcla lineal de dos hex (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const channel = (x: number, y: number): string =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`.toUpperCase();
}

/** Luminancia relativa aproximada (0 = negro, 1 = blanco). */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Razón de contraste WCAG (1 = sin contraste, 21 = máximo) sobre `luminance()`. */
function contrastRatio(a: string, b: string): number {
  const lumA = luminance(a) + 0.05;
  const lumB = luminance(b) + 0.05;
  return lumA > lumB ? lumA / lumB : lumB / lumA;
}

/**
 * Texto de las acciones secundarias (`semantic.color.secondaryContrast`): blanco o la tinta
 * oscura #1E293B, la que dé más contraste contra el `secondary` elegido.
 */
function secondaryContrastFor(secondary: string): string {
  return contrastRatio(secondary, '#FFFFFF') >= contrastRatio(secondary, '#1E293B')
    ? '#FFFFFF'
    : '#1E293B';
}

const px = (value: number): string => `${Math.round(value * 10) / 10}px`;

/** Número sin unidad, 1 decimal (line-height es unitless en CSS — nunca lleva "px"). */
const unitless = (value: number): string => `${Math.round(value * 10) / 10}`;

// ─── Recetas por control ───────────────────────────────────────────────────

/** Densidad → alturas de controles/sidebar/header y escala de espaciado. */
const DENSITY_RECIPES: Record<
  StudioDensity,
  {
    control: { sm: string; md: string; lg: string };
    sidebarWidth: string;
    headerHeight: string;
    space: { xs: string; sm: string; md: string; lg: string; xl: string };
  }
> = {
  compact: {
    control: { sm: '26px', md: '30px', lg: '34px' },
    sidebarWidth: '204px',
    headerHeight: '46px',
    space: { xs: '4px', sm: '7px', md: '12px', lg: '18px', xl: '26px' },
  },
  comfortable: {
    control: { sm: '30px', md: '34px', lg: '38px' },
    sidebarWidth: '224px',
    headerHeight: '52px',
    space: { xs: '4px', sm: '8px', md: '14px', lg: '22px', xl: '30px' },
  },
  spacious: {
    control: { sm: '34px', md: '40px', lg: '46px' },
    sidebarWidth: '248px',
    headerHeight: '62px',
    space: { xs: '6px', sm: '10px', md: '16px', lg: '26px', xl: '36px' },
  },
};

const BORDER_WIDTHS: Record<StudioBorderWidth, string> = {
  hairline: '1px',
  normal: '1.5px',
  thick: '2px',
};

/** Texturas que usan los colores del formulario (el resto son neutras/estructurales). */
const TEXTURE_USES_COLOR: ReadonlySet<StudioTexture> = new Set<StudioTexture>([
  'glow',
  'corners',
  'dots',
  'mesh',
  'vignette',
  'waves',
]);

/** Rejilla 5×5 de posiciones para la textura de puntos (sin background-size, se fija por %). */
const DOT_POSITIONS: ReadonlyArray<string> = (() => {
  const axis = ['10%', '30%', '50%', '70%', '90%'];
  const out: string[] = [];
  for (const y of axis) {
    for (const x of axis) {
      out.push(`${x} ${y}`);
    }
  }
  return out;
})();

function dotsGradient(color: string, dark: boolean): string {
  const a = dark ? 0.1 : 0.09;
  return DOT_POSITIONS.map(
    pos => `radial-gradient(circle at ${pos}, ${rgba(color, a)} 0 2.5px, transparent 3px)`,
  ).join(', ');
}

/**
 * Texturas de página parametrizadas con los colores del formulario. SOLO
 * gradients (linear/radial/repeating-*): pasan la sanitización de
 * `--sol-bg-page-texture` por construcción. `grid` y `stripes` son
 * estructurales (líneas neutras) e ignoran los colores.
 */
function textureFor(
  texture: StudioTexture,
  mode: 'light' | 'dark',
  color1: string,
  color2: string,
): string {
  const dark = mode === 'dark';
  switch (texture) {
    case 'none':
      return 'none';
    case 'glow':
      return `radial-gradient(900px 500px at 85% -10%, ${rgba(color1, dark ? 0.1 : 0.12)}, transparent 60%), radial-gradient(800px 500px at -10% 20%, ${rgba(color2, dark ? 0.08 : 0.09)}, transparent 55%)`;
    case 'grid':
      return dark
        ? 'repeating-linear-gradient(0deg, rgba(148,163,184,0.045) 0 1px, transparent 1px 56px), repeating-linear-gradient(90deg, rgba(148,163,184,0.045) 0 1px, transparent 1px 56px)'
        : 'repeating-linear-gradient(0deg, rgba(15,23,42,0.025) 0 1px, transparent 1px 56px), repeating-linear-gradient(90deg, rgba(15,23,42,0.025) 0 1px, transparent 1px 56px)';
    case 'stripes':
      return dark
        ? 'repeating-linear-gradient(135deg, rgba(237,230,218,0.02) 0 2px, transparent 2px 14px)'
        : 'repeating-linear-gradient(135deg, rgba(17,24,39,0.028) 0 2px, transparent 2px 14px)';
    case 'corners':
      return `radial-gradient(900px 650px at 0% 0%, ${rgba(color1, dark ? 0.16 : 0.2)}, transparent 55%), radial-gradient(850px 600px at 100% 0%, ${rgba(color2, dark ? 0.12 : 0.16)}, transparent 55%), radial-gradient(800px 650px at 100% 100%, ${rgba(color1, dark ? 0.14 : 0.12)}, transparent 55%), radial-gradient(700px 500px at 0% 100%, ${rgba(color2, 0.1)}, transparent 58%)`;
    case 'dots':
      return dotsGradient(color1, dark);
    case 'mesh':
      return `repeating-linear-gradient(45deg, ${rgba(color1, dark ? 0.06 : 0.05)} 0 1px, transparent 1px 22px), repeating-linear-gradient(-45deg, ${rgba(color2, dark ? 0.06 : 0.05)} 0 1px, transparent 1px 22px)`;
    case 'vignette':
      return `radial-gradient(120% 120% at 50% 30%, transparent 55%, ${rgba(color2, dark ? 0.3 : 0.16)} 100%)`;
    case 'waves':
      return `repeating-radial-gradient(circle at 50% 0%, ${rgba(color1, 0.05)} 0 1px, transparent 1px 18px), repeating-radial-gradient(circle at 50% 100%, ${rgba(color2, 0.04)} 0 1px, transparent 1px 22px)`;
  }
}

interface ShadowSet {
  sm: string;
  md: string;
  lg: string;
  card: string;
  cardHover: string;
  hoverLift: string;
  button: string;
}

/** Unidad de desplazamiento (dx, dy) por dirección; el preset aporta la magnitud. */
const SHADOW_DIRECTION_UNITS: Record<StudioShadowDirection, readonly [number, number]> = {
  'top-left': [-1, -1],
  top: [0, -1],
  'top-right': [1, -1],
  left: [-1, 0],
  center: [0, 0],
  right: [1, 0],
  'bottom-left': [-1, 1],
  bottom: [0, 1],
  'bottom-right': [1, 1],
};

interface ShadowLevel {
  /** Magnitud del desplazamiento (px) antes de aplicar la dirección. */
  mag: number;
  blur: number;
  spread: number;
  aLight: number;
  aDark: number;
}

/**
 * Presets de sombra: definen blur/spread/opacidad y la magnitud del offset.
 * El COLOR y la ORIENTACIÓN (dirección del offset) los aporta el usuario.
 */
const SHADOW_PRESETS: Record<
  Exclude<StudioShadowStyle, 'none'>,
  {
    sm: ShadowLevel;
    md: ShadowLevel;
    lg: ShadowLevel;
    card: ShadowLevel;
    cardHover: ShadowLevel;
    button: ShadowLevel | null;
    hoverLift: string;
  }
> = {
  soft: {
    sm: { mag: 1, blur: 2, spread: 0, aLight: 0.05, aDark: 0.05 },
    md: { mag: 6, blur: 16, spread: -8, aLight: 0.12, aDark: 0.4 },
    lg: { mag: 16, blur: 40, spread: -16, aLight: 0.16, aDark: 0.5 },
    card: { mag: 2, blur: 10, spread: -4, aLight: 0.08, aDark: 0.35 },
    cardHover: { mag: 10, blur: 24, spread: -10, aLight: 0.16, aDark: 0.5 },
    button: null,
    hoverLift: '-2px',
  },
  diffuse: {
    sm: { mag: 2, blur: 6, spread: 0, aLight: 0.06, aDark: 0.06 },
    md: { mag: 10, blur: 30, spread: -10, aLight: 0.18, aDark: 0.28 },
    lg: { mag: 24, blur: 60, spread: -20, aLight: 0.22, aDark: 0.32 },
    card: { mag: 12, blur: 34, spread: -14, aLight: 0.2, aDark: 0.3 },
    cardHover: { mag: 18, blur: 44, spread: -16, aLight: 0.28, aDark: 0.38 },
    button: { mag: 8, blur: 20, spread: -10, aLight: 0.45, aDark: 0.45 },
    hoverLift: '-4px',
  },
  hard: {
    sm: { mag: 0, blur: 0, spread: 0, aLight: 0, aDark: 0 },
    md: { mag: 4, blur: 0, spread: 0, aLight: 0.9, aDark: 0.9 },
    lg: { mag: 8, blur: 0, spread: 0, aLight: 0.9, aDark: 0.9 },
    card: { mag: 5, blur: 0, spread: 0, aLight: 0.9, aDark: 0.9 },
    cardHover: { mag: 7, blur: 0, spread: 0, aLight: 0.95, aDark: 0.95 },
    button: { mag: 3, blur: 0, spread: 0, aLight: 0.9, aDark: 0.9 },
    hoverLift: '-2px',
  },
};

/** Multiplicador de tamaño sobre blur/spread/mag de `SHADOW_PRESETS`. */
const SHADOW_SIZE_MULTIPLIERS: Record<StudioShadowSize, number> = {
  sm: 0.6,
  md: 1,
  lg: 1.6,
};

/** Un nivel de sombra → box-shadow con el color, la orientación y el tamaño del usuario. */
function shadowStr(
  level: ShadowLevel,
  color: string,
  unit: readonly [number, number],
  dark: boolean,
  sizeMult: number,
): string {
  const dx = Math.round(unit[0] * level.mag * sizeMult);
  const dy = Math.round(unit[1] * level.mag * sizeMult);
  const blur = Math.round(level.blur * sizeMult);
  const spread = Math.round(level.spread * sizeMult);
  const alpha = dark ? level.aDark : level.aLight;
  return `${dx}px ${dy}px ${blur}px ${spread}px ${rgba(color, alpha)}`;
}

/**
 * Sombras por estilo con COLOR, ORIENTACIÓN y TAMAÑO del usuario.
 * `diffuse` es la más expresiva; `hard` es neo-brutalista (sin blur); `none` deja todo plano y
 * solo pinta un anillo de foco en hover (el tamaño no aplica: no hay sombra que escalar).
 */
function shadowsFor(
  style: StudioShadowStyle,
  mode: 'light' | 'dark',
  color: string,
  direction: StudioShadowDirection,
  size: StudioShadowSize,
): ShadowSet {
  const dark = mode === 'dark';
  const unit = SHADOW_DIRECTION_UNITS[direction];
  if (style === 'none') {
    return {
      sm: 'none',
      md: 'none',
      lg: 'none',
      card: 'none',
      cardHover: `0 0 0 1px ${rgba(color, 0.3)}`,
      hoverLift: '0px',
      button: 'none',
    };
  }
  const preset = SHADOW_PRESETS[style];
  const sizeMult = SHADOW_SIZE_MULTIPLIERS[size];
  return {
    sm: style === 'hard' ? 'none' : shadowStr(preset.sm, color, unit, dark, sizeMult),
    md: shadowStr(preset.md, color, unit, dark, sizeMult),
    lg: shadowStr(preset.lg, color, unit, dark, sizeMult),
    card: shadowStr(preset.card, color, unit, dark, sizeMult),
    cardHover: shadowStr(preset.cardHover, color, unit, dark, sizeMult),
    hoverLift: preset.hoverLift,
    button: preset.button ? shadowStr(preset.button, color, unit, dark, sizeMult) : 'none',
  };
}

const REVEAL_DISTANCES: Record<StudioRevealStyle, string> = {
  rise: '22px',
  fade: '10px',
  pop: '14px',
  slide: '26px',
  zoom: '12px',
};

const PRESS_SCALES: Record<StudioMotionIntensity, number> = {
  none: 0.99,
  subtle: 0.99,
  smooth: 0.98,
  expressive: 0.97,
};

/**
 * Desenfoque del fondo tras un modal/panel → `component.overlay.blur`.
 * `soft` (default) coincide con el fallback que trae `@solercia/ui` cuando el tema no declara
 * este bloque en absoluto — emitirlo explícito no cambia el look por defecto, solo lo hace
 * editable.
 */
const OVERLAY_BLUR_CSS: Record<StudioOverlayBlur, string> = {
  none: 'none',
  soft: 'blur(3px)',
  medium: 'blur(8px)',
  strong: 'blur(14px)',
};

/** Multiplicador de duración sobre `primitives.motion.duration`. */
const MOTION_DURATION_MULTIPLIERS: Record<StudioMotionDuration, number> = {
  fast: 0.7,
  normal: 1,
  slow: 1.4,
};

/** `primitives.motion.duration` escalado por el multiplicador de duración elegido. `normal`
 *  (×1) reproduce los mismos 120/240/420ms que este contrato fijaba. */
function buildMotionDuration(duration: StudioMotionDuration): {
  fast: string;
  base: string;
  slow: string;
} {
  const mult = MOTION_DURATION_MULTIPLIERS[duration];
  return {
    fast: `${Math.round(120 * mult)}ms`,
    base: `${Math.round(240 * mult)}ms`,
    slow: `${Math.round(420 * mult)}ms`,
  };
}

/** Tracking editorial: los serif respiran; las grotesk se aprietan. */
function displayTrackingFor(family: string): string {
  return SERIF_DISPLAY_FONTS.has(family) ? '0em' : '-0.02em';
}

function fontStack(family: string, serif: boolean): string {
  return `'${family}', ${serif ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
}

// ─── Construcción del tema ─────────────────────────────────────────────────

/** Paleta efectiva de un modo (colores ya resueltos, sin refs). */
interface ModePalette {
  primary: string;
  accent: string;
  page: string;
  surface: string;
  sunken: string;
  overlay: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

/**
 * Paleta de un modo derivada de SU propio `pageBg` (WYSIWYG en primario/acento/superficie).
 * Fondo oscuro (luminancia < 0.45): superficies rebajadas/borde derivados hacia negro. Fondo
 * claro: derivados hacia blanco. La SUPERFICIE ya no se deriva del fondo: es
 * `m.surfaceBg`, un campo propio del formulario — `pageBg` ya no arrastra sidebar/cards/
 * encabezado. El texto (`textPrimary`) tampoco se deriva de la luminancia: es `m.textColor`,
 * WYSIWYG por modo (ver el campo en `theme-studio-form.model.ts`) — antes esta función lo fijaba
 * en `#111827`/`#F1F5F9` según la rama, sin control del usuario.
 */
function modePalette(m: ThemeStudioModeForm): ModePalette {
  const pageLuminance = luminance(m.pageBg);
  const darkish = pageLuminance < 0.45;
  if (!darkish) {
    // Fondo CASI blanco (>0.93, el caso de todos los `pageBg` sugeridos): el borde sube su
    // mezcla (0.18 vs. 0.13) para que cards/sidebar/superficie sigan distinguiéndose de la
    // página cuando ambas quedan claras. Fondo más gris/tintado: el borde por defecto ya
    // contrasta bien solo.
    const nearWhitePage = pageLuminance > 0.93;
    return {
      primary: m.primary,
      accent: m.accent,
      page: m.pageBg,
      surface: m.surfaceBg,
      sunken: mix(m.pageBg, '#0F172A', 0.045),
      overlay: 'rgba(15,23,42,0.55)',
      border: mix(m.pageBg, '#0F172A', nearWhitePage ? 0.18 : 0.13),
      textPrimary: m.textColor,
      textSecondary: '#4B5563',
      textMuted: '#8A94A6',
    };
  }
  return {
    primary: m.primary,
    accent: m.accent,
    page: m.pageBg,
    surface: m.surfaceBg,
    sunken: mix(m.pageBg, '#000000', 0.25),
    overlay: 'rgba(0,0,0,0.65)',
    border: mix(m.pageBg, '#FFFFFF', 0.16),
    textPrimary: m.textColor,
    textSecondary: '#B7C0CF',
    textMuted: '#7E8898',
  };
}

/**
 * Construye un `ThemeModeConfig` desde los compartidos + el bloque de ESE modo. `baseMode` es el
 * modo correspondiente del tema base (activo): preserva `component.alerts.duration` y
 * `component.auth.heroBg` cuando el base los trae (ninguno de los dos tiene control en el
 * formulario), en vez de fijarlos con un valor arbitrario.
 */
function buildMode(
  form: ThemeStudioForm,
  m: ThemeStudioModeForm,
  mode: 'light' | 'dark',
  baseMode: ThemeModeConfig,
): ThemeModeConfig {
  const p = modePalette(m);
  const density = DENSITY_RECIPES[form.density];
  const borderWidth = BORDER_WIDTHS[form.border];
  const shadows = shadowsFor(m.shadow, mode, m.shadowColor, m.shadowDirection, form.shadowSize);
  const radius = clamp(form.radius, RADIUS_MIN, RADIUS_MAX);
  const radiusMd = Math.round(radius * 0.55);

  // Botón (pill / redondeado / recto)
  const buttonRadius: Record<StudioButtonShape, string> = {
    pill: '999px',
    rounded: px(Math.max(4, radiusMd)),
    sharp: '2px',
  };

  // Input (relleno / contorno / subrayado) — underline vive en tokens, sin código condicional.
  const inputRecipes: Record<
    StudioInputStyle,
    { bg: string; border: string; radius: string; shadow: string; focusBorder: string; focusRing: string }
  > = {
    filled: {
      bg: p.sunken,
      border: `${borderWidth} solid transparent`,
      radius: px(Math.max(4, radiusMd)),
      shadow: 'none',
      focusBorder: `${borderWidth} solid ${p.primary}`,
      focusRing: `0 0 0 3px ${rgba(p.primary, 0.18)}`,
    },
    outline: {
      bg: p.surface,
      border: `${borderWidth} solid ${p.border}`,
      radius: px(Math.max(4, radiusMd)),
      shadow: 'none',
      focusBorder: `${borderWidth} solid ${p.primary}`,
      focusRing: `0 0 0 3px ${rgba(p.primary, 0.18)}`,
    },
    underline: {
      bg: 'transparent',
      border: '1px solid transparent',
      radius: '0px',
      shadow: `inset 0 -1px 0 ${p.border}`,
      focusBorder: '1px solid transparent',
      focusRing: `inset 0 -2px 0 ${p.primary}`,
    },
  };
  const input = inputRecipes[form.input];

  // Sidebar (claro / oscuro / acento) — puede ser oscuro aunque el modo sea light.
  const sidebarRecipes: Record<
    StudioSidebarStyle,
    { bg: string; text: string; activeBg: string; activeText: string; indicator: string }
  > = {
    light: {
      bg: p.surface,
      // Texto del menú = texto PRIMARIO (mismo color que el cuerpo y las tablas), no el
      // secundario apagado; la jerarquía del ítem activo la sostienen su fondo y color.
      text: p.textPrimary,
      activeBg: rgba(p.primary, mode === 'dark' ? 0.18 : 0.1),
      activeText: p.primary,
      indicator: `inset 3px 0 0 ${p.primary}`,
    },
    dark: {
      bg: mode === 'dark' ? '#070B12' : '#0F1523',
      text: '#9AA6BC',
      activeBg: rgba(p.primary, 0.2),
      activeText: '#FFFFFF',
      indicator: `inset 3px 0 0 ${p.primary}`,
    },
    accent: {
      bg: m.primary,
      text: 'rgba(255,255,255,0.82)',
      activeBg: 'rgba(255,255,255,0.18)',
      activeText: '#FFFFFF',
      indicator: 'inset 3px 0 0 rgba(255,255,255,0.9)',
    },
  };
  const sidebar = sidebarRecipes[m.sidebar];

  // Header (translúcido / sólido) — fondo de SUPERFICIE, no de página: el
  // translúcido conserva la alfa de siempre (0.82) sobre `p.surface` en vez de `p.page`.
  const header =
    m.header === 'translucent'
      ? { bg: rgba(p.surface, 0.82), blur: 'blur(10px)' }
      : { bg: p.surface, blur: 'none' };

  // Tipografía de titulares: `auto` cae a los defaults del look base.
  const displayWeight = form.displayWeight === 'auto' ? 700 : form.displayWeight;
  const displayTransform = form.displayTransform === 'auto' ? 'none' : form.displayTransform;

  // `secondary` y los roles de estado son WYSIWYG por modo; `secondaryContrast` se calcula.
  const color: ThemeSemantic['color'] = {
    primary: p.primary,
    secondary: m.secondary,
    secondaryContrast: secondaryContrastFor(m.secondary),
    accent: p.accent,
    success: m.success,
    warning: m.warning,
    danger: m.danger,
    info: m.info,
  };

  return {
    semantic: {
      color,
      text: { primary: p.textPrimary, secondary: p.textSecondary, muted: p.textMuted },
      surface: {
        page: p.page,
        surface: p.surface,
        overlay: p.overlay,
        sunken: p.sunken,
        texture: textureFor(m.texture, mode, m.textureColor1, m.textureColor2),
      },
      border: { color: p.border, width: borderWidth },
      layer: { dropdown: '{z.1000}', modal: '{z.1050}', tooltip: '{z.1100}' },
      shadow: { sm: shadows.sm, md: shadows.md, lg: shadows.lg },
    },
    component: {
      control: { inputHeight: density.control.md, buttonHeight: density.control.md },
      layout: { sidebarWidth: density.sidebarWidth, headerHeight: density.headerHeight },
      shadow: { card: shadows.card },
      alerts: {
        borderRadius: px(clamp(radiusMd, 4, 14)),
        showIcon: true,
        position: 'top-right',
        // Sin control en el formulario: se preserva el valor del tema base; 4000 sin base.
        duration: baseMode.component.alerts?.duration ?? 4000,
      },
      typography: {
        displayWeight,
        displayTracking: displayTrackingFor(form.displayFont),
        displayTransform,
      },
      card: {
        bg: p.surface,
        border: `${borderWidth} solid ${p.border}`,
        radius: px(radius),
        shadow: shadows.card,
        shadowHover: shadows.cardHover,
        blur: 'none',
        hoverLift: shadows.hoverLift,
      },
      input: {
        variant: form.input,
        bg: input.bg,
        border: input.border,
        radius: input.radius,
        shadow: input.shadow,
        focusBorder: input.focusBorder,
        focusRing: input.focusRing,
      },
      button: {
        radius: buttonRadius[form.button],
        shadow: shadows.button,
        weight: 600,
        transform: displayTransform === 'uppercase' ? 'uppercase' : 'none',
      },
      sidebar: {
        bg: sidebar.bg,
        text: sidebar.text,
        activeBg: sidebar.activeBg,
        activeText: sidebar.activeText,
        itemRadius: px(clamp(radiusMd, 0, 12)),
        indicator: sidebar.indicator,
      },
      header: { bg: header.bg, blur: header.blur },
      auth: {
        // Control del formulario (sección "Diseño del inicio de sesión").
        layout: form.authLayout,
        // heroBg no tiene control propio: se conserva el del tema base cuando existe, y solo se
        // deriva del primario cuando el base no trae uno (p. ej. sin tema activo todavía).
        heroBg:
          baseMode.component.auth?.heroBg ??
          `radial-gradient(760px 520px at 50% -10%, ${rgba(p.primary, mode === 'dark' ? 0.18 : 0.14)}, transparent 60%)`,
      },
      chart: {
        palette: [
          p.primary,
          p.accent,
          mix(p.primary, mode === 'dark' ? '#FFFFFF' : '#0F172A', 0.35),
          mix(p.accent, mode === 'dark' ? '#0B0F17' : '#FFFFFF', 0.35),
          mode === 'dark' ? '#64748B' : '#94A3B8',
          p.textPrimary,
        ],
      },
      motion: {
        intensity: form.intensity,
        revealStyle: form.reveal,
        revealDistance: REVEAL_DISTANCES[form.reveal],
        pressScale: PRESS_SCALES[form.intensity],
      },
      overlay: { blur: OVERLAY_BLUR_CSS[form.overlayBlur] },
      // Solo la variante: `deepMerge` conserva el resto del bloque del base (p. ej. `mobile`).
      table: { variant: form.tableVariant },
    },
  };
}

/** Fuentes web del tema: display + body (deduplicadas) con pesos acotados. */
function buildFonts(form: ThemeStudioForm): ThemeFont[] {
  const displayWeight = form.displayWeight === 'auto' ? 700 : form.displayWeight;
  const fonts: ThemeFont[] = [
    {
      family: form.displayFont,
      provider: 'google',
      weights: [...new Set([400, 600, displayWeight])].sort((a, b) => a - b),
    },
  ];
  if (form.bodyFont !== form.displayFont) {
    fonts.push({ family: form.bodyFont, provider: 'google', weights: [400, 500, 600, 700] });
  }
  return fonts;
}

/**
 * Formulario → `ThemeFile` v2 completo. Parte de un deep-merge sobre `baseTheme` (por defecto,
 * el tema empaquetado de la librería) y solo sobreescribe las rutas que el estudio controla.
 *
 * `metaExtras` viaja INTACTO a `meta` (campos opacos del host, p. ej. configuración de un puente
 * legado). No puede pisar las claves de `meta` que controla el formulario (`fonts`,
 * `defaultMode`).
 *
 * Nunca muta `baseTheme`, pero el resultado COMPARTE referencias con él en las ramas que el
 * formulario no toca: trátalo como de solo lectura y clónalo (`structuredClone`) antes de mutarlo.
 */
export function buildThemeFile(
  form: ThemeStudioForm,
  baseTheme: ThemeFile | null = SOL_BUNDLED_DEFAULT_THEME,
  metaExtras?: Readonly<Record<string, unknown>>,
): ThemeFile {
  const base = baseTheme ?? SOL_BUNDLED_DEFAULT_THEME;
  const baseSize = clamp(form.baseSize, BASE_SIZE_MIN, BASE_SIZE_MAX);
  const lineHeight = clamp(form.lineHeight, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX);
  const radius = clamp(form.radius, RADIUS_MIN, RADIUS_MAX);

  const patch: DeepPartial<ThemeFile> = {
    primitives: {
      color: {
        brand: { primary: form.light.primary, accent: form.light.accent },
      },
      font: {
        family: {
          sans: fontStack(form.bodyFont, false),
          display: fontStack(form.displayFont, SERIF_DISPLAY_FONTS.has(form.displayFont)),
        },
        size: {
          sm: px(baseSize - 1.5),
          base: px(baseSize),
          lg: px(baseSize + 1.5),
          xl: px(baseSize + 5.5),
        },
        lineHeight: { base: unitless(lineHeight) },
      },
      radius: {
        sm: px(Math.round(radius * 0.3)),
        md: px(Math.round(radius * 0.55)),
        lg: px(radius),
      },
      space: DENSITY_RECIPES[form.density].space,
      size: { control: DENSITY_RECIPES[form.density].control },
      borderWidth: { thin: BORDER_WIDTHS[form.border] },
      motion: {
        duration: buildMotionDuration(form.motionDuration),
        easing: {
          standard: 'cubic-bezier(0.2, 0, 0, 1)',
          entrance:
            form.reveal === 'pop'
              ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'cubic-bezier(0.16, 1, 0.3, 1)',
        },
      },
    },
    modes: {
      light: buildMode(form, form.light, 'light', base.modes.light),
      dark: buildMode(form, form.dark, 'dark', base.modes.dark),
    },
  };

  const merged = deepMerge(base, patch);
  return {
    ...merged,
    meta: {
      ...merged.meta,
      ...(metaExtras ?? {}),
      fonts: buildFonts(form),
      defaultMode: form.defaultMode,
    },
  };
}

// ─── Mapeo inverso: ThemeFile → formulario ─────────────────────────────────

/** Normaliza un color CSS resuelto (#hex o rgb/rgba) a #RRGGBB; null si no aplica. */
function cssColorToHex(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (HEX_COLOR_PATTERN.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(trimmed);
  if (match) {
    const toHex = (n: string): string => clamp(Number(n), 0, 255).toString(16).padStart(2, '0');
    return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`.toUpperCase();
  }
  return null;
}

/** Primer color CSS (rgba(...) o #hex) que aparece en un string, a #RRGGBB. */
function firstColorHex(value: string | undefined): string | null {
  if (!value) return null;
  const match = /rgba?\([^)]*\)|#[0-9A-Fa-f]{6}/i.exec(value);
  return match ? cssColorToHex(match[0]) : null;
}

function parsePx(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? Number.parseFloat(match[1]) : null;
}

/** Número sin unidad (line-height es unitless en CSS — nunca lleva "px"). */
function parseUnitless(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(-?\d+(?:\.\d+)?)$/.exec(value.trim());
  return match ? Number.parseFloat(match[1]) : null;
}

/** Familia curada cuyo nombre aparece en el stack CSS del tema, o null. */
function matchFamily(stack: string | undefined, catalog: ReadonlyArray<string>): string | null {
  if (!stack) return null;
  const lower = stack.toLowerCase();
  return catalog.find(f => lower.includes(f.toLowerCase())) ?? null;
}

function classifyShadow(cardShadow: string | undefined): StudioShadowStyle {
  const value = (cardShadow ?? 'none').trim();
  if (value === 'none' || value === '') return 'none';
  // Sombra dura desplazada sin blur: "Npx Npx 0 ..."
  if (/^-?\d+(?:\.\d+)?px\s+-?\d+(?:\.\d+)?px\s+0(?:px)?\s/.test(value)) return 'hard';
  const blurMatch = /^\S+\s+\S+\s+(\d+(?:\.\d+)?)px/.exec(value);
  if (blurMatch && Number.parseFloat(blurMatch[1]) >= 20) return 'diffuse';
  return 'soft';
}

/** Color de la sombra desde el token de card (rgba baked); null si es "none". */
function classifyShadowColor(cardShadow: string | undefined): string | null {
  const value = (cardShadow ?? '').trim();
  if (value === '' || value === 'none') return null;
  return firstColorHex(value);
}

/** Mapa "signo(dx):signo(dy)" → dirección (inverso de SHADOW_DIRECTION_UNITS). */
const DIRECTION_BY_SIGN: ReadonlyMap<string, StudioShadowDirection> = new Map(
  (Object.entries(SHADOW_DIRECTION_UNITS) as [StudioShadowDirection, readonly [number, number]][]).map(
    ([dir, [ux, uy]]) => [`${Math.sign(ux)}:${Math.sign(uy)}`, dir],
  ),
);

/** Orientación de la sombra desde el offset x/y del token de card. */
function classifyShadowDirection(cardShadow: string | undefined): StudioShadowDirection | null {
  const value = (cardShadow ?? '').trim();
  if (value === '' || value === 'none') return null;
  const match = /^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px/.exec(value);
  if (!match) return null;
  const key = `${Math.sign(Number(match[1]))}:${Math.sign(Number(match[2]))}`;
  return DIRECTION_BY_SIGN.get(key) ?? null;
}

/** Blur y magnitud del offset (dx u dy, el que no sea 0) de un box-shadow "dx dy blur spread color". */
function parseShadowBlurAndMag(value: string | undefined): { blur: number; mag: number } | null {
  const trimmed = (value ?? '').trim();
  if (trimmed === '' || trimmed === 'none') return null;
  const match = /^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/.exec(trimmed);
  if (!match) return null;
  return {
    blur: Number.parseFloat(match[3]),
    mag: Math.max(Math.abs(Number.parseFloat(match[1])), Math.abs(Number.parseFloat(match[2]))),
  };
}

/**
 * Tamaño de sombra desde `semantic.shadow.md`, contra el preset del estilo ya
 * clasificado (`classifyShadow`). Compara por BLUR cuando el preset lo tiene (soft/diffuse); en
 * `hard` el blur es siempre 0 en los 3 tamaños (sin blur por diseño), así que compara por la
 * MAGNITUD del offset en su lugar. `none` no tiene sombra que medir: conserva el fallback.
 */
function classifyShadowSize(
  mdShadow: string | undefined,
  style: StudioShadowStyle,
  fallback: StudioShadowSize,
): StudioShadowSize {
  if (style === 'none') return fallback;
  const parsed = parseShadowBlurAndMag(mdShadow);
  if (!parsed) return fallback;
  const preset = SHADOW_PRESETS[style].md;
  const measured = preset.blur > 0 ? parsed.blur / preset.blur : parsed.mag / preset.mag;
  // El bucle SIEMPRE encuentra un candidato (las 3 claves de SHADOW_SIZE_MULTIPLIERS existen
  // por construcción): el valor inicial nunca sobrevive, solo evita un `best` sin asignar.
  let best: StudioShadowSize = 'md';
  let bestDiff = Infinity;
  for (const size of Object.keys(SHADOW_SIZE_MULTIPLIERS) as StudioShadowSize[]) {
    const diff = Math.abs(measured - SHADOW_SIZE_MULTIPLIERS[size]);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = size;
    }
  }
  return best;
}

/** "240ms" → 240; null si no matchea. */
function parseMs(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(-?\d+(?:\.\d+)?)ms$/.exec(value.trim());
  return match ? Number.parseFloat(match[1]) : null;
}

/** Mapa inverso de `OVERLAY_BLUR_CSS` para clasificar `component.overlay.blur`. */
const OVERLAY_BLUR_BY_CSS: ReadonlyMap<string, StudioOverlayBlur> = new Map(
  (Object.entries(OVERLAY_BLUR_CSS) as [StudioOverlayBlur, string][]).map(([k, v]) => [v, k]),
);

function classifyTexture(texture: string | undefined): StudioTexture {
  const value = (texture ?? 'none').trim();
  if (value === 'none' || value === '') return 'none';
  if (value.includes('repeating-radial-gradient')) return 'waves';
  if (value.includes('repeating-linear-gradient')) {
    if (value.includes('45deg') && value.includes('-45deg')) return 'mesh';
    if (value.includes('135deg')) return 'stripes';
    return 'grid';
  }
  const radials = value.match(/radial-gradient\(/g)?.length ?? 0;
  if (radials >= 5) return 'dots';
  if (radials >= 3) return 'corners';
  if (radials === 1) return 'vignette';
  return 'glow';
}

/** Colores del gradiente de textura (para las texturas cromáticas); fallback si no aplica. */
function classifyTextureColors(
  texture: string | undefined,
  kind: StudioTexture,
  fallback: ThemeStudioModeForm,
): [string, string] {
  if (!TEXTURE_USES_COLOR.has(kind) || !texture) {
    return [fallback.textureColor1, fallback.textureColor2];
  }
  const matches = texture.match(/rgba?\([^)]*\)|#[0-9A-Fa-f]{6}/gi) ?? [];
  const hexes = matches.map(cssColorToHex).filter((h): h is string => h !== null);
  return [hexes[0] ?? fallback.textureColor1, hexes[1] ?? hexes[0] ?? fallback.textureColor2];
}

/** Variables ya resueltas de un modo → bloque `ThemeStudioModeForm`. */
function mapModeForm(
  vars: Map<string, string>,
  fallback: ThemeStudioModeForm,
): ThemeStudioModeForm {
  const get = (name: string): string | undefined => vars.get(name);

  const primary = cssColorToHex(get('--sol-color-primary')) ?? fallback.primary;
  const accent = cssColorToHex(get('--sol-color-accent')) ?? fallback.accent;
  const pageBg = cssColorToHex(get('--sol-bg-page')) ?? fallback.pageBg;
  // WYSIWYG: `--sol-bg-surface`/`--sol-color-secondary` son el `surfaceBg`/`secondary`
  // del formulario sin retoques — mismo mapeo directo que primary/accent/pageBg.
  const surfaceBg = cssColorToHex(get('--sol-bg-surface')) ?? fallback.surfaceBg;
  const secondary = cssColorToHex(get('--sol-color-secondary')) ?? fallback.secondary;
  // Color del texto: mismo mapeo directo WYSIWYG que `secondary`/`surfaceBg` arriba — ya no se
  // reclasifica por luminancia del fondo (ver `modePalette()`).
  const textColor = cssColorToHex(get('--sol-color-text-primary')) ?? fallback.textColor;
  // Roles de estado: mismo mapeo directo WYSIWYG que `secondary` arriba — la
  // EMIT_TABLE de `@solercia/ui` emite estas 4 vars sin default (fila de 2 elementos, igual que
  // `--sol-color-primary`), así que `get()` solo devuelve undefined con un tema irresoluble
  // (capturado antes por el try/catch de `mapThemeFileToForm`).
  const success = cssColorToHex(get('--sol-color-success')) ?? fallback.success;
  const warning = cssColorToHex(get('--sol-color-warning')) ?? fallback.warning;
  const danger = cssColorToHex(get('--sol-color-danger')) ?? fallback.danger;
  const info = cssColorToHex(get('--sol-color-info')) ?? fallback.info;

  const cardShadow = get('--sol-card-shadow');
  const shadow = classifyShadow(cardShadow);
  const shadowColor = classifyShadowColor(cardShadow) ?? fallback.shadowColor;
  const shadowDirection = classifyShadowDirection(cardShadow) ?? fallback.shadowDirection;

  // Sidebar: acento si coincide con el primario; oscuro por luminancia; claro en el resto.
  const sidebarBg = cssColorToHex(get('--sol-sidebar-bg'));
  let sidebar: StudioSidebarStyle = fallback.sidebar;
  if (sidebarBg !== null) {
    if (sidebarBg === primary) sidebar = 'accent';
    else if (luminance(sidebarBg) < 0.35 && luminance(pageBg) >= 0.45) sidebar = 'dark';
    else sidebar = 'light';
  }

  const headerBlur = (get('--sol-header-blur') ?? 'none').trim();
  const headerBg = (get('--sol-header-bg') ?? '').trim();
  const header: StudioHeaderStyle =
    headerBlur !== 'none' || headerBg.startsWith('rgba') ? 'translucent' : 'solid';

  const textureRaw = get('--sol-bg-page-texture');
  const texture = classifyTexture(textureRaw);
  const [textureColor1, textureColor2] = classifyTextureColors(textureRaw, texture, fallback);

  return {
    primary,
    accent,
    pageBg,
    surfaceBg,
    secondary,
    textColor,
    success,
    warning,
    danger,
    info,
    shadow,
    shadowColor,
    shadowDirection,
    sidebar,
    header,
    texture,
    textureColor1,
    textureColor2,
  };
}

/**
 * Tema (tema activo) → formulario. Mapeo best-effort: resuelve AMBOS modos
 * (`resolveCssVars` interpola refs y aplica defaults v2) para llenar las
 * pestañas Claro y Oscuro por separado; los compartidos se leen del modo
 * light (canónico). Los valores que no se pueden clasificar conservan los
 * del `fallback`.
 */
export function mapThemeFileToForm(
  theme: ThemeFile,
  fallback: ThemeStudioForm = DEFAULT_STUDIO_FORM,
): ThemeStudioForm {
  let lightVars: Map<string, string>;
  let darkVars: Map<string, string>;
  try {
    lightVars = resolveCssVars(theme, 'light');
    darkVars = resolveCssVars(theme, 'dark');
  } catch {
    return cloneStudioForm(fallback);
  }
  const get = (name: string): string | undefined => lightVars.get(name);

  const baseSize = parsePx(get('--sol-font-size-base'));
  const lineHeightRaw = parseUnitless(get('--sol-line-height'));
  const cardRadius = parsePx(get('--sol-card-radius'));
  const buttonRadius = parsePx(get('--sol-button-radius'));
  const headerHeight = parsePx(get('--sol-size-header-height')) ?? 52;
  const borderWidthPx = parsePx(get('--sol-border-width-default')) ?? 1;

  // Input: subrayado si el shadow es inset inferior o el bg es transparente;
  // relleno si el bg difiere de la superficie; contorno en el resto.
  const inputBg = (get('--sol-input-bg') ?? '').trim();
  const inputShadow = (get('--sol-input-shadow') ?? '').trim();
  const surface = (get('--sol-bg-surface') ?? '').trim();
  let input: StudioInputStyle = fallback.input;
  if (inputBg === 'transparent' || /inset\s+0\s+-\d/.test(inputShadow)) {
    input = 'underline';
  } else if (cssColorToHex(inputBg) !== null && cssColorToHex(inputBg) !== cssColorToHex(surface)) {
    input = 'filled';
  } else {
    input = 'outline';
  }

  const density: StudioDensity =
    headerHeight <= 48 ? 'compact' : headerHeight <= 56 ? 'comfortable' : 'spacious';

  const border: StudioBorderWidth =
    borderWidthPx <= 1 ? 'hairline' : borderWidthPx < 2 ? 'normal' : 'thick';

  let button: StudioButtonShape = fallback.button;
  if (buttonRadius !== null) {
    button = buttonRadius >= 100 ? 'pill' : buttonRadius <= 3 ? 'sharp' : 'rounded';
  }

  // Bloques v2 con enumerados: lectura directa del contrato (modo light).
  const lightComponent = theme.modes.light.component;
  const intensity = (lightComponent.motion?.intensity ?? fallback.intensity) as StudioMotionIntensity;
  const reveal = (lightComponent.motion?.revealStyle ?? fallback.reveal) as StudioRevealStyle;

  const rawWeight = lightComponent.typography?.displayWeight;
  const displayWeight: StudioDisplayWeight =
    rawWeight === 600 || rawWeight === 700 || rawWeight === 800 ? rawWeight : 'auto';
  const rawTransform = lightComponent.typography?.displayTransform;
  const displayTransform: StudioDisplayTransform =
    rawTransform === 'uppercase' ? 'uppercase' : rawTransform === 'none' ? 'none' : 'auto';

  // Diseño del login: sin control en el CSS resuelto (lo lee login-page.component.ts directo del
  // contrato) — se lee del bloque v2 igual que intensity/reveal, con el mismo fallback si falta.
  const rawAuthLayout = lightComponent.auth?.layout;
  const authLayout: StudioAuthLayout =
    rawAuthLayout === 'centered' || rawAuthLayout === 'split-left' || rawAuthLayout === 'split-right'
      ? rawAuthLayout
      : fallback.authLayout;

  // Duración: se infiere comparando `duration.base` contra los 240ms de
  // 'normal' — 'fast' (168ms) queda por debajo, 'slow' (336ms) por encima.
  const durationBaseMs = parseMs(get('--sol-dur-base'));
  const motionDuration: StudioMotionDuration =
    durationBaseMs === null
      ? fallback.motionDuration
      : durationBaseMs < 240
        ? 'fast'
        : durationBaseMs > 240
          ? 'slow'
          : 'normal';

  // Tamaño de sombra: se infiere del blur/magnitud de `semantic.shadow.md`
  // contra el preset del ESTILO ya clasificado (modo light, canónico).
  const shadowSize = classifyShadowSize(get('--sol-shadow-md'), classifyShadow(get('--sol-card-shadow')), fallback.shadowSize);

  // Desenfoque de superposición: lectura directa del contrato, igual que
  // intensity/reveal/authLayout.
  const rawOverlayBlur = lightComponent.overlay?.blur;
  const overlayBlur: StudioOverlayBlur =
    rawOverlayBlur !== undefined && OVERLAY_BLUR_BY_CSS.has(rawOverlayBlur)
      ? (OVERLAY_BLUR_BY_CSS.get(rawOverlayBlur) as StudioOverlayBlur)
      : fallback.overlayBlur;

  // Modo por defecto de la entidad (BD): lectura directa de `meta.defaultMode`, igual que
  // authLayout arriba. Un tema v1, o v2 sin este campo, cae al fallback (DEFAULT_STUDIO_FORM
  // trae 'light').
  const rawDefaultMode = theme.meta?.defaultMode;
  const defaultMode: ThemeMode =
    rawDefaultMode === 'light' || rawDefaultMode === 'dark' ? rawDefaultMode : fallback.defaultMode;

  const rawVariant = lightComponent.table?.variant;
  const tableVariant: SolTableVariant =
    rawVariant !== undefined && SOL_TABLE_VARIANTS.includes(rawVariant) ? rawVariant : fallback.tableVariant;

  return {
    displayFont: matchFamily(get('--sol-font-display'), STUDIO_DISPLAY_FONTS) ?? fallback.displayFont,
    bodyFont: matchFamily(get('--sol-font-family'), STUDIO_BODY_FONTS) ?? fallback.bodyFont,
    displayWeight,
    displayTransform,
    baseSize: baseSize !== null ? clamp(baseSize, BASE_SIZE_MIN, BASE_SIZE_MAX) : fallback.baseSize,
    lineHeight:
      lineHeightRaw !== null
        ? clamp(lineHeightRaw, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX)
        : fallback.lineHeight,
    radius: cardRadius !== null ? clamp(Math.round(cardRadius), RADIUS_MIN, RADIUS_MAX) : fallback.radius,
    button,
    input,
    density,
    border,
    intensity,
    reveal,
    motionDuration,
    overlayBlur,
    shadowSize,
    authLayout,
    defaultMode,
    tableVariant,
    light: mapModeForm(lightVars, fallback.light),
    dark: mapModeForm(darkVars, fallback.dark),
  };
}

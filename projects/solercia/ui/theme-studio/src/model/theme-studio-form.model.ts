import type { SolTableVariant, ThemeMode } from '@solercia/ui';

/**
 * Modelo del formulario curado del Theme Studio.
 *
 * Cada control mapea 1:1 a rutas del contrato `ThemeFile` v2 (ver `theme-builder.ts`): el
 * estudio nunca expone un editor de JSON crudo y, por construcción, no produce un tema que
 * `isRenderableTheme` rechace.
 *
 * Estructura:
 *   - Campos COMPARTIDOS entre modos (tipografía, forma, densidad, bordes, movimiento, tabla):
 *     se editan una sola vez y aplican a claro y oscuro.
 *   - Campos POR MODO (`light`/`dark`, tipo `ThemeStudioModeForm`): color, sombra, textura,
 *     barra lateral y encabezado. Se editan por separado y no se derivan uno del otro.
 */

export type StudioShadowStyle = 'none' | 'soft' | 'diffuse' | 'hard';
/** Orientación del desplazamiento de la sombra (rejilla de 8 direcciones + centrada). */
export type StudioShadowDirection =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';
export type StudioButtonShape = 'pill' | 'rounded' | 'sharp';
export type StudioInputStyle = 'filled' | 'outline' | 'underline';
export type StudioSidebarStyle = 'light' | 'dark' | 'accent';
export type StudioHeaderStyle = 'translucent' | 'solid';
/** Diseño de la pantalla de inicio de sesión (`component.auth.layout`). */
export type StudioAuthLayout = 'centered' | 'split-left' | 'split-right';
export type StudioDensity = 'compact' | 'comfortable' | 'spacious';
export type StudioBorderWidth = 'hairline' | 'normal' | 'thick';
/** Texturas de página: todas son gradients (sanitizables por construcción). */
export type StudioTexture =
  | 'none'
  | 'glow'
  | 'grid'
  | 'stripes'
  | 'corners'
  | 'dots'
  | 'mesh'
  | 'vignette'
  | 'waves';
export type StudioMotionIntensity = 'none' | 'subtle' | 'smooth' | 'expressive';
export type StudioRevealStyle = 'rise' | 'fade' | 'pop' | 'slide' | 'zoom';
/** `auto` = el peso por defecto del look base (700). */
export type StudioDisplayWeight = 'auto' | 600 | 700 | 800;
export type StudioDisplayTransform = 'auto' | 'none' | 'uppercase';
/** Multiplicador sobre `primitives.motion.duration`: 0.7 / 1 / 1.4. */
export type StudioMotionDuration = 'fast' | 'normal' | 'slow';
/** Multiplicador sobre blur/spread/desplazamiento de las sombras: 0.6 / 1 / 1.6. */
export type StudioShadowSize = 'sm' | 'md' | 'lg';
/** `component.overlay.blur`: none | blur(3px) | blur(8px) | blur(14px). */
export type StudioOverlayBlur = 'none' | 'soft' | 'medium' | 'strong';

/** Valores del formulario que cambian entre modos. Se emiten tal cual (sin derivar el oscuro). */
export interface ThemeStudioModeForm {
  /** Colores en hex `#RRGGBB` (validados con `HEX_COLOR_PATTERN`). */
  primary: string;
  accent: string;
  pageBg: string;
  /** Fondo de superficies: barra lateral clara, tarjetas y encabezado (`semantic.surface.surface`). */
  surfaceBg: string;
  /** Fondo de acciones secundarias; el texto se calcula por contraste (`secondaryContrast`). */
  secondary: string;
  /** `semantic.text.primary`: texto normal (párrafos, tablas, etiquetas). */
  textColor: string;
  /** Roles de estado (`semantic.color.success/warning/danger/info`). */
  success: string;
  warning: string;
  danger: string;
  info: string;
  shadow: StudioShadowStyle;
  shadowColor: string;
  shadowDirection: StudioShadowDirection;
  sidebar: StudioSidebarStyle;
  header: StudioHeaderStyle;
  texture: StudioTexture;
  textureColor1: string;
  textureColor2: string;
}

/** Estado completo del formulario: compartidos + un bloque por modo. */
export interface ThemeStudioForm {
  // ── Compartidos ──
  displayFont: string;
  bodyFont: string;
  displayWeight: StudioDisplayWeight;
  displayTransform: StudioDisplayTransform;
  /** Tamaño base del texto en px (12.5 – 15); los titulares escalan desde aquí. */
  baseSize: number;
  /** Interlineado unitless (1.2 – 2.0). */
  lineHeight: number;
  /** Radio de las tarjetas en px (0 – 26); el resto de radios se escala desde aquí. */
  radius: number;
  button: StudioButtonShape;
  input: StudioInputStyle;
  density: StudioDensity;
  border: StudioBorderWidth;
  intensity: StudioMotionIntensity;
  reveal: StudioRevealStyle;
  motionDuration: StudioMotionDuration;
  overlayBlur: StudioOverlayBlur;
  shadowSize: StudioShadowSize;
  authLayout: StudioAuthLayout;
  /** Modo por defecto del tenant (`meta.defaultMode`). */
  defaultMode: ThemeMode;
  /** Variante visual de las tablas (`component.table.variant`, igual en ambos modos). */
  tableVariant: SolTableVariant;
  // ── Por modo ──
  light: ThemeStudioModeForm;
  dark: ThemeStudioModeForm;
}

/** Claves de color por modo que se muestran con sugerencias curadas. */
export type StudioColorFieldKey =
  | 'primary'
  | 'accent'
  | 'pageBg'
  | 'surfaceBg'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

/** Todas las claves por modo que son colores hex libres. */
export type StudioModeColorKey =
  | StudioColorFieldKey
  | 'shadowColor'
  | 'textureColor1'
  | 'textureColor2'
  | 'textColor';

/** Validación de los campos hex libres. */
export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const BASE_SIZE_MIN = 12.5;
export const BASE_SIZE_MAX = 15;
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 26;
export const LINE_HEIGHT_MIN = 1.2;
export const LINE_HEIGHT_MAX = 2.0;

/** Orden de la rejilla 3×3 del selector de orientación de la sombra. */
export const STUDIO_SHADOW_DIRECTIONS: ReadonlyArray<StudioShadowDirection> = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];

/** Fuentes de acceso rápido (chips). */
export const STUDIO_DISPLAY_FONTS_QUICK: ReadonlyArray<string> = [
  'Cormorant Garamond',
  'Space Grotesk',
  'Bricolage Grotesque',
  'Syne',
  'Playfair Display',
];

export const STUDIO_BODY_FONTS_QUICK: ReadonlyArray<string> = ['Jost', 'Albert Sans', 'Archivo', 'Inter'];

/** Catálogo completo de fuentes curadas (Google Fonts) para el desplegable "Más fuentes". */
export const STUDIO_DISPLAY_FONTS: ReadonlyArray<string> = [
  ...STUDIO_DISPLAY_FONTS_QUICK,
  'Sora',
  'Outfit',
  'Poppins',
  'Montserrat',
  'Fraunces',
  'Lora',
  'Libre Franklin',
  'Instrument Sans',
  'Manrope',
];

export const STUDIO_BODY_FONTS: ReadonlyArray<string> = [
  ...STUDIO_BODY_FONTS_QUICK,
  'Roboto',
  'Open Sans',
  'Lato',
  'Work Sans',
  'Source Sans 3',
  'Nunito Sans',
  'IBM Plex Sans',
  'DM Sans',
  'Public Sans',
  'Figtree',
  'Onest',
  'Plus Jakarta Sans',
];

/** Familias de titulares que rematan en serif (stack CSS con respaldo serif). */
export const SERIF_DISPLAY_FONTS: ReadonlySet<string> = new Set([
  'Cormorant Garamond',
  'Playfair Display',
  'Fraunces',
  'Lora',
]);

/**
 * Sugerencias de color para el modo CLARO. Los primarios y roles de estado están probados a
 * >= 4.5:1 contra texto blanco; los fondos son neutros claros con leve temperatura.
 */
export const STUDIO_COLOR_SUGGESTIONS_LIGHT: Readonly<Record<StudioColorFieldKey, ReadonlyArray<string>>> = {
  primary: ['#17324F', '#302858', '#0C3733', '#1E2F1F', '#592132', '#1F2937'],
  accent: ['#C98A3E', '#D2755A', '#B5573A', '#C9A227', '#7C8C3F', '#B5651D'],
  pageBg: ['#FBF9F5', '#F7F3EC', '#F1F3F5', '#EEF3F8', '#F5F0E6', '#F0EFEC'],
  surfaceBg: ['#FFFFFF', '#FDFBF7', '#FAF9F6', '#F8FAFB', '#FCFAF5', '#F9F8F4'],
  secondary: ['#E2E8F0', '#E5E7EB', '#E9E5E0', '#DCE3EA', '#E6E1DC', '#DDE2E6'],
  success: ['#3F7D4E', '#4D7C5F', '#15803D', '#2F6B4F', '#166534'],
  warning: ['#8A6D1F', '#96690F', '#A16207', '#B45309', '#92400E'],
  danger: ['#DC2626', '#9C4A3C', '#B91C1C', '#9F2A2A', '#8E3B2E'],
  info: ['#4A7A9E', '#2C6E8E', '#3A6C82', '#0369A1', '#345E7C'],
};

/**
 * Sugerencias para el modo OSCURO: primarios y roles un paso más claros (>= 4.5:1 contra el
 * fondo oscuro de referencia #0B0F17), desaturados para uso prolongado.
 */
export const STUDIO_COLOR_SUGGESTIONS_DARK: Readonly<Record<StudioColorFieldKey, ReadonlyArray<string>>> = {
  primary: ['#8FB8E8', '#B7A6E0', '#7FCFC0', '#A9C9A0', '#E3A9B8', '#B9C4D6'],
  accent: ['#E3A85C', '#E2917A', '#D08563', '#DBC157', '#A3B06B', '#CE9455'],
  pageBg: ['#0B1220', '#17140F', '#16181B', '#0E1912', '#180F17', '#0A0E14'],
  surfaceBg: ['#1A202D', '#25221D', '#242629', '#1C2720', '#261D25', '#191C22'],
  secondary: ['#6B7A93', '#64748B', '#5B6B85', '#708299', '#5E6E88', '#7B8AA6'],
  success: ['#7FCB9E', '#9BC9AC', '#A8D1B5', '#B4D0C0', '#8FCBA8'],
  warning: ['#D9A857', '#E8B15C', '#E4B76B', '#DBBE7A', '#F0C878'],
  danger: ['#D98C8C', '#E29999', '#E6A5A5', '#E7A8A1', '#EAB4AE'],
  info: ['#7AB8DE', '#93B8CC', '#67C3F3', '#8FC6E8', '#9CC8E8'],
};

export const STUDIO_SHADOW_COLOR_SUGGESTIONS: ReadonlyArray<string> = [
  '#0F172A',
  '#000000',
  '#334155',
  '#1E293B',
  '#2563EB',
  '#8C2456',
];

export const STUDIO_TEXTURE_COLOR_SUGGESTIONS: ReadonlyArray<string> = [
  '#F59E0B',
  '#2563EB',
  '#0FD3B0',
  '#EC4899',
  '#7C3AED',
  '#FFFFFF',
];

/** Sugerencias sobrias para el color del texto (>= 9.9:1 contra los fondos por defecto). */
export const STUDIO_TEXT_COLOR_SUGGESTIONS_LIGHT: ReadonlyArray<string> = [
  '#111827',
  '#1F2937',
  '#334155',
  '#3F3F46',
  '#292524',
  '#1E293B',
];

export const STUDIO_TEXT_COLOR_SUGGESTIONS_DARK: ReadonlyArray<string> = [
  '#F1F5F9',
  '#E5E7EB',
  '#F8FAFC',
  '#E2E8F0',
  '#EDE9E6',
  '#F4F4F5',
];

/** Look claro por defecto. */
export const DEFAULT_LIGHT_MODE_FORM: ThemeStudioModeForm = {
  primary: '#2563EB',
  accent: '#F59E0B',
  pageBg: '#F8FAFC',
  surfaceBg: '#FFFFFF',
  secondary: '#E2E8F0',
  textColor: '#111827',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#0284C7',
  shadow: 'soft',
  shadowColor: '#0F172A',
  shadowDirection: 'bottom',
  sidebar: 'light',
  header: 'solid',
  texture: 'none',
  textureColor1: '#F59E0B',
  textureColor2: '#2563EB',
};

/** Look oscuro por defecto: semilla editable con acentos aclarados para contraste AA. */
export const DEFAULT_DARK_MODE_FORM: ThemeStudioModeForm = {
  primary: '#5587EF',
  accent: '#F7AE32',
  pageBg: '#0B0F17',
  surfaceBg: '#1A1D25',
  secondary: '#6B7A93',
  textColor: '#F1F5F9',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#38BDF8',
  shadow: 'soft',
  shadowColor: '#000000',
  shadowDirection: 'bottom',
  sidebar: 'light',
  header: 'solid',
  texture: 'none',
  textureColor1: '#F7AE32',
  textureColor2: '#5587EF',
};

/** Variante de tabla del formulario cuando el tema no declara ninguna. */
export const DEFAULT_TABLE_VARIANT: SolTableVariant = 'zebra';

/** Estado inicial del formulario. */
export const DEFAULT_STUDIO_FORM: ThemeStudioForm = {
  displayFont: 'Space Grotesk',
  bodyFont: 'Inter',
  displayWeight: 'auto',
  displayTransform: 'auto',
  baseSize: 14,
  lineHeight: 1.5,
  radius: 12,
  button: 'rounded',
  input: 'outline',
  density: 'comfortable',
  border: 'hairline',
  intensity: 'subtle',
  reveal: 'rise',
  motionDuration: 'normal',
  overlayBlur: 'soft',
  shadowSize: 'md',
  authLayout: 'split-left',
  defaultMode: 'light',
  tableVariant: DEFAULT_TABLE_VARIANT,
  light: { ...DEFAULT_LIGHT_MODE_FORM },
  dark: { ...DEFAULT_DARK_MODE_FORM },
};

/** Copia profunda del formulario (los bloques por modo son objetos planos). */
export function cloneStudioForm(form: ThemeStudioForm): ThemeStudioForm {
  return { ...form, light: { ...form.light }, dark: { ...form.dark } };
}

// ─── Loader / spinner (sección opcional, `features.loader`) ─────────────────

/** Presentación del indicador de carga: como está hoy, centrado sin cortina o con cortina y blur. */
export type StudioLoaderPresentation = 'current' | 'centered' | 'backdrop';
export const STUDIO_LOADER_PRESENTATIONS: ReadonlyArray<StudioLoaderPresentation> = ['current', 'centered', 'backdrop'];

/** Animación del indicador de carga (giro, latido, sacudida o ninguna). */
export type StudioLoaderAnimation = 'spin' | 'pulse' | 'shake' | 'none';
export const STUDIO_LOADER_ANIMATIONS: ReadonlyArray<StudioLoaderAnimation> = ['spin', 'pulse', 'shake', 'none'];

/**
 * Configuración del indicador de carga que el host guarda en `meta.loader`. `image` es la URL
 * de una imagen subida por archivo; vacía, el host pinta un anillo con el color del tema.
 */
export interface ThemeLoaderConfig {
  image: string;
  presentation: StudioLoaderPresentation;
  animation: StudioLoaderAnimation;
}

export const DEFAULT_LOADER_CONFIG: ThemeLoaderConfig = {
  image: '',
  presentation: 'current',
  animation: 'spin',
};

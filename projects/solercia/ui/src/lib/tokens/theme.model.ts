/**
 * Modelo de tokens en 3 niveles (W3C DTCG-aligned): primitivos → semánticos → componente.
 * Los niveles VIVEN en esta fuente TS + `themes/default.theme.json` y se resuelven hacia
 * abajo (ver `resolveCssVars` en `theme.service.ts`) hacia el conjunto de variables
 * `--sol-*` de la `EMIT_TABLE`.
 *
 * ThemeFile v2 (E8 — skins white-label): todos los bloques nuevos son OPCIONALES (`?`).
 * Un ThemeFile v1 sigue siendo válido sin cambios: cada token v2 ausente emite su
 * default (el look del `default.json` actual). Ver `ThemeFile-v2-SPEC.md` del handoff.
 */

/** Referencia a un token, p. ej. `"{color.blue.600}"` (se resuelve contra `primitives`), o un literal. */
export type TokenRef = string;

/** Archivo completo de theming: metadatos + primitivos compartidos + configuración por modo. */
export interface ThemeFile {
  meta: ThemeMeta;
  primitives: ThemePrimitives;
  modes: {
    light: ThemeModeConfig;
    dark: ThemeModeConfig;
  };
}

/** Metadatos invariantes de modo (no se emiten como CSS vars). */
export interface ThemeMeta {
  tenant: string;
  logo: ThemeLogo;
  /** Frase de marca del tenant (login/onboarding). v2, opcional. */
  tagline?: string;
  /**
   * Fuentes web por tenant. v2, opcional. La URL de carga se construye SIEMPRE
   * por código a partir de `family` + `weights` (jamás una URL cruda del tenant).
   */
  fonts?: ThemeFont[];
}

/** Fuente web declarada por el tenant. Único proveedor permitido: Google Fonts (sanitizable por construcción). */
export interface ThemeFont {
  family: string;
  provider: 'google';
  weights: number[];
}

export interface ThemeLogo {
  url: string;
  /** Variante del logo para modo oscuro (opcional): un tenant sin `urlDark` usa `url` en ambos modos. */
  urlDark?: string;
  altText: string;
  width: number;
}

/** Nivel 1 — primitivos: paleta y escalas compartidas entre light y dark. */
export interface ThemePrimitives {
  color: Record<string, Record<string, string> | string>;
  font: {
    /** `display` (v2, opcional) es la tipografía de titulares; sin ella se usa `sans`. */
    family: { sans: string; mono: string; display?: string };
    size: { sm: string; base: string; lg: string; xl: string };
    weight: { normal: number; bold: number };
    lineHeight: { base: string };
  };
  radius: { sm: string; md: string; lg: string; full: string };
  space: { xs: string; sm: string; md: string; lg: string; xl: string };
  size: { control: { sm: string; md: string; lg: string } };
  z: Record<'1000' | '1050' | '1100', number>;
  borderWidth: { thin: string };
  /** Duraciones y curvas de movimiento. v2, opcional (defaults del look actual). */
  motion?: ThemeMotionPrimitives;
}

/** Primitivos de movimiento: duraciones ("120ms") y curvas (cubic-bezier). */
export interface ThemeMotionPrimitives {
  duration: { fast: string; base: string; slow: string };
  easing: { standard: string; entrance: string };
}

/** Configuración de un modo visual: capa semántica + capa de componente. */
export interface ThemeModeConfig {
  semantic: ThemeSemantic;
  component: ThemeComponent;
}

/** Nivel 2 — semánticos: referencian primitivos, la asignación cambia entre light/dark. */
export interface ThemeSemantic {
  color: Record<
    'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info',
    TokenRef
  >;
  text: Record<'primary' | 'secondary' | 'muted', TokenRef>;
  surface: {
    page: TokenRef;
    surface: TokenRef;
    overlay: TokenRef;
    /** Fondos rebajados (inputs filled, filas alternas). v2, opcional. */
    sunken?: TokenRef;
    /** background-image de la página: SOLO gradients o "none" (se sanitiza; jamás `url(`). v2, opcional. */
    texture?: string;
  };
  border: { color: TokenRef; width: TokenRef };
  layer: { dropdown: TokenRef; modal: TokenRef; tooltip: TokenRef };
  /** box-shadow es un string crudo por naturaleza — 2 niveles, sin primitivo sintético. */
  shadow: { sm: string; md: string; lg: string };
}

/** Nivel 3 — componente: tokens con consumidor puntual. Los bloques v2 son opcionales. */
export interface ThemeComponent {
  control: { inputHeight: TokenRef; buttonHeight: TokenRef };
  layout: { sidebarWidth: string; headerHeight: string };
  shadow: { card: string };
  /** Config de alertas — preservada por estabilidad de API aunque hoy no tiene consumidor. */
  alerts: ThemeAlerts;
  /** Carácter tipográfico de titulares y cifras. v2, opcional. */
  typography?: ThemeTypographyComponent;
  /** Forma de las cards (plana / elevada / glass). v2, opcional. */
  card?: ThemeCardComponent;
  /** Estilo de los inputs (filled / outline / underline). v2, opcional. */
  input?: ThemeInputComponent;
  /** Forma de los botones (pill / sharp / uppercase). v2, opcional. */
  button?: ThemeButtonComponent;
  /** Sidebar por tenant (puede ser oscuro aunque el modo sea light). v2, opcional. */
  sidebar?: ThemeSidebarComponent;
  /** Header translúcido/sólido. v2, opcional. */
  header?: ThemeHeaderComponent;
  /** Pantalla de login white-label. v2, opcional. */
  auth?: ThemeAuthComponent;
  /** Paleta categórica para series de gráficas. v2, opcional. */
  chart?: ThemeChartComponent;
  /** Movimiento (intensidad, estilo de entrada, press). v2, opcional. */
  motion?: ThemeMotionComponent;
  /** Fondo detrás de los diálogos (desenfoque del backdrop). v2, opcional. */
  overlay?: ThemeOverlayComponent;
  /** Preferencia responsive de data-tables (aditivo, nunca estructural). v2, opcional. */
  table?: ThemeTableComponent;
  /** Preferencia responsive del calendario (aditivo, nunca estructural). v2, opcional. */
  calendar?: ThemeCalendarComponent;
}

/**
 * Fondo detrás de un diálogo/modal. El color lo aporta `semantic.surface.overlay`;
 * este bloque añade el desenfoque (frosted glass) sobre lo que quede detrás.
 */
export interface ThemeOverlayComponent {
  /** backdrop-filter del fondo: "none" | "blur(3px)" | "blur(8px) saturate(1.2)". */
  blur: string;
}

export interface ThemeAlerts {
  borderRadius: string;
  showIcon: boolean;
  position: 'top-right' | 'top-center' | 'bottom-right';
  duration: number;
  /** Posición del toast en viewports angostos (default "top-center": tipo push bajo el header). v2, opcional. */
  positionMobile?: 'top-center' | 'top-right';
}

/** Carácter de titulares (h1/h2, valores de stat-card) y de cifras. */
export interface ThemeTypographyComponent {
  displayWeight: number;
  displayTracking: string;
  displayTransform: string;
  /** Familia para cifras (ej. mono = look técnico). Opcional. */
  numericFamily?: string;
}

/** Forma de las cards. `border` y sombras son shorthands CSS completos. */
export interface ThemeCardComponent {
  bg: TokenRef;
  /** Shorthand completo: "1px solid #DCE1EA" | "1px solid transparent". */
  border: string;
  radius: TokenRef;
  /** "none" para skins planos. */
  shadow: string;
  shadowHover: string;
  /** backdrop-filter: "none" | "blur(16px) saturate(1.4)". */
  blur: string;
  /** "0px" | "-4px". */
  hoverLift: string;
}

/** Estilo de los inputs. `variant` es documental; los tokens lo materializan. */
export interface ThemeInputComponent {
  variant: 'filled' | 'outline' | 'underline';
  bg: TokenRef;
  /** Shorthand completo. */
  border: string;
  radius: TokenRef;
  /** underline se implementa con inset box-shadow. */
  shadow: string;
  focusBorder: string;
  /** "0 0 0 4px rgba(...)". */
  focusRing: string;
}

/** Forma de los botones. */
export interface ThemeButtonComponent {
  /** "999px" pill | "4px" sharp. */
  radius: TokenRef;
  shadow: string;
  weight: number;
  /** "none" | "uppercase". */
  transform: string;
}

/** Sidebar por tenant. */
export interface ThemeSidebarComponent {
  /** Puede ser oscuro aunque el modo sea light. */
  bg: TokenRef;
  text: TokenRef;
  activeBg: string;
  activeText: TokenRef;
  itemRadius: TokenRef;
  /** box-shadow inset para barra de acento, o "none". */
  indicator: string;
}

/** Header de la aplicación. */
export interface ThemeHeaderComponent {
  /** rgba para efecto translúcido. */
  bg: string;
  blur: string;
}

/** Pantalla de login. `layout` NO es token: lo lee el template del login. */
export interface ThemeAuthComponent {
  layout: 'split-left' | 'split-right' | 'centered';
  /** Fondo del panel hero (o glow de página en centered) — SOLO gradients (se sanitiza). */
  heroBg: string;
}

/** Paleta para series de gráficas (3-6 colores; se rellena/recorta a 6 al emitir). */
export interface ThemeChartComponent {
  palette: string[];
}

/** Movimiento del tema. `intensity` multiplica duraciones y revealDistance al emitir. */
export interface ThemeMotionComponent {
  /** `smooth` (v2.1) = multiplicador 1.0 (movimiento natural sin exagerar). */
  intensity: 'none' | 'subtle' | 'smooth' | 'expressive';
  /** Animación de entrada: subir / solo fade / escala con rebote / deslizar / zoom. */
  revealStyle: 'rise' | 'fade' | 'pop' | 'slide' | 'zoom';
  /** "8px" | "26px". */
  revealDistance: string;
  /** 0.99 | 0.97. */
  pressScale: number;
}

/** Preferencia responsive de data-tables. Default "collapse" (filas colapsables, sin scroll horizontal). */
export interface ThemeTableComponent {
  mobile: 'collapse' | 'scroll';
}

/** Preferencia responsive del calendario. Default 5 (lunes–viernes). */
export interface ThemeCalendarComponent {
  mobileDays: 5 | 7;
}

/**
 * Shape of the `meta.login` block of a `ThemeFile`: photos, motion and composition of the sign-in
 * screen. It lives in `meta` (opaque to the token resolver), so a theme without it renders exactly
 * as before and the host decides whether to use it.
 */
export type LoginEffect = 'zoom' | 'focus' | 'none';
export type LoginTransition = 'fade' | 'focus';
export type LoginPosition = 'left' | 'right' | 'center';
export type LoginBackground = 'glass-fade' | 'glass' | 'solid' | 'triangles' | 'split-circle' | 'facets' | 'circles';
export type LoginCaptionPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
export type LoginMode = 'light' | 'dark';

/** Gradient that covers the photo behind the form. `rgb` is a `r,g,b` triple; the rest are 0-1. */
export interface ThemeLoginVeil {
  rgb?: string;
  from?: number;
  to?: number;
  bottom?: number;
}

/** Translucent panel behind the form (rectangular backgrounds only). */
export interface ThemeLoginPanel {
  bg?: string;
  blur?: string;
  saturate?: number;
  border?: string;
  radius?: string;
}

export interface ThemeLoginModeConfig {
  position?: LoginPosition;
  background?: LoginBackground;
  captionPosition?: LoginCaptionPosition;
  veil?: ThemeLoginVeil;
  panel?: ThemeLoginPanel;
}

export interface ThemeLoginCaption {
  /** Small label above the tagline (for example, the product name). */
  label?: string;
  /** Photo indicators next to the caption. */
  indicators?: boolean;
}

export interface ThemeLogin {
  images?: string[];
  intervalMs?: number;
  effect?: LoginEffect;
  transition?: LoginTransition;
  caption?: ThemeLoginCaption;
  modes?: Partial<Record<LoginMode, ThemeLoginModeConfig>>;
}

/** Logo as a host may publish it before sign-in (already sanitized by `normalizeLoginAppearance`). */
export interface LoginLogo {
  url: string;
  urlDark: string | null;
  altText: string;
}

/**
 * Appearance a host can serve anonymously (before sign-in the full theme is usually private).
 * The library makes no HTTP call: the host fetches it from its own endpoint and normalizes it.
 */
export interface PublishedLoginAppearance {
  login: ThemeLogin | null;
  logo: LoginLogo | null;
  /** `meta.defaultMode` of the tenant: without a session it is the only way to know the mode. */
  mode?: LoginMode | null;
}

/** Everything the screen needs to paint itself, already resolved for the active mode. */
export interface LoginView {
  readonly images: readonly string[];
  readonly intervalMs: number;
  readonly effect: LoginEffect;
  readonly transition: LoginTransition;
  readonly label: string | null;
  readonly indicators: boolean;
  readonly position: LoginPosition;
  readonly background: LoginBackground;
  readonly captionPosition: LoginCaptionPosition;
  readonly variables: Readonly<Record<string, string>>;
}

export const LOGIN_EFFECTS: readonly LoginEffect[] = ['zoom', 'focus', 'none'];
export const LOGIN_TRANSITIONS: readonly LoginTransition[] = ['fade', 'focus'];
export const LOGIN_POSITIONS: readonly LoginPosition[] = ['left', 'center', 'right'];
export const LOGIN_BACKGROUNDS: readonly LoginBackground[] = [
  'glass-fade',
  'glass',
  'solid',
  'triangles',
  'split-circle',
  'facets',
  'circles',
];
export const LOGIN_CAPTION_POSITIONS: readonly LoginCaptionPosition[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];

export const LOGIN_MAX_IMAGES = 12;
export const LOGIN_INTERVAL_MIN_MS = 3000;
export const LOGIN_INTERVAL_MAX_MS = 20000;
export const LOGIN_INTERVAL_DEFAULT_MS = 7000;
export const LOGIN_DEFAULT_EFFECT: LoginEffect = 'zoom';
export const LOGIN_DEFAULT_TRANSITION: LoginTransition = 'fade';
export const LOGIN_DEFAULT_POSITION: LoginPosition = 'right';
export const LOGIN_DEFAULT_BACKGROUND: LoginBackground = 'glass-fade';

/** Backgrounds whose shape is the form container; the others use a rectangular panel. */
export const LOGIN_SHAPE_BACKGROUNDS: readonly LoginBackground[] = ['triangles', 'split-circle', 'facets', 'circles'];
export const hasLoginShapes = (background: LoginBackground): boolean => LOGIN_SHAPE_BACKGROUNDS.includes(background);

/**
 * Full shape of the block for the Theme Studio importer (`metaExtrasSchema`): the importer rejects
 * any key missing from its reference, so a bare `login: {}` would reject every theme with `login`.
 */
const MODE_SCHEMA: Required<ThemeLoginModeConfig> = {
  position: '' as LoginPosition,
  background: '' as LoginBackground,
  captionPosition: '' as LoginCaptionPosition,
  veil: { rgb: '', from: 0, to: 0, bottom: 0 },
  panel: { bg: '', blur: '', saturate: 0, border: '', radius: '' },
};

export const LOGIN_META_SCHEMA: ThemeLogin = {
  images: [''],
  intervalMs: 0,
  effect: '' as LoginEffect,
  transition: '' as LoginTransition,
  caption: { label: '', indicators: true },
  modes: { dark: MODE_SCHEMA, light: MODE_SCHEMA },
};

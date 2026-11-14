import {
  LOGIN_BACKGROUNDS,
  LOGIN_CAPTION_POSITIONS,
  LOGIN_DEFAULT_BACKGROUND,
  LOGIN_DEFAULT_EFFECT,
  LOGIN_DEFAULT_POSITION,
  LOGIN_DEFAULT_TRANSITION,
  LOGIN_EFFECTS,
  LOGIN_INTERVAL_DEFAULT_MS,
  LOGIN_INTERVAL_MAX_MS,
  LOGIN_INTERVAL_MIN_MS,
  LOGIN_MAX_IMAGES,
  LOGIN_POSITIONS,
  LOGIN_TRANSITIONS,
  type LoginBackground,
  type LoginCaptionPosition,
  type LoginLogo,
  type LoginMode,
  type LoginPosition,
  type LoginView,
  type PublishedLoginAppearance,
  type ThemeLogin,
  type ThemeLoginCaption,
  type ThemeLoginModeConfig,
  type ThemeLoginPanel,
  type ThemeLoginVeil,
} from '../model/login-appearance.model';

/**
 * Everything that arrives through `meta.login` (or a host's anonymous appearance endpoint) goes
 * through here before it reaches a CSS variable or an `src`: an imported theme is JSON written by a
 * person, not trusted data. Closed values fall back to their default; free values are bounded.
 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA_COLOR = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/;
const PIXELS = /^(\d{1,2})px$/;
const BORDER = /^(\d)px solid (.+)$/;
const RGB_TRIPLE = /^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/;
const MAX_BLUR_PX = 60;
const MAX_RADIUS_PX = 32;
const MAX_BORDER_PX = 4;
const MAX_LABEL = 80;
const MAX_URL_LENGTH = 2048;

/**
 * Photo URLs: `https://`, a root-relative path (`/…`, never `//`) or `assets/…`, ending in a raster
 * image extension (optional query string). No quotes, parentheses, spaces or `..`.
 */
const IMAGE_URL = /^(?:https:\/\/[^/\s]|\/(?!\/)|assets\/)[^\s"'<>()\\]*\.(?:png|jpe?g|webp|avif)(?:\?[^\s"'<>()\\#]*)?$/i;
const SAFE_LOGO_URL = /^(?:\/(?!\/)|assets\/|https:\/\/)[^\s<>"'()\\]+$/;

const DEFAULT_VEIL: Record<LoginMode, Required<ThemeLoginVeil>> = {
  dark: { rgb: '15,23,42', from: 0.12, to: 0.94, bottom: 0.7 },
  light: { rgb: '248,250,252', from: 0.12, to: 0.86, bottom: 0.55 },
};

const DEFAULT_PANEL: Record<LoginMode, Required<ThemeLoginPanel>> = {
  dark: {
    bg: 'color-mix(in srgb, var(--sol-bg-surface) 42%, transparent)',
    blur: '34px',
    saturate: 1.3,
    border: '1px solid color-mix(in srgb, var(--sol-color-text-primary) 10%, transparent)',
    radius: '12px',
  },
  light: {
    bg: 'color-mix(in srgb, var(--sol-bg-surface) 48%, transparent)',
    blur: '42px',
    saturate: 1.5,
    border: '1px solid color-mix(in srgb, var(--sol-bg-surface) 80%, transparent)',
    radius: '12px',
  },
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function bounded(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;
}

function cssColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (HEX_COLOR.test(value)) return value;
  const rgba = RGBA_COLOR.exec(value);
  if (!rgba || [rgba[1], rgba[2], rgba[3]].some(c => Number(c) > 255)) return undefined;
  return rgba[4] === undefined || Number(rgba[4]) <= 1 ? value : undefined;
}

function cssPixels(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const px = PIXELS.exec(value);
  return px && Number(px[1]) <= max ? value : undefined;
}

function cssBorder(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const border = BORDER.exec(value);
  return border && Number(border[1]) <= MAX_BORDER_PX && cssColor(border[2]) ? value : undefined;
}

/** Drops keys without a value; `undefined` when none is left. */
function withoutEmpty<T extends object>(obj: T): T | undefined {
  const filled = Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
  return Object.keys(filled).length > 0 ? filled : undefined;
}

/** `true` for a photo URL the login may paint (see `IMAGE_URL`). */
export function isAllowedLoginImage(url: unknown): url is string {
  return typeof url === 'string' && url.length <= MAX_URL_LENGTH && !url.includes('..') && IMAGE_URL.test(url);
}

function normalizeVeil(raw: unknown): ThemeLoginVeil | undefined {
  if (!isRecord(raw)) return undefined;
  const rgb = typeof raw['rgb'] === 'string' ? RGB_TRIPLE.exec(raw['rgb']) : null;
  const valid = rgb && [rgb[1], rgb[2], rgb[3]].every(c => Number(c) <= 255);
  return withoutEmpty({
    rgb: valid ? `${rgb[1]},${rgb[2]},${rgb[3]}` : undefined,
    from: bounded(raw['from'], 0, 1),
    to: bounded(raw['to'], 0, 1),
    bottom: bounded(raw['bottom'], 0, 1),
  });
}

function normalizePanel(raw: unknown): ThemeLoginPanel | undefined {
  if (!isRecord(raw)) return undefined;
  return withoutEmpty({
    bg: cssColor(raw['bg']),
    blur: cssPixels(raw['blur'], MAX_BLUR_PX),
    saturate: bounded(raw['saturate'], 0, 3),
    border: cssBorder(raw['border']),
    radius: cssPixels(raw['radius'], MAX_RADIUS_PX),
  });
}

function normalizeMode(raw: unknown): ThemeLoginModeConfig | undefined {
  if (!isRecord(raw)) return undefined;
  const veil = normalizeVeil(raw['veil']);
  const panel = normalizePanel(raw['panel']);
  const captionPosition = oneOf(raw['captionPosition'], LOGIN_CAPTION_POSITIONS);
  return {
    position: oneOf(raw['position'], LOGIN_POSITIONS) ?? LOGIN_DEFAULT_POSITION,
    background: oneOf(raw['background'], LOGIN_BACKGROUNDS) ?? LOGIN_DEFAULT_BACKGROUND,
    ...(captionPosition ? { captionPosition } : {}),
    ...(veil ? { veil } : {}),
    ...(panel ? { panel } : {}),
  };
}

function normalizeImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isAllowedLoginImage))].slice(0, LOGIN_MAX_IMAGES);
}

function normalizeInterval(raw: unknown): number {
  const interval = bounded(raw, LOGIN_INTERVAL_MIN_MS, LOGIN_INTERVAL_MAX_MS);
  return interval === undefined ? LOGIN_INTERVAL_DEFAULT_MS : Math.round(interval);
}

function normalizeCaption(raw: unknown): ThemeLoginCaption | undefined {
  if (!isRecord(raw)) return undefined;
  const label = typeof raw['label'] === 'string' ? raw['label'].trim().slice(0, MAX_LABEL) : '';
  return withoutEmpty({
    label: label || undefined,
    indicators: typeof raw['indicators'] === 'boolean' ? raw['indicators'] : undefined,
  });
}

/** Closed and bounded values; anything unrecognized is dropped or takes its default. */
export function normalizeLogin(raw: unknown): ThemeLogin | null {
  if (!isRecord(raw)) return null;
  const modes = isRecord(raw['modes']) ? raw['modes'] : {};
  const dark = normalizeMode(modes['dark']);
  const light = normalizeMode(modes['light']);
  const caption = normalizeCaption(raw['caption']);
  return {
    images: normalizeImages(raw['images']),
    intervalMs: normalizeInterval(raw['intervalMs']),
    effect: oneOf(raw['effect'], LOGIN_EFFECTS) ?? LOGIN_DEFAULT_EFFECT,
    transition: oneOf(raw['transition'], LOGIN_TRANSITIONS) ?? LOGIN_DEFAULT_TRANSITION,
    ...(caption ? { caption } : {}),
    modes: { ...(dark ? { dark } : {}), ...(light ? { light } : {}) },
  };
}

function normalizeLogo(raw: unknown): LoginLogo | null {
  if (!isRecord(raw) || typeof raw['url'] !== 'string' || !SAFE_LOGO_URL.test(raw['url'])) return null;
  const dark = raw['urlDark'];
  return {
    url: raw['url'],
    urlDark: typeof dark === 'string' && SAFE_LOGO_URL.test(dark) ? dark : null,
    altText: typeof raw['altText'] === 'string' ? raw['altText'].trim() : '',
  };
}

/**
 * Body a host serves before sign-in (`{ login, logo, mode }`); `null` when it carries nothing
 * usable. The library never fetches it: the host calls its own endpoint and passes the body here.
 */
export function normalizeLoginAppearance(raw: unknown): PublishedLoginAppearance | null {
  if (!isRecord(raw)) return null;
  const login = normalizeLogin(raw['login']);
  const logo = normalizeLogo(raw['logo']);
  const mode = raw['mode'] === 'light' || raw['mode'] === 'dark' ? raw['mode'] : null;
  return login || logo || mode ? { login, logo, mode } : null;
}

/** The caption never shares a side with the form: the JSON may carry a combination that covers it. */
function captionClear(position: LoginPosition, caption: LoginCaptionPosition | undefined): LoginCaptionPosition {
  const opposite = position === 'left' ? 'right' : 'left';
  if (!caption) return `bottom-${opposite}`;
  if (position === 'center') return caption;
  const [vertical, side] = caption.split('-');
  return (side === position ? `${vertical}-${opposite}` : caption) as LoginCaptionPosition;
}

/** Form margin towards its edge, per shape (% of the width). */
const SHAPE_MARGIN: Partial<Record<LoginBackground, string>> = {
  triangles: 'clamp(24px, 11.7%, 200px)',
  'split-circle': 'clamp(24px, 8.75%, 200px)',
  facets: 'clamp(24px, 11.7%, 200px)',
  circles: 'clamp(24px, 12.5%, 200px)',
};

/**
 * The caption sits on the photo in both modes over its own darkening veil, so in light mode it is
 * still light text. In dark mode it follows the theme tokens.
 */
const CAPTION_BY_MODE: Record<LoginMode, Record<string, string>> = {
  light: {
    '--sol-auth-caption-rgb': '15,23,42',
    '--sol-auth-caption-reach': '30%',
    '--sol-auth-caption-color': '#FFFFFF',
    '--sol-auth-caption-label': '#FFFFFF',
    '--sol-auth-caption-label-opacity': '0.85',
  },
  dark: {
    '--sol-auth-caption-rgb': '2,6,23',
    '--sol-auth-caption-reach': '38%',
    '--sol-auth-caption-color': 'var(--sol-color-text-primary)',
    '--sol-auth-caption-label': 'var(--sol-color-secondary)',
    '--sol-auth-caption-label-opacity': '1',
  },
};

function modeVariables(mode: LoginMode, config: ThemeLoginModeConfig | undefined): Record<string, string> {
  const veil = { ...DEFAULT_VEIL[mode], ...config?.veil };
  const panel = { ...DEFAULT_PANEL[mode], ...config?.panel };
  const margin = SHAPE_MARGIN[config?.background ?? LOGIN_DEFAULT_BACKGROUND];
  return {
    ...(margin ? { '--sol-auth-shape-margin': margin } : {}),
    ...(mode === 'dark'
      ? {
          '--sol-input-bg': 'color-mix(in srgb, var(--sol-color-text-primary) 6%, transparent)',
          '--sol-input-border': '1px solid color-mix(in srgb, var(--sol-color-text-primary) 16%, transparent)',
        }
      : {}),
    '--sol-auth-veil-rgb': veil.rgb,
    '--sol-auth-veil-from': String(veil.from),
    '--sol-auth-veil-to': String(veil.to),
    '--sol-auth-veil-bottom': String(veil.bottom),
    ...CAPTION_BY_MODE[mode],
    '--sol-auth-panel-bg': panel.bg,
    '--sol-auth-panel-filter': `blur(${panel.blur}) saturate(${panel.saturate})`,
    '--sol-auth-panel-border': panel.border,
    '--sol-auth-panel-radius': panel.radius,
    // Secondary theme tones lack contrast on a translucent surface; a firmer border keeps checkboxes
    // and fields distinguishable from the card.
    '--sol-color-text-secondary': 'color-mix(in srgb, var(--sol-color-text-primary) 74%, var(--sol-bg-surface))',
    '--sol-color-text-muted': 'color-mix(in srgb, var(--sol-color-text-primary) 74%, var(--sol-bg-surface))',
    '--sol-border-color-default': 'color-mix(in srgb, var(--sol-color-text-primary) 45%, var(--sol-bg-surface))',
  };
}

/** Resolves a normalized `meta.login` for one mode. `images` are the photos to paint (non-empty). */
export function buildLoginView(login: ThemeLogin | null, images: readonly string[], dark: boolean): LoginView {
  const mode: LoginMode = dark ? 'dark' : 'light';
  const config = login?.modes?.[mode];
  const position = config?.position ?? LOGIN_DEFAULT_POSITION;
  return {
    images,
    intervalMs: login?.intervalMs ?? LOGIN_INTERVAL_DEFAULT_MS,
    effect: login?.effect ?? LOGIN_DEFAULT_EFFECT,
    transition: login?.transition ?? LOGIN_DEFAULT_TRANSITION,
    label: login?.caption?.label ?? null,
    indicators: login?.caption?.indicators ?? true,
    position,
    background: config?.background ?? LOGIN_DEFAULT_BACKGROUND,
    captionPosition: captionClear(position, config?.captionPosition),
    variables: modeVariables(mode, config),
  };
}

export interface LoginAppearanceSources {
  /** `login` already normalized from the host's anonymous endpoint (`normalizeLoginAppearance`). */
  published: ThemeLogin | null;
  /** `meta.login` of the active theme, raw from the JSON. */
  theme: unknown;
  /** Host fallback photos (for example, bundled ones) used when no source brings its own. */
  fallbackImages?: readonly string[];
}

/**
 * Precedence: published appearance → theme `meta.login` → fallback photos → classic layout (`null`).
 * Photos resolve separately: a configuration without photos keeps its motion and composition but
 * takes the photos of the next source that has them.
 */
export function resolveLoginView(sources: LoginAppearanceSources, dark: boolean): LoginView | null {
  const theme = normalizeLogin(sources.theme);
  const login = sources.published ?? theme;
  const fallback = (sources.fallbackImages ?? []).filter(isAllowedLoginImage);
  const images = [sources.published?.images, theme?.images, fallback].find(list => list && list.length > 0);
  return images ? buildLoginView(login, images, dark) : null;
}

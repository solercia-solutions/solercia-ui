import {
  SOL_BUNDLED_DEFAULT_THEME,
  SOL_TABLE_VARIANTS,
  isRenderableTheme,
  type ThemeFile,
} from '@solercia/ui';
import { buildThemeFile } from './theme-builder';
import { deepMerge } from './deep-merge';
import {
  DEFAULT_STUDIO_FORM,
  STUDIO_LOADER_ANIMATIONS,
  STUDIO_LOADER_PRESENTATIONS,
} from '../model/theme-studio-form.model';

/** Tope del archivo JSON importado (bytes UTF-8). */
export const MAX_THEME_JSON_BYTES = 256 * 1024;

/** Profundidad máxima de anidación aceptada. */
const MAX_DEPTH = 20;
/** Longitud máxima de un arreglo y de un string. */
const MAX_ARRAY_LENGTH = 40;
const MAX_STRING_LENGTH = 2048;

/**
 * Códigos de error del importador. La UI los traduce con `SOL_I18N`
 * (`sol.themeStudio.import.error.<código>`); el mensaje técnico de la excepción no se muestra.
 * - `too-large`: el archivo supera `MAX_THEME_JSON_BYTES`.
 * - `invalid-json`: el texto no es JSON.
 * - `invalid-structure`: falta un bloque obligatorio, el tipo no coincide o se excede un límite.
 * - `unsupported-key`: clave que el contrato no declara.
 * - `unsafe-key`: `__proto__`, `prototype` o `constructor`.
 * - `unsafe-value`: string con `url(`, `javascript:`, `@import`, `expression(`, marcado o una
 *   URL de asset que no es https ni relativa.
 * - `invalid-value`: valor fuera de su dominio (modo, variante de tabla, hex, número).
 * - `not-renderable`: el tema no resuelve todas sus variables en ambos modos.
 */
export type ThemeImportErrorCode =
  | 'too-large'
  | 'invalid-json'
  | 'invalid-structure'
  | 'unsupported-key'
  | 'unsafe-key'
  | 'unsafe-value'
  | 'invalid-value'
  | 'not-renderable';

/**
 * Error tipado del importador: `code` para traducir, `path` para diagnóstico.
 *
 * `pathVisible` indica que la ruta señala el campo exacto que hay que corregir (clave no
 * admitida, clave prohibida, color de marca o contraste inválido) y por eso la pantalla la
 * muestra a la persona usuaria; en los demás casos la ruta queda solo para diagnóstico.
 */
export class ThemeImportError extends Error {
  constructor(
    readonly code: ThemeImportErrorCode,
    readonly path?: string,
    readonly pathVisible = false,
  ) {
    super(path ? `${code} at ${path}` : code);
    this.name = 'ThemeImportError';
  }
}

/** Opciones de `parseThemeJson`. */
export interface ParseThemeJsonOptions {
  /**
   * Forma de referencia de los campos opacos que el host guarda en `meta` (los mismos que pasa
   * como `metaExtras` al builder). Cada clave declarada aquí se acepta en `meta` con el mismo
   * tipo y la misma estructura que el valor de referencia.
   */
  metaExtras?: Readonly<Record<string, unknown>>;
  /**
   * Forma de referencia de campos opacos de `meta` que el host PRESERVA pero no escribe (por
   * ejemplo, comportamiento del menú lateral). Se aceptan al importar con el mismo tipo y la
   * misma estructura que el valor de referencia.
   */
  metaExtrasSchema?: Readonly<Record<string, unknown>>;
  /** Acepta y valida `meta.loader` (sección opcional del indicador de carga). */
  loader?: boolean;
  /** Clave de `meta` donde el host refleja la variante de tabla (se valida contra las variantes). */
  tableVariantMetaKey?: string;
}

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'prototype', 'constructor']);
const HEX_ANY = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
 
const UNSAFE_STRING = /[\u0000-\u001f<>\\]|javascript:|expression\s*\(|@import|url\s*\(/i;
const ASSET_URL_FIELD = /\.(url|urlDark|favicon|image)$/;
const SAFE_ASSET_URL = /^(https:\/\/|\/(?!\/))[^\s]+$/i;
const BRAND_COLOR_KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

type Plain = Record<string, unknown>;
const isPlain = (value: unknown): value is Plain =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Valida y devuelve el `ThemeFile` de un archivo JSON ANTES de cualquier fusión, vista previa,
 * petición de red o cambio del editor. Nunca muta `current`.
 *
 * La estructura se contrasta contra una referencia: el tema que produce el builder sobre el
 * tema empaquetado, fusionado con `current` (así se aceptan los campos v2 que el tema activo ya
 * usa) y con los opcionales del contrato. Los colores de marca extra
 * (`primitives.color.brand.*`) son extensibles, pero solo como literales hex.
 *
 * @throws ThemeImportError con un `code` traducible.
 */
export function parseThemeJson(
  text: string,
  current: ThemeFile,
  options: ParseThemeJsonOptions = {},
): ThemeFile {
  if (new TextEncoder().encode(text).byteLength > MAX_THEME_JSON_BYTES) {
    throw new ThemeImportError('too-large');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ThemeImportError('invalid-json');
  }
  if (!isPlain(parsed) || !isPlain(parsed['meta']) || !isPlain(parsed['primitives']) || !isPlain(parsed['modes'])) {
    throw new ThemeImportError('invalid-structure', 'theme');
  }

  check(parsed, buildReference(current, options), 'theme', 0);

  const meta = parsed['meta'];
  if (!isPlain(meta['logo']) || typeof meta['tenant'] !== 'string') {
    throw new ThemeImportError('invalid-structure', 'theme.meta');
  }
  for (const key of ['url', 'altText', 'width']) {
    if (!(key in meta['logo'])) throw new ThemeImportError('invalid-structure', `theme.meta.logo.${key}`);
  }
  if (meta['defaultMode'] !== undefined && meta['defaultMode'] !== 'light' && meta['defaultMode'] !== 'dark') {
    throw new ThemeImportError('invalid-value', 'theme.meta.defaultMode');
  }
  const variantKey = options.tableVariantMetaKey;
  if (variantKey && meta[variantKey] && !SOL_TABLE_VARIANTS.includes(meta[variantKey] as never)) {
    throw new ThemeImportError('invalid-value', `theme.meta.${variantKey}`);
  }
  if (options.loader && isPlain(meta['loader'])) {
    const loader = meta['loader'];
    if (
      !STUDIO_LOADER_PRESENTATIONS.includes(loader['presentation'] as never) ||
      !STUDIO_LOADER_ANIMATIONS.includes(loader['animation'] as never)
    ) {
      throw new ThemeImportError('invalid-value', 'theme.meta.loader');
    }
  }
  for (const mode of ['light', 'dark'] as const) {
    const table = readPath(parsed, ['modes', mode, 'component', 'table']);
    if (isPlain(table)) {
      if (table['variant'] !== undefined && !SOL_TABLE_VARIANTS.includes(table['variant'] as never)) {
        throw new ThemeImportError('invalid-value', `theme.modes.${mode}.component.table.variant`);
      }
      if (table['mobile'] !== undefined && table['mobile'] !== 'collapse' && table['mobile'] !== 'scroll') {
        throw new ThemeImportError('invalid-value', `theme.modes.${mode}.component.table.mobile`);
      }
    }
  }
  if (!isRenderableTheme(parsed as unknown as ThemeFile)) {
    throw new ThemeImportError('not-renderable');
  }
  return parsed as unknown as ThemeFile;
}

/** Referencia estructural: builder + tema activo + opcionales del contrato + extras del host. */
function buildReference(current: ThemeFile, options: ParseThemeJsonOptions): Plain {
  const reference = structuredClone(
    deepMerge(buildThemeFile(DEFAULT_STUDIO_FORM, SOL_BUNDLED_DEFAULT_THEME), current),
  ) as unknown as Plain;
  const meta = reference['meta'] as Plain;
  Object.assign(meta, {
    name: '',
    tagline: '',
    defaultMode: 'light',
    favicon: '',
    fonts: [{ family: 'Inter', provider: 'google', weights: [400] }],
    logo: { ...(meta['logo'] as Plain), urlDark: '' },
    ...(options.metaExtrasSchema ?? {}),
    ...(options.metaExtras ?? {}),
    ...(options.loader ? { loader: { image: '', presentation: '', animation: '' } } : {}),
    ...(options.tableVariantMetaKey ? { [options.tableVariantMetaKey]: '' } : {}),
  });
  const primitives = reference['primitives'] as Plain;
  ensure(primitives, ['size', 'control'], { touch: '' });
  ensure(primitives, ['font', 'size'], { touchInput: '' });
  ensure(primitives, ['font', 'family'], { display: '' });
  for (const mode of ['light', 'dark'] as const) {
    const config = (reference['modes'] as Plain)[mode] as Plain;
    ensure(config, ['semantic', 'color'], { primaryContrast: '', secondaryContrast: '' });
    ensure(config, ['semantic', 'surface'], { sunken: '', texture: '' });
    ensure(config, ['component', 'alerts'], { positionMobile: '' });
    ensure(config, ['component', 'typography'], { numericFamily: '' });
    ensure(config, ['component', 'table'], { mobile: '', variant: '' });
    ensure(config, ['component', 'calendar'], { mobileDays: 0 });
    ensure(config, ['component', 'overlay'], { blur: '' });
  }
  return reference;
}

/** Agrega a `root.path` las claves de `defaults` que todavía no existen. */
function ensure(root: Plain, path: ReadonlyArray<string>, defaults: Plain): void {
  let node = root;
  for (const key of path) {
    if (!isPlain(node[key])) node[key] = {};
    node = node[key] as Plain;
  }
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in node)) node[key] = value;
  }
}

function readPath(root: unknown, path: ReadonlyArray<string>): unknown {
  let node = root;
  for (const key of path) {
    if (!isPlain(node)) return undefined;
    node = node[key];
  }
  return node;
}

function check(value: unknown, reference: unknown, path: string, depth: number): void {
  if (depth > MAX_DEPTH) throw new ThemeImportError('invalid-structure', path);
  if (Array.isArray(value)) {
    if (!Array.isArray(reference) || value.length > MAX_ARRAY_LENGTH) {
      throw new ThemeImportError('invalid-structure', path);
    }
    // Los elementos comparten la ruta del arreglo: la ruta visible nombra el campo, no la posición.
    value.forEach(item => check(item, reference[0], path, depth + 1));
    return;
  }
  if (isPlain(value)) {
    if (!isPlain(reference)) throw new ThemeImportError('invalid-structure', path);
    for (const [key, item] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (FORBIDDEN_KEYS.has(key)) throw new ThemeImportError('unsafe-key', childPath, true);
      // Paleta de marca extensible: solo literales hex acotados, nunca objetos, URLs ni código.
      if (path === 'theme.primitives.color.brand' && !Object.hasOwn(reference, key)) {
        if (!BRAND_COLOR_KEY.test(key) || typeof item !== 'string' || !HEX_ANY.test(item)) {
          throw new ThemeImportError('invalid-value', childPath, true);
        }
        continue;
      }
      if (!Object.hasOwn(reference, key)) throw new ThemeImportError('unsupported-key', childPath, true);
      check(item, reference[key], childPath, depth + 1);
    }
    return;
  }
  if (value === null || typeof value !== typeof reference) {
    throw new ThemeImportError('invalid-structure', path);
  }
  if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 10000)) {
    throw new ThemeImportError('invalid-value', path);
  }
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH || UNSAFE_STRING.test(value)) {
      throw new ThemeImportError('unsafe-value', path);
    }
    if (ASSET_URL_FIELD.test(path) && value !== '' && !SAFE_ASSET_URL.test(value)) {
      throw new ThemeImportError('unsafe-value', path);
    }
    if (/\.semantic\.color\.(primaryContrast|secondaryContrast)$/.test(path) && !HEX_ANY.test(value)) {
      throw new ThemeImportError('invalid-value', path, true);
    }
  }
}

/**
 * Superpone los cambios del editor sobre un tema importado sin normalizarlo: si una rama del
 * resultado del editor no cambió (`before` === `after`), se conserva la del `original` tal cual.
 */
export function mergeThemeEditorChanges<T>(original: T, before: T, after: T): T {
  if (JSON.stringify(before) === JSON.stringify(after)) return original;
  if (!isPlain(before) || !isPlain(after) || !isPlain(original)) return after;
  const result: Plain = { ...original };
  for (const key of Object.keys(after)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    result[key] = mergeThemeEditorChanges(original[key], before[key], after[key]);
  }
  return result as T;
}

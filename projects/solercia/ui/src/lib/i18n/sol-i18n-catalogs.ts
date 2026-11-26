import { CATALOG_EN } from './catalog-en';
import { CATALOG_ES_CO } from './catalog-es-co';

/**
 * Internal catalog helpers (not exported from the public API). The JSON files in
 * `projects/solercia/ui/i18n/` are the catalogs shipped as package assets
 * (`@solercia/ui/i18n/*.json`); `catalog-*.ts` mirror them for the bundle (ng-packagr
 * cannot bundle JSON imports) and `sol-i18n.spec.ts` keeps both in sync.
 */

/** Nested translation catalog (`{ shared: { modal: { close: 'Close' } } }`). */
export interface SolI18nCatalog {
  readonly [key: string]: string | SolI18nCatalog;
}

export const BUNDLED_EN: SolI18nCatalog = CATALOG_EN;
export const BUNDLED_ES_CO: SolI18nCatalog = CATALOG_ES_CO;

/** Looks up a dotted key (`shared.modal.close`) in a nested catalog. */
export function lookupCatalog(catalog: SolI18nCatalog, key: string): string | undefined {
  let node: string | SolI18nCatalog | undefined = catalog;
  for (const segment of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(text: string, params?: Record<string, unknown>): string {
  if (!params) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Resolves a key against the bundled catalogs: `es*` languages read Colombian Spanish,
 * any other language reads English; a key missing there falls back to English.
 */
export function bundledText(lang: string, key: string, params?: Record<string, unknown>): string | undefined {
  const own = (lang ?? '').toLowerCase().startsWith('es') ? BUNDLED_ES_CO : BUNDLED_EN;
  const text = lookupCatalog(own, key) ?? lookupCatalog(BUNDLED_EN, key);
  return text === undefined ? undefined : interpolate(text, params);
}

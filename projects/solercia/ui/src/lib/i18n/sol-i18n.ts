import { InjectionToken, Signal, computed, signal } from '@angular/core';
import {
  BUNDLED_EN,
  BUNDLED_ES_CO,
  interpolate,
  lookupCatalog,
  type SolI18nCatalog,
} from './sol-i18n-catalogs';

export type { SolI18nCatalog } from './sol-i18n-catalogs';

/**
 * Minimal i18n contract consumed by the @solercia/ui components.
 *
 * The host application provides the implementation (Transloco, ngx-translate,
 * @angular/localize, or the built-in English default). This keeps the library
 * agnostic of any specific i18n engine — mirroring Angular Material's `*Intl`
 * services.
 */
export interface SolI18n {
  /** Active language as a reactive signal. */
  readonly activeLang: Signal<string>;

  /** Synchronous translation. Returns the key itself when it is missing. */
  translate(key: string, params?: Record<string, unknown>): string;

  /** Reactive translation: the returned signal recomputes when the language changes. */
  t(key: string, params?: Record<string, unknown>): Signal<string>;

  /** Translate several keys at once, in the same order. */
  tMany(keys: string[]): Signal<string[]>;
}

/** Bundled English catalog of every `shared.*` key (also shipped as `@solercia/ui/i18n/en.json`). */
export const SOL_I18N_EN: SolI18nCatalog = BUNDLED_EN;

/** Bundled Colombian Spanish catalog (also shipped as `@solercia/ui/i18n/es-CO.json`). */
export const SOL_I18N_ES_CO: SolI18nCatalog = BUNDLED_ES_CO;

/** `SolI18n` engine with a writable language, returned by {@link createSolI18n}. */
export interface SolCatalogI18n extends SolI18n {
  /** Switches the active language; every `t()`/`tMany()` signal recomputes. */
  setLang(lang: string): void;
}

/** Options of {@link createSolI18n}. */
export interface SolI18nOptions {
  /** Initial language (default `'en'`). */
  lang?: string;
  /** Catalogs by language code (default: the bundled `en` and `es-CO` catalogs). */
  catalogs?: Readonly<Record<string, SolI18nCatalog>>;
}

/**
 * Ready-to-use `SolI18n` engine backed by catalogs (by default the bundled English
 * and Colombian Spanish ones). The language is matched exactly, then by its base
 * (`es` ↔ `es-CO`); a key missing there falls back to the `en` catalog, then to the key.
 *
 * ```ts
 * { provide: SOL_I18N, useFactory: () => createSolI18n({ lang: 'es-CO' }) }
 * ```
 */
export function createSolI18n(options: SolI18nOptions = {}): SolCatalogI18n {
  const catalogs = options.catalogs ?? { en: SOL_I18N_EN, 'es-CO': SOL_I18N_ES_CO };
  const lang = signal(options.lang ?? 'en');
  const base = (code: string): string => code.toLowerCase().split('-')[0];
  const catalogFor = (active: string): SolI18nCatalog | undefined =>
    catalogs[active] ?? Object.entries(catalogs).find(([code]) => base(code) === base(active))?.[1];
  const translate = (key: string, params?: Record<string, unknown>): string => {
    const own = catalogFor(lang());
    const english = catalogs['en'];
    const text = (own && lookupCatalog(own, key)) ?? (english && lookupCatalog(english, key));
    return text === undefined ? key : interpolate(text, params);
  };
  return {
    activeLang: lang.asReadonly(),
    setLang: (next) => lang.set(next),
    translate,
    t: (key, params) => computed(() => translate(key, params)),
    tMany: (keys) => computed(() => keys.map((key) => translate(key))),
  };
}

/**
 * Identity engine: returns keys unchanged. The components still render English
 * texts with it, because every `shared.*` key falls back to the bundled catalogs.
 */
export function createIdentitySolI18n(): SolI18n {
  return {
    activeLang: signal('en'),
    translate: (key) => key,
    t: (key) => signal(key),
    tMany: (keys) => signal(keys),
  };
}

/**
 * Injection token for the i18n contract. Defaults to an English engine backed by
 * the bundled catalogs, so the library works out of the box; the host overrides it
 * with its own engine, or with `createSolI18n({ lang: 'es-CO' })` for Spanish.
 */
export const SOL_I18N = new InjectionToken<SolI18n>('SOL_I18N', {
  providedIn: 'root',
  factory: () => createSolI18n(),
});

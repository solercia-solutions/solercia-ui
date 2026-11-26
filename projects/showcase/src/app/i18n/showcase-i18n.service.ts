import { Injectable, Signal, computed, signal } from '@angular/core';
import { SOL_I18N_EN, SOL_I18N_ES_CO, type SolI18n } from '@solercia/ui';
import showcaseEn from './en.json';

export type ShowcaseLang = 'en' | 'es-CO';

type Catalog = Record<string, unknown>;

// The library ships its `shared.*` catalogs (SOL_I18N_EN / SOL_I18N_ES_CO, also as
// `@solercia/ui/i18n/*.json`); a host merges them with its own keys, as the showcase does here.
const CATALOGS: Record<ShowcaseLang, Catalog> = {
  en: { ...SOL_I18N_EN, ...(showcaseEn as Catalog) },
  'es-CO': { ...SOL_I18N_ES_CO },
};

function lookup(catalog: Catalog, key: string): string | undefined {
  let node: unknown = catalog;
  for (const segment of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(segment in node)) {
      return undefined;
    }
    node = (node as Catalog)[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(text: string, params?: Record<string, unknown>): string {
  if (!params) {
    return text;
  }
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Minimal `SolI18n` engine backed by two JSON catalogs. Showcase-only keys
 * (`showcase.*`) exist in English only, so Spanish falls back to English for them.
 * Production hosts usually bind Transloco or ngx-translate instead.
 */
@Injectable({ providedIn: 'root' })
export class ShowcaseI18nService implements SolI18n {
  private readonly lang = signal<ShowcaseLang>('en');
  readonly activeLang: Signal<string> = this.lang.asReadonly();

  setLang(lang: ShowcaseLang): void {
    this.lang.set(lang);
  }

  translate(key: string, params?: Record<string, unknown>): string {
    const text = lookup(CATALOGS[this.lang()], key) ?? lookup(CATALOGS.en, key) ?? key;
    return interpolate(text, params);
  }

  t(key: string, params?: Record<string, unknown>): Signal<string> {
    return computed(() => this.translate(key, params));
  }

  tMany(keys: string[]): Signal<string[]> {
    return computed(() => keys.map((key) => this.translate(key)));
  }
}

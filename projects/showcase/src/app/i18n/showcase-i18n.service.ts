import { Injectable, Signal, computed, signal } from '@angular/core';
import type { SolI18n } from '@solercia/ui';
import en from './en.json';
// The library ships its reference catalog in Colombian Spanish. A real host would keep
// its own copy; the showcase reads it straight from the library sources.
import esCO from '../../../../solercia/ui/i18n/es-CO.json';

export type ShowcaseLang = 'en' | 'es-CO';

type Catalog = Record<string, unknown>;

const CATALOGS: Record<ShowcaseLang, Catalog> = {
  en: en as Catalog,
  'es-CO': esCO as Catalog,
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

import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * Minimal i18n contract consumed by the @solercia/ui components.
 *
 * The host application provides the implementation (Transloco, ngx-translate,
 * @angular/localize, or the built-in identity default). This keeps the library
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

/**
 * Identity fallback used when the host does not provide an implementation.
 * Returns keys unchanged so components fall back to their built-in defaults.
 */
export function createIdentitySolI18n(): SolI18n {
  return {
    activeLang: signal('es-CO'),
    translate: (key) => key,
    t: (key) => signal(key),
    tMany: (keys) => signal(keys),
  };
}

/**
 * Injection token for the i18n contract. Defaults to the identity fallback so
 * the library works out of the box; the host overrides it with a real engine.
 */
export const SOL_I18N = new InjectionToken<SolI18n>('SOL_I18N', {
  providedIn: 'root',
  factory: createIdentitySolI18n,
});

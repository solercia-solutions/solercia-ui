import { Signal, computed, inject } from '@angular/core';
import { SOL_I18N, type SolI18n } from './sol-i18n';
import { bundledText } from './sol-i18n-catalogs';

/**
 * Internal (not exported): wraps the host `SolI18n` so a key the host does not
 * translate (the engine returns the key unchanged) falls back to the bundled
 * catalog of the active language — `es*` → Colombian Spanish, otherwise English.
 * Keys outside the bundled catalogs (host keys such as `step.labelKey`) are
 * returned exactly as the host engine returned them.
 */
export function withBundledFallback(host: SolI18n): SolI18n {
  const resolve = (key: string, translated: string, params?: Record<string, unknown>): string =>
    translated && translated !== key ? translated : (bundledText(host.activeLang(), key, params) ?? translated);

  return {
    activeLang: host.activeLang,
    translate: (key, params) => resolve(key, host.translate(key, params), params),
    t: (key, params): Signal<string> => {
      const source = host.t(key, params);
      return computed(() => resolve(key, source(), params));
    },
    tMany: (keys): Signal<string[]> => {
      const source = host.tMany(keys);
      return computed(() => source().map((value, index) => resolve(keys[index], value)));
    },
  };
}

/** Injects `SOL_I18N` with the bundled-catalog fallback (call in an injection context). */
export function injectSolI18n(): SolI18n {
  return withBundledFallback(inject(SOL_I18N));
}

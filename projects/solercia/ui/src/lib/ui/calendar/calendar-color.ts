import { InjectionToken } from '@angular/core';
import type { SolCalendarEvent, StateColorSet } from './calendar.model';

/**
 * Puerto de resolución de color por evento (spec#Resolución de color por
 * Strategy inyectable — D3 del design, mismo patrón que `THEME_SOURCE`/
 * `SOL_I18N`). La librería NUNCA hardcodea una paleta de dominio (p. ej. la
 * paleta de 6 estados de cita) — el consumidor inyecta su propia estrategia
 * cuando necesita colorear por una regla de negocio.
 */
export interface SolCalendarColorStrategy {
  resolve(event: SolCalendarEvent, isDark: boolean): StateColorSet;
}

/** Superficie neutra por tokens — fallback compartido por el default null-object (sin `color`/`color` no seguro) y por `sol-calendar-grid` cuando una Strategy inyectada lanza (corrección 4R WARNING — resilience). */
export const NEUTRAL_CALENDAR_COLOR: StateColorSet = {
  bg: 'var(--sol-bg-sunken, var(--sol-bg-page, #f1f5f9))',
  border: 'var(--sol-border-color-default, #cbd5e1)',
  text: 'var(--sol-color-text-primary, #0f172a)',
};

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const FUNCTIONAL_COLOR = /^(rgb|hsl)a?\(/i;
const CSS_VAR = /^var\(--/;

/**
 * Whitelist estricta de formas CSS seguras para interpolar en
 * `color-mix()`/`[style]` (corrección 4R WARNING — risk, re-gate PR6):
 * hex (`#rgb`/`#rrggbb`/`#rrggbbaa`), notación funcional (`rgb()`/`rgba()`/
 * `hsl()`/`hsla()`) o referencia a token (`var(--sol-*)`). Cualquier otro
 * valor (p. ej. `url(...)`, `image-set(...)`, `expression(...)`) se
 * rechaza — `background`/`border`/`color` son propiedades shorthand que
 * ACEPTAN `url(...)`, así que un `color` de baja confianza (config de
 * tenant futura, dato de un consumidor no confiable) podría disparar una
 * petición de red ("CSS beacon") si se interpolara sin validar. NO acepta
 * nombres de color (`red`, `blue`) a propósito — whitelist mínima, no
 * exhaustiva.
 */
export function isSafeCssColor(value: string): boolean {
  return HEX_COLOR.test(value) || FUNCTIONAL_COLOR.test(value) || CSS_VAR.test(value);
}

/**
 * Default null-object (D3): si el evento trae `color` explícito Y SEGURO
 * (`isSafeCssColor`), deriva `{bg,border,text}` con `color-mix()` sobre
 * tokens `var(--sol-*)` — el `color` es la única fuente de verdad, sin
 * paleta hardcodeada. Sin `color` (ausente, no-string, o que no pase la
 * whitelist de seguridad), usa una superficie neutra (también por tokens).
 * Tolera `event` inválido o `color` no-string (lección PR3/PR4/PR5:
 * `typeof` antes de usar un campo que podría no ser el tipo esperado en
 * runtime).
 */
class DefaultCalendarColorStrategy implements SolCalendarColorStrategy {
  resolve(event: SolCalendarEvent | null | undefined, isDark: boolean): StateColorSet {
    const raw = event && typeof event.color === 'string' && event.color ? event.color : null;
    const color = raw && isSafeCssColor(raw) ? raw : null;

    if (!color) {
      return NEUTRAL_CALENDAR_COLOR;
    }

    return {
      bg: `color-mix(in srgb, ${color} ${isDark ? '35%' : '15%'}, var(--sol-bg-surface, #ffffff))`,
      border: color,
      text: isDark
        ? `color-mix(in srgb, ${color} 70%, white)`
        : `color-mix(in srgb, ${color} 70%, black)`,
    };
  }
}

/**
 * Token de inyección del puerto de color. Default: `DefaultCalendarColorStrategy`
 * (null-object) — la librería funciona "de fábrica" sin que el consumidor
 * provea nada; un consumidor con reglas de dominio (p. ej. la paleta de 6
 * estados de cita) provee su propia implementación vía
 * `{ provide: SOL_CALENDAR_COLOR, useClass/useValue: ... }`.
 */
export const SOL_CALENDAR_COLOR = new InjectionToken<SolCalendarColorStrategy>('SOL_CALENDAR_COLOR', {
  providedIn: 'root',
  factory: () => new DefaultCalendarColorStrategy(),
});

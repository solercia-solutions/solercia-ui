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

/**
 * Default null-object (D3): si el evento trae `color` explícito, deriva
 * `{bg,border,text}` con `color-mix()` sobre tokens `var(--sol-*)` — el
 * `color` es la única fuente de verdad, sin paleta hardcodeada. Sin `color`,
 * usa una superficie neutra (también por tokens). Tolera `event` inválido o
 * `color` no-string (lección PR3/PR4/PR5: `typeof` antes de usar un campo
 * que podría no ser el tipo esperado en runtime).
 */
class DefaultCalendarColorStrategy implements SolCalendarColorStrategy {
  resolve(event: SolCalendarEvent | null | undefined, isDark: boolean): StateColorSet {
    const color = event && typeof event.color === 'string' && event.color ? event.color : null;

    if (!color) {
      return {
        bg: 'var(--sol-bg-sunken, var(--sol-bg-page, #f1f5f9))',
        border: 'var(--sol-border-color-default, #cbd5e1)',
        text: 'var(--sol-color-text-primary, #0f172a)',
      };
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

import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
} from '@angular/core';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { TONE_COLOR, type SolTone } from '../tone/sol-tone';

/** Re-exportado por compatibilidad — la definición canónica vive en `ui/tone/sol-tone.ts`. */
export type { SolTone };

/** Umbral ascendente: `upTo` es el límite EXCLUSIVO superior de `tone`. */
export interface SolScoreThreshold {
  upTo: number;
  tone: SolTone;
}

/** Default del spec: éxito ≥80, advertencia ≥50, peligro <50. */
export const DEFAULT_SCORE_THRESHOLDS: readonly SolScoreThreshold[] = [
  { upTo: 50, tone: 'danger' },
  { upTo: 80, tone: 'warning' },
  { upTo: Infinity, tone: 'success' },
];

/**
 * Resuelve el tono de `score` contra `thresholds` (ordenados ascendente por
 * `upTo`): el primero cuyo `upTo` sea mayor que `score` gana; si ninguno lo
 * es, se usa el tono del último umbral. PURA — sin dependencias de Angular.
 */
export function resolveScoreTone(score: number, thresholds: readonly SolScoreThreshold[]): SolTone {
  const sorted = [...thresholds].sort((a, b) => a.upTo - b.upTo);
  const match = sorted.find((t) => score < t.upTo);
  return match?.tone ?? sorted[sorted.length - 1]?.tone ?? 'neutral';
}

/**
 * `sol-score-badge` — puntaje numérico con tono resuelto contra umbrales
 * configurables (spec: solercia-ui-vocero-atoms). Genérico: no sabe si el
 * puntaje viene de un lead, una corrida del laboratorio o cualquier otra
 * métrica — eso lo decide el consumidor vía `[value]`/`[thresholds]`.
 *
 * Estados especiales:
 *   - `pending=true` ("en curso"): la métrica aún se está calculando.
 *   - `value=null` ("sin dato"): no hay puntaje disponible todavía.
 * Ambos usan el tono neutral y un texto por clave i18n en vez del número.
 */
@Component({
  selector: 'sol-score-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sol-score-badge" [style]="hostStyles()">{{ displayText() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .sol-score-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.5rem;
      padding: 0.125rem 0.625rem;
      border-radius: var(--sol-border-radius-full, 9999px);
      font-family: var(--sol-font-family);
      font-weight: 600;
      font-size: var(--sol-font-size-sm, 0.8125rem);
      line-height: 1.5;
      white-space: nowrap;
    }
  `,
})
export class SolScoreBadgeComponent {
  private readonly i18n = injectSolI18n();

  /** Puntaje a mostrar; `null` = sin dato todavía. */
  readonly value = input<number | null>(null);

  /** Escala del puntaje (default 100). Los umbrales siempre se evalúan en escala 0-100. */
  readonly max = input<number>(100);

  readonly thresholds = input<readonly SolScoreThreshold[]>(DEFAULT_SCORE_THRESHOLDS);

  /** `true` mientras la métrica se está calculando (p. ej. corrida del laboratorio en curso). */
  readonly pending = input<boolean>(false);

  /**
   * `true` cuando no hay puntaje utilizable: `value=null` (sin dato todavía)
   * O `value` es `NaN` (p. ej. una división 0/0 corriente arriba, o un
   * `parseFloat` fallido). Sin esta guarda, `NaN < umbral` es SIEMPRE `false`
   * y `resolveScoreTone` cae al último tono ("éxito") mostrando una insignia
   * verde con el texto literal "NaN".
   */
  private readonly hasNoData = computed(() => {
    const v = this.value();
    return v === null || Number.isNaN(v);
  });

  /** Puntaje normalizado a 0-100 para evaluar contra los umbrales (el texto mostrado usa el valor crudo). */
  private readonly normalizedValue = computed(() => {
    const v = this.value();
    if (v === null) return null;
    const m = this.max();
    return m > 0 ? (v / m) * 100 : v;
  });

  readonly tone = computed<SolTone>(() => {
    if (this.pending() || this.hasNoData()) return 'neutral';
    return resolveScoreTone(this.normalizedValue()!, this.thresholds());
  });

  readonly displayText = computed(() => {
    this.i18n.activeLang();
    if (this.pending()) return this.i18n.translate('shared.scoreBadge.pending');
    return this.hasNoData() ? this.i18n.translate('shared.scoreBadge.empty') : `${this.value()}`;
  });

  readonly hostStyles = computed(() => {
    const color = TONE_COLOR[this.tone()];
    return `background: color-mix(in srgb, ${color} 15%, transparent); color: ${color};`;
  });
}

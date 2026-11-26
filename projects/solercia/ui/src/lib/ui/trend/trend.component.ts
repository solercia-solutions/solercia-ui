import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
} from '@angular/core';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolIconComponent, type SolIconName } from '../icon/icon.component';
import { TONE_COLOR, type SolTone } from '../tone/sol-tone';

export type SolTrendDirection = 'up' | 'down' | 'flat';

/** PURA: signo del delta determina la dirección. `0` siempre es `'flat'`. */
export function resolveTrendDirection(delta: number): SolTrendDirection {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

/** Formato por defecto: signo explícito (`+5`, `-15`, `0`). PURA. */
export function defaultTrendFormat(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

const DIRECTION_ICON: Partial<Record<SolTrendDirection, SolIconName>> = {
  up: 'chevron-up',
  down: 'chevron-down',
};

/** `flat` es SIEMPRE neutral (delta 0 neutro); `up`/`down` se resuelven vía `invert`. */
const DIRECTION_TONE: Record<SolTrendDirection, SolTone> = {
  up: 'success',
  down: 'danger',
  flat: 'neutral',
};

function invertTone(tone: SolTone): SolTone {
  if (tone === 'success') return 'danger';
  if (tone === 'danger') return 'success';
  return tone;
}

/**
 * `sol-trend` — delta con flecha (↑/↓/plano) y signo, comparando `current`
 * contra `previous` (spec: solercia-ui-vocero-atoms). Genérico: no sabe si
 * mide un score, ingresos o cualquier otra métrica.
 */
@Component({
  selector: 'sol-trend',
  standalone: true,
  imports: [SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sol-trend" [style.color]="toneColor()" [attr.aria-label]="ariaLabel()">
      @if (iconName(); as icon) {
        <sol-icon [name]="icon" size="sm" />
      }
      <span class="sol-trend__value">{{ displayText() }}</span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .sol-trend {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-family: var(--sol-font-family);
      font-size: var(--sol-font-size-sm, 0.8125rem);
      font-weight: 600;
      line-height: 1;
    }
  `,
})
export class SolTrendComponent {
  private readonly i18n = injectSolI18n();

  /** Valor actual de la métrica. */
  readonly current = input.required<number>();

  /** Valor previo a comparar; `null` = sin comparación disponible todavía. */
  readonly previous = input<number | null>(null);

  /** `true` invierte la semántica de color: subir es malo (p. ej. tasa de abandono). */
  readonly invert = input<boolean>(false);

  /** Formateador opcional del delta (p. ej. agregar "%"). Default: signo explícito. */
  readonly format = input<(delta: number) => string>(defaultTrendFormat);

  /**
   * `null` = "sin dato" (sin `previous` AÚN, o el delta resultó `NaN` — p. ej.
   * `current`/`previous` no numéricos corriente arriba). Sin esta guarda,
   * `resolveTrendDirection(NaN)` cae a `'flat'` mostrando el texto literal
   * "NaN" en vez del estado de "sin dato".
   */
  readonly delta = computed(() => {
    const prev = this.previous();
    if (prev === null) return null;
    const d = this.current() - prev;
    return Number.isNaN(d) ? null : d;
  });

  readonly direction = computed<SolTrendDirection>(() => {
    const d = this.delta();
    return d === null ? 'flat' : resolveTrendDirection(d);
  });

  readonly tone = computed<SolTone>(() => {
    const base = DIRECTION_TONE[this.direction()];
    return this.invert() ? invertTone(base) : base;
  });

  readonly toneColor = computed(() => TONE_COLOR[this.tone()]);

  readonly iconName = computed(() => DIRECTION_ICON[this.direction()] ?? null);

  readonly displayText = computed(() => {
    this.i18n.activeLang();
    const d = this.delta();
    return d === null ? this.i18n.translate('shared.trend.noData') : this.format()(d);
  });

  readonly ariaLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(`shared.trend.${this.direction()}`);
  });
}

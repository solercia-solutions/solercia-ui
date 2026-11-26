import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
} from '@angular/core';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';

export type SolProgressMode = 'continuous' | 'segmented';
export type SolProgressSize = 'sm' | 'md' | 'lg';
export type SolProgressVariant = 'primary' | 'success' | 'warning' | 'danger';

/**
 * `sol-progress-bar` — átomo del design system.
 *
 * Dos modos:
 *  - `continuous`: una barra que se llena según `value` (0..`max`).
 *  - `segmented`: N segmentos (`steps`); los que están hasta `current`
 *    (incluido) se pintan con el color de la variante, el resto quedan en
 *    el track (`--sol-bg-sunken`). Ideal como indicador de fase de un wizard.
 *
 * Tematizado 100% con `var(--sol-*)` (light/dark). Accesible: expone
 * `role="progressbar"` con `aria-valuenow/min/max` y `aria-valuetext`
 * (el texto legible: "50 %" o "Paso 2 de 4"), aunque la etiqueta visible
 * (`showLabel`) esté oculta.
 */
@Component({
  selector: 'sol-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-progress" [class]="rootClass()">
      @if (showLabel()) {
        <div class="sol-progress__label">{{ labelText() }}</div>
      }

      @if (mode() === 'segmented') {
        <div
          class="sol-progress__segments"
          role="progressbar"
          [attr.aria-label]="ariaLabelText()"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="ariaMax()"
          [attr.aria-valuenow]="ariaNow()"
          [attr.aria-valuetext]="labelText()"
        >
          @for (i of segments(); track i) {
            <span
              class="sol-progress__segment"
              [class.is-active]="i <= current()"
              aria-hidden="true"
            ></span>
          }
        </div>
      } @else {
        <div
          class="sol-progress__track"
          role="progressbar"
          [attr.aria-label]="ariaLabelText()"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="max()"
          [attr.aria-valuenow]="ariaNow()"
          [attr.aria-valuetext]="labelText()"
        >
          <div class="sol-progress__fill" [style.width.%]="percent()"></div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .sol-progress {
      /* Color efectivo de la barra: lo fija la variante. */
      --sol-progress-color: var(--sol-color-primary, #6366f1);
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-xs, 0.25rem);
      width: 100%;
    }

    /* ---- variantes de color ---- */
    .sol-progress--success { --sol-progress-color: var(--sol-color-success, #22c55e); }
    .sol-progress--warning { --sol-progress-color: var(--sol-color-warning, #f59e0b); }
    .sol-progress--danger  { --sol-progress-color: var(--sol-color-danger, #ef4444); }

    .sol-progress__label {
      font-family: var(--sol-font-family);
      font-size: var(--sol-font-size-sm, 0.75rem);
      color: var(--sol-color-text-muted, #94a3b8);
      line-height: 1.2;
    }

    /* ---- modo continuo ---- */
    .sol-progress__track {
      width: 100%;
      background: var(--sol-bg-sunken, #e2e8f0);
      border-radius: var(--sol-border-radius-full, 9999px);
      overflow: hidden;
    }

    .sol-progress__fill {
      height: 100%;
      background: var(--sol-progress-color);
      border-radius: inherit;
      transition: width var(--sol-dur-base, 300ms) var(--sol-ease, ease);
    }

    /* ---- modo segmentado ---- */
    .sol-progress__segments {
      display: flex;
      gap: var(--sol-space-xs, 0.25rem);
      width: 100%;
    }

    .sol-progress__segment {
      flex: 1 1 0;
      background: var(--sol-bg-sunken, #e2e8f0);
      border-radius: var(--sol-border-radius-full, 9999px);
      transition: background-color var(--sol-dur-base, 300ms) var(--sol-ease, ease);
    }

    .sol-progress__segment.is-active {
      background: var(--sol-progress-color);
    }

    /* ---- tamaños (altura de la pista/segmentos) ---- */
    .sol-progress--sm .sol-progress__track,
    .sol-progress--sm .sol-progress__segment { height: 4px; }

    .sol-progress--md .sol-progress__track,
    .sol-progress--md .sol-progress__segment { height: 8px; }

    .sol-progress--lg .sol-progress__track,
    .sol-progress--lg .sol-progress__segment { height: 12px; }

    @media (prefers-reduced-motion: reduce) {
      .sol-progress__fill,
      .sol-progress__segment { transition: none; }
    }
  `,
})
export class SolProgressBarComponent {
  private readonly i18n = injectSolI18n();

  /** `continuous` (value/max) o `segmented` (steps/current). */
  readonly mode = input<SolProgressMode>('continuous');

  /** Valor actual del modo continuo (se recorta a `[0, max]`). */
  readonly value = input<number>(0);

  /** Valor máximo del modo continuo. */
  readonly max = input<number>(100);

  /** Número total de segmentos (modo segmentado). */
  readonly steps = input<number>(0);

  /** Índice (base 0) del segmento actual; `0..current` se pintan activos. */
  readonly current = input<number>(0);

  /** Altura de la barra. */
  readonly size = input<SolProgressSize>('md');

  /** Color por estado. */
  readonly variant = input<SolProgressVariant>('primary');

  /** Muestra la etiqueta visible ("50 %" o "Paso X de N"). */
  readonly showLabel = input<boolean>(false);

  /** Override del texto de la etiqueta; si se deja vacío se deriva del modo. */
  readonly label = input<string>('');

  /** Override del nombre accesible; si se deja vacío usa la clave i18n por defecto. */
  readonly ariaLabel = input<string>('');

  readonly rootClass = computed(
    () => `sol-progress--${this.size()} sol-progress--${this.variant()}`,
  );

  /** Segmentos como arreglo de índices para el `@for`. */
  readonly segments = computed(() =>
    Array.from({ length: Math.max(0, Math.floor(this.steps())) }, (_, i) => i),
  );

  /** Valor recortado del modo continuo. */
  private readonly clampedValue = computed(() =>
    Math.min(Math.max(this.value(), 0), this.max()),
  );

  /** Porcentaje de llenado (0..100). */
  readonly percent = computed(() => {
    if (this.mode() === 'segmented') {
      const total = Math.max(1, this.steps());
      const done = Math.min(this.current() + 1, total);
      return (done / total) * 100;
    }
    const max = this.max();
    if (max <= 0) return 0;
    return (this.clampedValue() / max) * 100;
  });

  /** `aria-valuenow`. */
  readonly ariaNow = computed(() =>
    this.mode() === 'segmented'
      ? Math.min(this.current() + 1, this.steps())
      : Math.round(this.clampedValue()),
  );

  /** `aria-valuemax` del modo segmentado. */
  readonly ariaMax = computed(() => Math.max(0, Math.floor(this.steps())));

  /** Texto legible de la etiqueta (visible y para `aria-valuetext`). */
  readonly labelText = computed(() => {
    // Reaccionar al cambio de idioma.
    this.i18n.activeLang();

    const override = this.label().trim();
    if (override) return override;

    if (this.mode() === 'segmented') {
      const params = { current: this.current() + 1, total: this.steps() };
      const key = 'shared.progressBar.stepOf';
      const t = this.i18n.translate(key, params);
      return t && t !== key ? t : `Step ${params.current} of ${params.total}`;
    }

    return `${Math.round(this.percent())} %`;
  });

  /** Nombre accesible del control. */
  readonly ariaLabelText = computed(() => {
    this.i18n.activeLang();
    const override = this.ariaLabel().trim();
    if (override) return override;
    const key = 'shared.progressBar.aria';
    const t = this.i18n.translate(key);
    return t && t !== key ? t : 'Progress';
  });
}

import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolIconComponent } from '../icon/icon.component';

/**
 * Un paso del stepper. Recibe CLAVES i18n (no texto) — patrón
 * `sol-empty-state` — y las resuelve vía I18nService, reactivo al idioma.
 */
export interface SolStepperStep {
  /** Identificador estable del paso (track y testing). */
  id: string;
  /** Clave i18n de la etiqueta del paso. */
  labelKey: string;
  /** Clave i18n de la descripción corta opcional. */
  descriptionKey?: string;
  /** Marca el paso en estado de error (prevalece sobre completado). */
  error?: boolean;
}

export type SolStepperOrientation = 'horizontal' | 'vertical';
export type SolStepperStepState = 'completed' | 'current' | 'pending' | 'error';

/**
 * `'linear'` (default, comportamiento 0.1.x sin cambios): en modo
 * `interactive`, solo son navegables los pasos ya alcanzados (hasta
 * `furthestIndex`/`activeIndex`) — wizard clásico.
 * `'free'` (D7, 11-a-solercia-ui): CUALQUIER paso es navegable, incluso uno
 * nunca visitado — pipeline CRM accionable (mover un lead a cualquier
 * etapa). El estado visual (completado/actual/pendiente) no cambia; solo
 * cambia CUÁLES pasos aceptan clic/teclado.
 */
export type SolStepperNavigation = 'linear' | 'free';

/**
 * `sol-stepper` — átomo del design system (E4, primer consumidor:
 * onboarding v2).
 *
 * - Estados DERIVADOS del índice activo y de la frontera alcanzada
 *   (`furthestIndex`): activo → actual, cualquier paso hasta la frontera →
 *   completado, más allá → pendiente; `step.error` prevalece.
 * - A11y: lista con `aria-orientation`, `aria-current="step"` en el paso
 *   actual, `aria-disabled` en los no navegables y roving tabindex con
 *   navegación por flechas/Home/End cuando es interactivo.
 * - Interactivo: los pasos ya alcanzados (índice ≤ `furthestIndex`) son
 *   navegables en AMBOS sentidos; los futuros jamás emiten. Sin
 *   `furthestIndex` la frontera es el propio `activeIndex` → wizard lineal
 *   clásico (solo hacia atrás), preservando el comportamiento previo.
 * - `navigation` (D7, 11-a-solercia-ui): `'linear'` (default) es EXACTAMENTE
 *   el comportamiento anterior; `'free'` habilita el pipeline accionable —
 *   cualquier paso, visitado o no, es navegable. Extensión OCP pura: un
 *   input nuevo, cero cambios en la API 0.1.x.
 * - Light/dark vía tokens `--sol-*` con fallbacks, como todo átomo.
 */
@Component({
  selector: 'sol-stepper',
  standalone: true,
  imports: [SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol
      class="sol-stepper"
      [class.sol-stepper--horizontal]="orientation() === 'horizontal'"
      [class.sol-stepper--vertical]="orientation() === 'vertical'"
      [attr.aria-orientation]="orientation()"
      [attr.aria-label]="ariaLabel()"
      (keydown)="onKeydown($event)"
    >
      @for (step of steps(); track step.id; let i = $index; let last = $last) {
        <li class="sol-stepper__item">
          <button
            type="button"
            class="sol-stepper__step"
            [class.sol-stepper__step--completed]="stateOf(i) === 'completed'"
            [class.sol-stepper__step--current]="stateOf(i) === 'current'"
            [class.sol-stepper__step--pending]="stateOf(i) === 'pending'"
            [class.sol-stepper__step--error]="stateOf(i) === 'error'"
            [attr.aria-current]="stateOf(i) === 'current' ? 'step' : null"
            [attr.aria-disabled]="ariaDisabledOf(i)"
            [attr.tabindex]="tabIndexOf(i)"
            (click)="onStepClick(i)"
          >
            <span class="sol-stepper__indicator" aria-hidden="true">
              @if (stateOf(i) === 'completed') {
                <sol-icon name="check" size="sm" />
              } @else if (stateOf(i) === 'error') {
                <span class="sol-stepper__error-mark">!</span>
              } @else {
                <span>{{ i + 1 }}</span>
              }
            </span>
            <span class="sol-stepper__texts">
              <span class="sol-stepper__label">{{ labels()[i] }}</span>
              @if (descriptions()[i]) {
                <span class="sol-stepper__description">{{ descriptions()[i] }}</span>
              }
              <span class="sol-stepper__sr">{{ stateLabels()[stateOf(i)] }}</span>
            </span>
          </button>
          @if (!last) {
            <span
              class="sol-stepper__connector"
              [class.sol-stepper__connector--done]="i < effectiveFurthest()"
              aria-hidden="true"
            ></span>
          }
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .sol-stepper {
      display: flex;
      list-style: none;
      margin: 0;
      padding: var(--sol-space-sm, 0.5rem) 0;
    }

    .sol-stepper--horizontal {
      flex-direction: row;
      align-items: flex-start;
      justify-content: center;
    }

    .sol-stepper--vertical {
      flex-direction: column;
    }

    .sol-stepper__item {
      display: flex;
      flex: 0 1 auto;
      min-width: 0;
    }

    .sol-stepper--horizontal .sol-stepper__item {
      flex-direction: row;
      align-items: flex-start;
    }

    .sol-stepper--vertical .sol-stepper__item {
      flex-direction: column;
    }

    .sol-stepper__step {
      display: flex;
      align-items: center;
      gap: var(--sol-space-sm, 0.5rem);
      background: none;
      border: none;
      padding: 4px;
      border-radius: var(--sol-border-radius-md, 8px);
      cursor: default;
      font-family: var(--sol-font-family);
      text-align: left;
    }

    .sol-stepper--horizontal .sol-stepper__step {
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 8rem;
    }

    .sol-stepper__step:not([aria-disabled='true'])[tabindex] {
      cursor: pointer;
    }

    .sol-stepper__step:focus-visible {
      outline: 2px solid var(--sol-color-primary, #2563eb);
      outline-offset: 2px;
    }

    .sol-stepper__indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      border: 2px solid var(--sol-border-color-default, #cbd5e1);
      background: var(--sol-bg-surface, #ffffff);
      color: var(--sol-color-text-muted, #94a3b8);
      font-size: var(--sol-font-size-sm, 0.875rem);
      font-weight: 600;
      transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
    }

    .sol-stepper__step--current .sol-stepper__indicator {
      border-color: var(--sol-color-primary, #6366f1);
      background: var(--sol-color-primary, #6366f1);
      color: var(--sol-color-primary-contrast, #ffffff);
    }

    .sol-stepper__step--completed .sol-stepper__indicator {
      border-color: var(--sol-color-success, #22c55e);
      background: var(--sol-color-success, #22c55e);
      color: #ffffff;
    }

    .sol-stepper__step--error .sol-stepper__indicator {
      border-color: var(--sol-color-danger, #ef4444);
      background: var(--sol-color-danger, #ef4444);
      color: #ffffff;
    }

    .sol-stepper__texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .sol-stepper__label {
      font-size: var(--sol-font-size-xs, 0.75rem);
      color: var(--sol-color-text-muted, #94a3b8);
      line-height: 1.2;
      transition: color 0.2s ease;
    }

    .sol-stepper__step--current .sol-stepper__label {
      color: var(--sol-color-primary, #6366f1);
      font-weight: 600;
    }

    .sol-stepper__step--completed .sol-stepper__label {
      color: var(--sol-color-success, #22c55e);
      font-weight: 500;
    }

    .sol-stepper__step--error .sol-stepper__label {
      color: var(--sol-color-danger, #ef4444);
      font-weight: 600;
    }

    .sol-stepper__description {
      font-size: var(--sol-font-size-xs, 0.7rem);
      color: var(--sol-color-text-muted, #94a3b8);
    }

    .sol-stepper__connector {
      flex: 1;
      background: var(--sol-border-color-default, #cbd5e1);
      transition: background-color 0.2s ease;
    }

    .sol-stepper--horizontal .sol-stepper__connector {
      height: 2px;
      min-width: 1.5rem;
      margin-top: calc(4px + 1.125rem);
    }

    .sol-stepper--vertical .sol-stepper__connector {
      width: 2px;
      min-height: 1.25rem;
      margin-left: calc(4px + 1.125rem);
    }

    .sol-stepper__connector--done {
      background: var(--sol-color-success, #22c55e);
    }

    .sol-stepper__error-mark {
      font-weight: 700;
    }

    .sol-stepper__sr {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 480px) {
      .sol-stepper__indicator {
        width: 1.75rem;
        height: 1.75rem;
        font-size: 0.75rem;
      }

      .sol-stepper--horizontal .sol-stepper__connector {
        margin-top: calc(4px + 0.875rem);
      }
    }
  `,
})
export class SolStepperComponent {
  private readonly i18n = inject(SOL_I18N);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Pasos a renderizar, en orden. */
  readonly steps = input.required<SolStepperStep[]>();

  /** Índice (base 0) del paso actual. */
  readonly activeIndex = input<number>(0);

  /**
   * Índice máximo ya alcanzado (frontera). Los pasos hasta aquí se muestran
   * completados y son navegables en ambos sentidos. Si es `null` (default),
   * la frontera es el propio `activeIndex` → wizard lineal clásico.
   */
  readonly furthestIndex = input<number | null>(null);

  readonly orientation = input<SolStepperOrientation>('horizontal');

  /**
   * `true` permite navegar a pasos YA alcanzados (clic/teclado), atrás o
   * adelante hasta `furthestIndex`. Los pasos futuros nunca son navegables.
   */
  readonly interactive = input<boolean>(false);

  /**
   * `'linear'` (default) preserva la API 0.1.x sin cambios de comportamiento.
   * `'free'` habilita el pipeline accionable: con `interactive=true`,
   * CUALQUIER paso (incluso uno no alcanzado) es navegable — ver
   * {@link SolStepperNavigation}.
   */
  readonly navigation = input<SolStepperNavigation>('linear');

  /** Clave i18n del nombre accesible de la lista de pasos. */
  readonly ariaLabelKey = input<string>('shared.stepper.aria');

  /** Índice del paso visitado al que el usuario quiere volver. */
  readonly stepSelected = output<number>();

  /** Claves dinámicas → traducción reactiva al idioma (patrón sol-empty-state). */
  readonly labels = computed(() => {
    this.i18n.activeLang();
    return this.steps().map(step => this.i18n.translate(step.labelKey));
  });

  readonly descriptions = computed(() => {
    this.i18n.activeLang();
    return this.steps().map(step =>
      step.descriptionKey ? this.i18n.translate(step.descriptionKey) : '',
    );
  });

  readonly ariaLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(this.ariaLabelKey());
  });

  /** Texto solo-lector-de-pantalla del estado de cada paso. */
  readonly stateLabels = computed<Record<SolStepperStepState, string>>(() => {
    this.i18n.activeLang();
    return {
      completed: this.i18n.translate('shared.stepper.state.completed'),
      current: this.i18n.translate('shared.stepper.state.current'),
      pending: this.i18n.translate('shared.stepper.state.pending'),
      error: this.i18n.translate('shared.stepper.state.error'),
    };
  });

  /**
   * Frontera efectiva: `furthestIndex` si se proporcionó, si no el propio
   * `activeIndex` (wizard lineal). Nunca por debajo del activo.
   */
  readonly effectiveFurthest = computed(() =>
    Math.max(this.activeIndex(), this.furthestIndex() ?? this.activeIndex()),
  );

  stateOf(index: number): SolStepperStepState {
    if (this.steps()[index]?.error) return 'error';
    if (index === this.activeIndex()) return 'current';
    // Todo paso hasta la frontera alcanzada cuenta como completado, aunque
    // esté por delante del paso visible (el usuario retrocedió a revisarlo).
    if (index <= this.effectiveFurthest()) return 'completed';
    return 'pending';
  }

  /**
   * Navegable = interactivo y distinto del actual. En `navigation:'linear'`
   * (default) además exige estar dentro de la frontera alcanzada — igual
   * que antes de D7. En `navigation:'free'` cualquier paso califica (pipeline
   * accionable): el estado visual sigue siendo el mismo, solo cambia qué
   * acepta clic/teclado.
   */
  isNavigable(index: number): boolean {
    if (!this.interactive() || index === this.activeIndex()) return false;
    if (this.navigation() === 'free') return true;
    return index <= this.effectiveFurthest();
  }

  /** `aria-disabled` solo aplica en modo interactivo; en visual puro no hay semántica de botón. */
  ariaDisabledOf(index: number): string | null {
    if (!this.interactive()) return null;
    return this.isNavigable(index) ? 'false' : 'true';
  }

  /** Roving tabindex: único tab-stop en el paso actual cuando es interactivo. */
  tabIndexOf(index: number): number {
    if (!this.interactive()) return -1;
    return index === this.activeIndex() ? 0 : -1;
  }

  onStepClick(index: number): void {
    if (!this.isNavigable(index)) return;
    this.stepSelected.emit(index);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.interactive()) return;

    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const home = event.key === 'Home';
    const end = event.key === 'End';
    if (!forward && !backward && !home && !end) return;

    const buttons = Array.from(
      (this.host.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.sol-stepper__step',
      ),
    );
    // Focos válidos: en 'free' TODOS los pasos; en 'linear' (default) solo
    // hasta la frontera alcanzada (los futuros no) — comportamiento 0.1.x.
    const focusable = this.navigation() === 'free' ? buttons : buttons.slice(0, this.effectiveFurthest() + 1);
    if (focusable.length === 0) return;

    const currentFocus = focusable.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (home) next = 0;
    else if (end) next = focusable.length - 1;
    else if (currentFocus === -1) next = focusable.length - 1;
    else if (forward) next = Math.min(currentFocus + 1, focusable.length - 1);
    else next = Math.max(currentFocus - 1, 0);

    event.preventDefault();
    focusable[next].focus();
  }
}

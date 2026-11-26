import {
  Component,
  Directive,
  ChangeDetectionStrategy,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  linkedSignal,
  model,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolStepperComponent, type SolStepperStep } from '../stepper/stepper.component';
import { SolButtonComponent } from '../button/button.component';
import { SolIconComponent, type SolIconName } from '../icon/icon.component';
import { SolProgressBarComponent } from '../progress-bar/progress-bar.component';

/**
 * Un paso del wizard. El texto se resuelve así (primero que exista):
 *   `label` (literal, override) → `labelKey` (clave i18n) → cadena vacía.
 * `icon` (opcional) es un nombre de `sol-icon` que se muestra en el
 * encabezado del paso activo.
 */
export interface SolWizardStep {
  /** Identificador estable del paso (track y testing). */
  id: string;
  /** Etiqueta literal (tiene prioridad sobre `labelKey`). */
  label?: string;
  /** Clave i18n de la etiqueta. */
  labelKey?: string;
  /** Ícono opcional (nombre en el registry de `sol-icon`). */
  icon?: SolIconName | string;
}

/** `boolean` o predicado sobre el índice del paso actual. */
export type SolWizardCanAdvance = boolean | ((currentIndex: number) => boolean);

/**
 * Marca un `<ng-template>`/`<ng-container *solWizardStep>` como el cuerpo de
 * un paso. El wizard renderiza SOLO la plantilla cuyo orden posicional
 * coincide con el paso actual. Debe ser hijo directo de `<sol-wizard>`.
 *
 * ```html
 * <sol-wizard [steps]="steps" [(current)]="current" (finish)="guardar()">
 *   <ng-container *solWizardStep>...contenido paso 1...</ng-container>
 *   <ng-container *solWizardStep>...contenido paso 2...</ng-container>
 * </sol-wizard>
 * ```
 */
@Directive({
  selector: '[solWizardStep]',
  standalone: true,
})
export class SolWizardStepDirective {
  readonly template = inject(TemplateRef<unknown>);
}

/**
 * `sol-wizard` — asistente por pasos tipo pills/card del design system.
 *
 * Composición (no reimplementa piezas existentes):
 *  - HEADER: `sol-progress-bar` segmentado (N fases = N pasos, el actual y
 *    los previos coloreados) + `sol-stepper` interactivo para las pills
 *    (número → ✓ al completar, conector, retroceso a pasos ya visitados,
 *    a11y y teclado ya resueltos por el átomo).
 *  - CUERPO: proyección por paso vía `*solWizardStep` (patrón recomendado);
 *    si no hay plantillas, cae a un `<ng-content>` único que el consumidor
 *    controla con el `current` enlazado en dos vías.
 *  - FOOTER: "Anterior" (ghost) y "Siguiente" (primary) con `sol-button`;
 *    en el último paso "Siguiente" pasa a "Finalizar" y emite `finish`.
 *
 * `current` es un `model` (two-way `[(current)]`). Además emite `next`,
 * `previous`, `stepChange` y `finish`. `canAdvance` (bool o predicado)
 * deshabilita el avance. Texto por i18n `es-CO` con override por input.
 */
@Component({
  selector: 'sol-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    SolStepperComponent,
    SolButtonComponent,
    SolIconComponent,
    SolProgressBarComponent,
  ],
  template: `
    <section class="sol-wizard">
      <!-- HEADER: fases + pills -->
      <header class="sol-wizard__header">
        @if (showProgressBar()) {
          <sol-progress-bar
            mode="segmented"
            size="sm"
            [steps]="stepCount()"
            [current]="current()"
          />
        }

        <sol-stepper
          [steps]="stepperSteps()"
          [activeIndex]="current()"
          [furthestIndex]="furthest()"
          [interactive]="true"
          (stepSelected)="goTo($event)"
        />
      </header>

      <!-- CUERPO: encabezado opcional del paso + contenido proyectado -->
      <div class="sol-wizard__body">
        @if (activeStep(); as step) {
          @if (step.icon) {
            <div class="sol-wizard__step-heading">
              <sol-icon [name]="step.icon" size="md" />
              <span>{{ activeLabel() }}</span>
            </div>
          }
        }

        @if (stepTemplates().length > 0) {
          @for (key of [current()]; track key) {
            <div class="sol-wizard__panel">
              @if (currentTemplate(); as tpl) {
                <ng-container [ngTemplateOutlet]="tpl" />
              }
            </div>
          }
        } @else {
          <ng-content />
        }
      </div>

      <!-- FOOTER: navegación -->
      <footer class="sol-wizard__footer">
        @if (!isFirst() || !hidePreviousOnFirst()) {
          <sol-button
            class="sol-wizard__prev"
            variant="ghost"
            [disabled]="isFirst()"
            (clicked)="goPrevious()"
          >
            <sol-icon name="chevron-left" size="sm" />
            {{ previousText() }}
          </sol-button>
        }

        <sol-button
          class="sol-wizard__next"
          variant="primary"
          [disabled]="!canAdvanceNow()"
          (clicked)="goNext()"
        >
          {{ isLast() ? finishText() : nextText() }}
          @if (isLast()) {
            <sol-icon name="check" size="sm" />
          } @else {
            <sol-icon name="chevron-right" size="sm" />
          }
        </sol-button>
      </footer>
    </section>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .sol-wizard {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-lg, 1.5rem);
      font-family: var(--sol-font-family);
    }

    .sol-wizard__header {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-md, 1rem);
    }

    .sol-wizard__step-heading {
      display: flex;
      align-items: center;
      gap: var(--sol-space-sm, 0.5rem);
      margin-bottom: var(--sol-space-md, 1rem);
      color: var(--sol-color-text-primary, #1e293b);
      font-size: var(--sol-font-size-lg, 1rem);
      font-weight: var(--sol-font-weight-bold, 600);
    }

    .sol-wizard__body {
      min-height: 2rem;
    }

    /* Transición sutil al cambiar de paso: el bloque @for recrea el panel
       cada vez que cambia el índice actual, así la animación se re-dispara. */
    .sol-wizard__panel {
      animation: sol-wizard-reveal var(--sol-dur-base, 300ms) var(--sol-ease, ease);
    }

    @keyframes sol-wizard-reveal {
      from { opacity: 0; transform: translateX(var(--sol-reveal-dist, 8px)); }
      to   { opacity: 1; transform: none; }
    }

    .sol-wizard__footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: var(--sol-space-sm, 0.5rem);
      padding-top: var(--sol-space-md, 1rem);
      border-top: var(--sol-border-width-default, 1px) solid
        var(--sol-border-color-default, #e2e8f0);
    }

    /* "Anterior" pegado a la izquierda; "Siguiente" siempre a la derecha. */
    .sol-wizard__prev {
      margin-right: auto;
    }

    @media (prefers-reduced-motion: reduce) {
      .sol-wizard__panel { animation: none; }
    }
  `,
})
export class SolWizardComponent {
  private readonly i18n = injectSolI18n();

  /** Pasos a renderizar, en orden. */
  readonly steps = input.required<SolWizardStep[]>();

  /** Índice (base 0) del paso actual — enlazable en dos vías `[(current)]`. */
  readonly current = model<number>(0);

  /** Muestra la barra de fases segmentada en el header. */
  readonly showProgressBar = input<boolean>(true);

  /** Oculta "Anterior" en el primer paso; si es `false`, lo muestra deshabilitado. */
  readonly hidePreviousOnFirst = input<boolean>(true);

  /** Permite/impide avanzar (bool o predicado del índice actual). */
  readonly canAdvance = input<SolWizardCanAdvance>(true);

  /** Overrides de texto (si se dejan vacíos usan la clave i18n / el default es-CO). */
  readonly previousLabel = input<string>('');
  readonly nextLabel = input<string>('');
  readonly finishLabel = input<string>('');

  /** Se emite al avanzar (paso no final). */
  readonly next = output<void>();
  /** Se emite al retroceder con "Anterior". */
  readonly previous = output<void>();
  /** Se emite con el nuevo índice cada vez que cambia el paso. */
  readonly stepChange = output<number>();
  /** Se emite al confirmar el último paso. */
  readonly finish = output<void>();

  /** Plantillas de paso proyectadas (orden posicional = orden de `steps`). */
  private readonly stepTemplatesQuery = contentChildren(SolWizardStepDirective);
  readonly stepTemplates = computed(() => this.stepTemplatesQuery());

  readonly currentTemplate = computed(
    () => this.stepTemplates()[this.current()]?.template ?? null,
  );

  /** Frontera máxima alcanzada (para el retroceso por pills del stepper). */
  readonly furthest = linkedSignal<number, number>({
    source: this.current,
    computation: (current, previous) =>
      Math.max(current, previous?.value ?? current),
  });

  readonly stepCount = computed(() => this.steps().length);
  readonly isFirst = computed(() => this.current() <= 0);
  readonly isLast = computed(() => this.current() >= this.stepCount() - 1);

  readonly activeStep = computed<SolWizardStep | undefined>(
    () => this.steps()[this.current()],
  );

  /** Mapea los pasos del wizard al contrato de `sol-stepper` (labelKey). */
  readonly stepperSteps = computed<SolStepperStep[]>(() =>
    this.steps().map(step => ({
      id: step.id,
      // Un literal pasa "tal cual": `translate('Servicios')` cae al propio
      // texto (fallback seguro de Transloco), así el stepper lo muestra bien.
      labelKey: step.label ?? step.labelKey ?? '',
    })),
  );

  readonly canAdvanceNow = computed(() => {
    const rule = this.canAdvance();
    return typeof rule === 'function' ? rule(this.current()) : rule;
  });

  readonly activeLabel = computed(() => {
    this.i18n.activeLang();
    const step = this.activeStep();
    if (!step) return '';
    if (step.label) return step.label;
    if (step.labelKey) return this.i18n.translate(step.labelKey);
    return '';
  });

  readonly previousText = computed(() =>
    this.text(this.previousLabel(), 'shared.wizard.previous', 'Previous'),
  );
  readonly nextText = computed(() =>
    this.text(this.nextLabel(), 'shared.wizard.next', 'Next'),
  );
  readonly finishText = computed(() =>
    this.text(this.finishLabel(), 'shared.wizard.finish', 'Finish'),
  );

  /** Resuelve texto: override → clave i18n (catálogo del host o el incluido) → respaldo en inglés. */
  private text(override: string, key: string, fallback: string): string {
    this.i18n.activeLang();
    const value = override.trim();
    if (value) return value;
    const translated = this.i18n.translate(key);
    return translated && translated !== key ? translated : fallback;
  }

  /** Navega a un paso ya visitado (pills del stepper). */
  goTo(index: number): void {
    if (index === this.current()) return;
    this.current.set(index);
    this.stepChange.emit(index);
  }

  goPrevious(): void {
    if (this.isFirst()) return;
    const target = this.current() - 1;
    this.current.set(target);
    this.previous.emit();
    this.stepChange.emit(target);
  }

  goNext(): void {
    if (!this.canAdvanceNow()) return;
    if (this.isLast()) {
      this.finish.emit();
      return;
    }
    const target = this.current() + 1;
    this.current.set(target);
    this.next.emit();
    this.stepChange.emit(target);
  }
}

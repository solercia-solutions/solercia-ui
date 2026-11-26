import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolIconComponent } from '../icon/icon.component';

/**
 * `sol-number-input` — stepper numérico `−/n/+` (11-f PR2, ciclo 3 UX).
 *
 * NOMBRE DELIBERADO: NO `sol-stepper` — ese nombre ya lo usa
 * `SolStepperComponent`, el indicador de PASOS del wizard (pasos
 * completado/actual/pendiente). Este átomo es un control numérico
 * (`min`/`max`/`step`, CVA), sin relación con aquel — colisión de nombre
 * evitada a propósito.
 *
 * CVA (patrón `sol-select`): el valor es siempre un `number`, acotado a
 * `[min, max]` — el clamp tiene PRECEDENCIA sobre `step`: cuando
 * `(max-min)` no es múltiplo de `step`, el valor puede terminar NO alineado
 * a la grilla de `step` (p.ej. `min=0,max=10,step=3` llega hasta `10`, no
 * hasta `9`). NO se sobrepromete alineación a `step`. Los botones `−`/`+`
 * se deshabilitan al llegar al límite (no hacen wrap). El campo central es
 * editable directamente; un valor no numérico revierte al último valor
 * válido en `blur`/`change`.
 *
 * Defaults: `min=0`, `max=Number.MAX_SAFE_INTEGER` (deliberadamente no
 * acotado — un consumidor que olvida pasar `max` no queda clampado en
 * silencio a un tope arbitrario), `step=1`. Un `step<=0` (cero o negativo)
 * se trata como `1` vía `effectiveStep` — de lo contrario `step=0` deja los
 * botones habilitados pero inertes, y un `step` negativo invertiría la
 * dirección de `+`/`−`. Si `min()>max()` (rango invertido por el
 * consumidor), `effectiveMax` normaliza el tope a `min()` — el widget
 * colapsa a un único valor válido en vez de quedar con ambos botones
 * deshabilitados sin ninguna forma de salir de ese estado.
 * `value()` se re-clampa reactivamente (via `effect()`) si `min`/`max`
 * cambian en runtime y lo dejan fuera de rango, reemitiendo por CVA solo si
 * el valor efectivo cambió.
 *
 * A11y: `role="spinbutton"` con `aria-valuemin`/`aria-valuemax`/`aria-valuenow`
 * en el campo de texto central; flechas arriba/abajo incrementan/decrementan
 * un `step` efectivo, Home/End saltan a `min`/`effectiveMax`.
 *
 * Móvil: el campo central SÍ es un `<input>` de texto real, así que aplica
 * el mismo criterio de zoom de iOS Safari que PR1 — `font-size:16px` dentro
 * de `@media (max-width:640px)`, encapsulado en los `styles` del componente.
 */
@Component({
  selector: 'sol-number-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolNumberInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="sol-number-input" [class.sol-number-input--disabled]="disabled()">
      <button
        type="button"
        class="sol-number-input__btn sol-number-input__btn--decrement"
        [attr.aria-label]="decrementLabel()"
        [disabled]="disabled() || isAtMin()"
        (click)="decrement()"
      >
        <sol-icon name="minus" size="sm" />
      </button>

      <input
        type="text"
        inputmode="numeric"
        class="sol-number-input__field"
        role="spinbutton"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-valuemin]="min()"
        [attr.aria-valuemax]="effectiveMax()"
        [attr.aria-valuenow]="value()"
        [attr.aria-disabled]="disabled() || null"
        [disabled]="disabled()"
        [value]="displayValue()"
        (change)="onFieldChange($event)"
        (blur)="onFieldBlur($event)"
        (keydown)="onFieldKeydown($event)"
      />

      <button
        type="button"
        class="sol-number-input__btn sol-number-input__btn--increment"
        [attr.aria-label]="incrementLabel()"
        [disabled]="disabled() || isAtMax()"
        (click)="increment()"
      >
        <sol-icon name="plus" size="sm" />
      </button>
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
      /* Paridad de theming con sol-input (mismo criterio de tokens v2 con
         fallback v1 — ver input.component.ts): el borde/fondo/radio/alto
         son los MISMOS tokens, así el stepper se ve "de la casa" en vez de
         un control aparte con bordes que no combinan con el resto de los
         controles del formulario. */
      --sol-number-input-bg: var(--sol-input-bg, var(--sol-bg-surface, #ffffff));
      --sol-number-input-text: var(--sol-color-text-primary, #1e293b);
      --sol-number-input-border: var(--sol-input-border, var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #cbd5e1));
      --sol-number-input-focus-border: var(--sol-input-focus-border, var(--sol-border-width-default, 1px) solid var(--sol-color-primary, #6366f1));
      --sol-number-input-focus-ring: var(--sol-input-focus-ring, 0 0 0 2px color-mix(in srgb, var(--sol-color-primary, #6366f1) 20%, transparent));
      --sol-number-input-btn-text: var(--sol-color-text-secondary, #475569);
      --sol-number-input-hover-bg: var(--sol-color-bg-hover, rgba(0, 0, 0, 0.04));
      --sol-number-input-disabled-opacity: var(--sol-disabled-opacity, 0.55);
      --sol-number-input-radius: var(--sol-input-radius, var(--sol-border-radius-md, 0.5rem));
      --sol-number-input-height: var(--sol-size-input-height, 2.25rem);
      --sol-number-input-font-size: var(--sol-font-size-base, 0.875rem);
      --sol-number-input-transition: var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
    }

    .sol-number-input {
      display: inline-flex;
      align-items: stretch;
      height: var(--sol-number-input-height);
      border: var(--sol-number-input-border);
      border-radius: var(--sol-number-input-radius);
      overflow: hidden;
      background: var(--sol-number-input-bg);
      box-sizing: border-box;
      transition: border-color var(--sol-number-input-transition), box-shadow var(--sol-number-input-transition);
    }

    /* :focus-within (no :focus): el foco real recae en el <input> central,
       nunca en el div contenedor — mismo criterio visual que sol-input al
       enfocarse (borde + anillo), pero disparado por cualquier hijo
       enfocado (campo o botones −/+). */
    .sol-number-input:focus-within {
      border: var(--sol-number-input-focus-border);
      box-shadow: var(--sol-number-input-focus-ring);
    }

    .sol-number-input--disabled {
      opacity: var(--sol-number-input-disabled-opacity);
    }

    .sol-number-input__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      border: none;
      background: transparent;
      color: var(--sol-number-input-btn-text);
      cursor: pointer;
      transition: background-color var(--sol-number-input-transition);
    }

    .sol-number-input__btn--decrement {
      border-right: var(--sol-number-input-border);
    }

    .sol-number-input__btn--increment {
      border-left: var(--sol-number-input-border);
    }

    .sol-number-input__btn:hover:not(:disabled) {
      background: var(--sol-number-input-hover-bg);
    }

    .sol-number-input__btn:focus-visible {
      outline: 2px solid var(--sol-color-primary, #6366f1);
      outline-offset: -2px;
    }

    .sol-number-input__btn:disabled {
      cursor: not-allowed;
      opacity: var(--sol-number-input-disabled-opacity);
    }

    .sol-number-input__field {
      width: 3.5rem;
      border: none;
      background: transparent;
      text-align: center;
      font-family: inherit;
      font-size: var(--sol-number-input-font-size);
      color: var(--sol-number-input-text);
      -moz-appearance: textfield;
    }

    .sol-number-input__field:focus {
      outline: none;
    }

    .sol-number-input__field:disabled {
      cursor: not-allowed;
    }

    /* Evita el zoom automático de iOS Safari al enfocar el campo central
       (requiere font-size computado >= 16px). Mismo criterio encapsulado
       que el fix de PR1 (11-f): solo font-size, sin tocar el token global
       --sol-font-size-base ni afectar el tamaño fuera de este breakpoint. */
    @media (max-width: 640px) {
      .sol-number-input__field {
        font-size: 16px;
      }
    }
  `,
})
export class SolNumberInputComponent implements ControlValueAccessor {
  private readonly i18n = injectSolI18n();

  readonly min = input<number>(0);
  readonly max = input<number>(Number.MAX_SAFE_INTEGER);
  readonly step = input<number>(1);
  readonly disabled = input<boolean>(false);
  /** i18n key for the field's accessible name — required: describes what quantity this instance edits (e.g. "Cantidad de sesiones"). */
  readonly ariaLabelKey = input.required<string>();
  readonly decrementLabelKey = input<string>('shared.numberInput.decrement');
  readonly incrementLabelKey = input<string>('shared.numberInput.increment');

  readonly value = signal(0);

  /**
   * Tope efectivo tras defenderse de `min() > max()`: se sube `max` hasta
   * `min` para que el widget siempre tenga un rango válido y no ambiguo, en
   * vez de quedar con ambos botones deshabilitados sin ninguna salida. Un
   * `min>max` sigue siendo un bug del consumidor que conviene corregir
   * arriba — esto es solo la defensa del átomo.
   */
  readonly effectiveMax = computed(() => Math.max(this.min(), this.max()));
  /** `step<=0` (cero o negativo) se trata como `1` — evita botones inertes (`step=0`) o con dirección invertida (`step` negativo). */
  readonly effectiveStep = computed(() => (this.step() > 0 ? this.step() : 1));

  readonly displayValue = computed(() => String(this.value()));
  readonly isAtMin = computed(() => this.value() <= this.min());
  readonly isAtMax = computed(() => this.value() >= this.effectiveMax());

  readonly ariaLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(this.ariaLabelKey());
  });

  readonly decrementLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(this.decrementLabelKey());
  });

  readonly incrementLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(this.incrementLabelKey());
  });

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    // Re-clampa `value()` cuando `min`/`max` cambian en runtime y lo dejan
    // fuera de rango (p.ej. el consumidor reduce `max` por debajo del valor
    // actual). Reemite por CVA solo si el valor efectivo cambió — misma
    // guarda de igualdad que `setValue`.
    effect(() => {
      const clamped = this.clamp(this.value());
      if (clamped !== this.value()) {
        this.value.set(clamped);
        this.onChange(clamped);
      }
    });
  }

  private clamp(raw: number): number {
    return Math.min(this.effectiveMax(), Math.max(this.min(), raw));
  }

  increment(): void {
    if (this.disabled() || this.isAtMax()) return;
    this.setValue(this.value() + this.effectiveStep());
  }

  decrement(): void {
    if (this.disabled() || this.isAtMin()) return;
    this.setValue(this.value() - this.effectiveStep());
  }

  private setValue(next: number): void {
    const clamped = this.clamp(next);
    if (clamped === this.value()) return;
    this.value.set(clamped);
    this.onChange(clamped);
  }

  onFieldChange(event: Event): void {
    const field = event.target as HTMLInputElement;
    const parsed = Number(field.value);
    if (field.value.trim() === '' || Number.isNaN(parsed)) {
      field.value = this.displayValue();
      return;
    }
    this.setValue(parsed);
    field.value = this.displayValue();
  }

  onFieldBlur(event: Event): void {
    this.onTouched();
    (event.target as HTMLInputElement).value = this.displayValue();
  }

  onFieldKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.increment();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.decrement();
        break;
      case 'Home':
        event.preventDefault();
        this.setValue(this.min());
        break;
      case 'End':
        event.preventDefault();
        this.setValue(this.effectiveMax());
        break;
    }
  }

  // ── ControlValueAccessor ──

  writeValue(value: number | null): void {
    const safe = value != null && !Number.isNaN(value) ? value : 0;
    this.value.set(this.clamp(safe));
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(_isDisabled: boolean): void {
    // Handled via the `disabled()` input binding, same convention as sol-select.
  }
}

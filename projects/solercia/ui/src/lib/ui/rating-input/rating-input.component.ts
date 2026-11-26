import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolIconComponent } from '../icon/icon.component';

export type SolRatingInputSize = 'sm' | 'md' | 'lg';

/** Escala de calificación: 5 estrellas, la misma de `sol-star-rating`. */
const MAX_STARS = 5;

/**
 * `sol-rating-input` — calificación INTERACTIVA de 1 a 5 estrellas.
 *
 * ## Por qué es un componente aparte de `sol-star-rating`
 *
 * `sol-star-rating` es de SOLO LECTURA: su contenedor es un `role="img"` con
 * el valor en el `aria-label` y sus estrellas son `aria-hidden`. Un lector de
 * pantalla anuncia «4,3 de 5» de un tirón, como quien lee una imagen.
 *
 * Este componente es un GRUPO DE OPCIONES: `role="radiogroup"` con cinco
 * `role="radio"`, `aria-checked` por estrella, navegación por teclado y una
 * sola parada de tabulación. Son dos contratos de accesibilidad distintos —
 * mostrar un valor y capturarlo no son el mismo widget. Unirlos detrás de una
 * bandera `interactive` obligaría a alternar rol, foco, tabindex y semántica
 * de cada estrella dentro de una misma clase, y ninguno de los dos modos
 * quedaría bien. Por eso `sol-star-rating` NO se modificó.
 *
 * ## Sin valor por defecto (decisión deliberada)
 *
 * El principio de «smart defaults» dice que pre-seleccionar lo probable ahorra
 * decisiones. Este es exactamente el caso donde ese principio NO aplica: su
 * límite ético es que el default debe servir a quien responde, no a quien
 * pregunta. Una calificación pre-marcada ancla la respuesta (sesgo de anclaje)
 * y le sirve al negocio, no a la clienta: si arranca en 5, la respuesta media
 * sube sin que nadie lo haya decidido, y el dato deja de medir la experiencia.
 *
 * Por eso `value` arranca en `null` y las cinco estrellas nacen vacías, con
 * ninguna `aria-checked="true"` — un radiogroup sin opción marcada es
 * perfectamente válido en ARIA. `writeValue(null)` vuelve a ese estado.
 *
 * ## Teclado (patrón radiogroup de WAI-ARIA)
 *
 * - `Tab` entra al grupo una sola vez: cae en la estrella marcada, o en la
 *   primera cuando todavía no hay calificación (roving tabindex).
 * - `←`/`↑` y `→`/`↓` mueven el foco y marcan la estrella que reciben — es el
 *   comportamiento estándar de un grupo de radios. Los extremos no dan la
 *   vuelta: `←` sobre la primera la marca (así la estrella 1 siempre es
 *   alcanzable sin ratón).
 * - `Inicio`/`Fin` saltan a la primera/última y la marcan.
 * - `Espacio` marca la estrella enfocada — útil al entrar al grupo vacío sin
 *   haber movido el foco.
 * - `Suprimir`/`Retroceso` limpian la selección cuando `allowClear` está
 *   activo.
 *
 * ## Estados
 *
 * - **normal**: interactivo.
 * - **`disabled`**: no se puede usar ni enfocar (`aria-disabled` en el grupo).
 *   Lo activa el input homónimo o un `control.disable()` del formulario.
 * - **`readOnly`**: el valor está congelado pero se lee con contraste pleno y
 *   sigue siendo enfocable (`aria-readonly`). Distinto de `disabled` a
 *   propósito: «esto ya no se cambia» no es lo mismo que «esto no es para ti».
 * - **`error`**: mensaje visible (mismo contrato de `sol-input`: un texto, no
 *   un booleano), `aria-invalid` y `aria-describedby` sobre el grupo.
 *
 * La vista previa al pasar el ratón pinta las estrellas pero NUNCA toca
 * `value` ni `aria-checked`: al salir el puntero vuelve lo elegido, así que
 * pasar por encima jamás pierde la respuesta de la clienta.
 *
 * Objetivo táctil: cada estrella reserva un área real de 44×44 px (ley de
 * Fitts) porque se usa desde el celular; por eso el tamaño por defecto es
 * `lg` y no el `sm` del componente de solo lectura.
 *
 * ```html
 * <sol-rating-input
 *   formControlName="calificacion"
 *   ariaLabelKey="pages.appointment.rateVisit"
 *   [allowClear]="true"
 *   [error]="form.controls.calificacion.touched && form.controls.calificacion.invalid
 *     ? ('pages.appointment.rateRequired' | transloco) : ''"
 *   (ratingChanged)="registrar($event)"
 * />
 * ```
 */
@Component({
  selector: 'sol-rating-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolRatingInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="sol-rating-input" [class.sol-rating-input--error]="!!error()">
      <div class="sol-rating-input__row">
        <div
          class="sol-rating-input__group"
          role="radiogroup"
          [attr.aria-label]="groupLabel()"
          [attr.aria-disabled]="isDisabled() ? 'true' : null"
          [attr.aria-readonly]="readOnly() ? 'true' : null"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="error() ? errorId : null"
          (keydown)="onKeydown($event)"
          (focusout)="markTouched()"
          (mouseleave)="clearPreview()"
        >
          @for (star of stars; track star) {
            <button
              #starRef
              type="button"
              class="sol-rating-input__star"
              [class.sol-rating-input__star--on]="isFilled(star)"
              role="radio"
              [attr.aria-checked]="isChecked(star)"
              [attr.aria-label]="optionLabel(star)"
              [attr.tabindex]="tabIndexFor(star)"
              [disabled]="isDisabled()"
              (click)="select(star)"
              (focus)="onStarFocus(star)"
              (mouseenter)="preview(star)"
            >
              <sol-icon
                name="star"
                [variant]="isFilled(star) ? 'fill' : 'outline'"
                [size]="size()"
              />
            </button>
          }
        </div>

        @if (canClear()) {
          <button
            type="button"
            class="sol-rating-input__clear"
            [attr.aria-label]="clearLabel()"
            (click)="clear()"
          >
            <sol-icon name="x-mark" size="sm" />
          </button>
        }
      </div>

      @if (error()) {
        <span class="sol-rating-input__error" [id]="errorId" role="alert">{{ error() }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;

      /* Estrella elegida: el token de advertencia del tema ES el ámbar del
         sistema, así que la calificación se retematiza sola en claro y oscuro
         sin un color fijo — mismo criterio que sol-star-rating. */
      --sol-rating-input-on: var(--sol-color-warning);
      /* Estrella sin elegir: gris de texto atenuado (no la misma ámbar con
         opacidad). En un control interactivo el contraste entre "elegida" y
         "sin elegir" tiene que leerse de un vistazo. */
      --sol-rating-input-off: var(--sol-color-text-muted, #94a3b8);
      --sol-rating-input-danger: var(--sol-color-danger, #ef4444);
      --sol-rating-input-disabled-opacity: var(--sol-disabled-opacity, 0.55);
      --sol-rating-input-transition: var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
      --sol-rating-input-focus-ring: var(--sol-color-primary, #6366f1);
      /* Piso táctil real de 44×44 px (ley de Fitts): se usa desde el celular. */
      --sol-rating-input-hit: 44px;
    }

    .sol-rating-input {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-xs, 0.25rem);
    }

    .sol-rating-input__row {
      display: flex;
      align-items: center;
      gap: var(--sol-space-xs, 0.25rem);
    }

    .sol-rating-input__group {
      display: inline-flex;
      align-items: center;
    }

    .sol-rating-input__star {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--sol-rating-input-hit);
      min-height: var(--sol-rating-input-hit);
      padding: 0;
      border: none;
      background: transparent;
      color: var(--sol-rating-input-off);
      cursor: pointer;
      border-radius: var(--sol-border-radius-sm, 0.25rem);
      transition:
        color var(--sol-rating-input-transition),
        transform var(--sol-rating-input-transition);
      /* Sin esto, un toque sostenido en Android/iOS pinta el rectángulo gris
         del navegador sobre un control cuyo estado ya se comunica solo. */
      -webkit-tap-highlight-color: transparent;
    }

    .sol-rating-input__star--on {
      color: var(--sol-rating-input-on);
    }

    .sol-rating-input__star:focus-visible {
      outline: 2px solid var(--sol-rating-input-focus-ring);
      outline-offset: -2px;
    }

    .sol-rating-input__star:disabled {
      cursor: not-allowed;
    }

    .sol-rating-input__group:not([aria-disabled]):not([aria-readonly]) .sol-rating-input__star:hover {
      transform: scale(1.08);
    }

    .sol-rating-input__group[aria-disabled] {
      opacity: var(--sol-rating-input-disabled-opacity);
    }

    /* Solo lectura: contraste PLENO (a diferencia de deshabilitado) — el valor
       se sigue leyendo bien, solo deja de ser modificable. */
    .sol-rating-input__group[aria-readonly] .sol-rating-input__star {
      cursor: default;
    }

    /* Error: las estrellas que faltan por elegir se tiñen del color de peligro.
       El caso real es "calificación obligatoria sin responder", así que el aviso
       tiene que estar donde está el hueco, no solo en el texto de abajo. */
    .sol-rating-input--error .sol-rating-input__star:not(.sol-rating-input__star--on) {
      color: var(--sol-rating-input-danger);
    }

    .sol-rating-input__clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--sol-rating-input-hit);
      min-height: var(--sol-rating-input-hit);
      padding: 0;
      border: none;
      background: transparent;
      color: var(--sol-color-text-secondary, #475569);
      cursor: pointer;
      border-radius: var(--sol-border-radius-sm, 0.25rem);
      transition: color var(--sol-rating-input-transition);
    }

    .sol-rating-input__clear:hover {
      color: var(--sol-color-text-primary, #1e293b);
    }

    .sol-rating-input__clear:focus-visible {
      outline: 2px solid var(--sol-rating-input-focus-ring);
      outline-offset: -2px;
    }

    .sol-rating-input__error {
      font-size: var(--sol-font-size-sm, 0.75rem);
      color: var(--sol-rating-input-danger);
      line-height: 1.3;
    }

    @media (prefers-reduced-motion: reduce) {
      .sol-rating-input__star,
      .sol-rating-input__clear {
        transition: none;
      }

      .sol-rating-input__group:not([aria-disabled]):not([aria-readonly]) .sol-rating-input__star:hover {
        transform: none;
      }
    }
  `,
})
export class SolRatingInputComponent implements ControlValueAccessor {
  private readonly i18n = injectSolI18n();

  /** Botones de estrella renderizados, en el mismo orden que `stars`. */
  private readonly starRefs = viewChildren<ElementRef<HTMLButtonElement>>('starRef');

  private static nextId = 0;

  /** Id del mensaje de error, referenciado por `aria-describedby` del grupo. */
  protected readonly errorId = `sol-rating-input-error-${SolRatingInputComponent.nextId++}`;

  /** Tamaño de las estrellas. Hereda la escala de `sol-icon`. */
  readonly size = input<SolRatingInputSize>('lg');

  /** Bloquea el control por completo: ni se usa ni se enfoca. */
  readonly disabled = input<boolean>(false);

  /** Congela el valor conservando contraste y foco (`aria-readonly`). */
  readonly readOnly = input<boolean>(false);

  /** Mensaje de error visible. Cadena vacía = sin error (contrato de `sol-input`). */
  readonly error = input<string>('');

  /** Habilita quitar la calificación ya dada (botón visible + Suprimir/Retroceso). */
  readonly allowClear = input<boolean>(false);

  /** Clave i18n del nombre accesible del grupo. */
  readonly ariaLabelKey = input<string>('shared.ratingInput.groupLabel');

  /** Clave i18n del nombre accesible de cada estrella (recibe `value` y `max`). */
  readonly optionLabelKey = input<string>('shared.ratingInput.option');

  /** Clave i18n del botón que quita la calificación. */
  readonly clearLabelKey = input<string>('shared.ratingInput.clear');

  /** Emite la calificación elegida, o `null` cuando se limpia. */
  readonly ratingChanged = output<number | null>();

  /**
   * Calificación actual. `null` = sin responder — el estado inicial, a
   * propósito (ver el JSDoc de la clase).
   */
  readonly value = signal<number | null>(null);

  /** Estrella bajo el puntero. Solo pinta: nunca cambia `value`. */
  private readonly previewValue = signal<number | null>(null);

  /** Última estrella enfocada; manda sobre `value` para el roving tabindex. */
  private readonly focusedIndex = signal<number | null>(null);

  /** Valores del `@for`: las 5 estrellas, de 1 a 5. */
  protected readonly stars = Array.from({ length: MAX_STARS }, (_, i) => i + 1);

  /**
   * Deshabilitado desde el formulario (`control.disable()`), independiente del
   * input `disabled`.
   */
  private readonly formDisabled = signal(false);

  /**
   * Deshabilitado efectivo: el input del consumidor O el estado del formulario.
   *
   * Diverge a propósito de los controles más viejos de la librería
   * (`sol-select`, `sol-number-input`), que dejan `setDisabledState` vacío y
   * solo miran su input: con `[formControl]`, un `control.disable()` los deja
   * plenamente usables. Aquí el formulario SÍ manda, que es lo que un
   * `ControlValueAccessor` promete.
   */
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  /** `true` cuando el control admite cambios (ni deshabilitado ni de solo lectura). */
  protected readonly interactive = computed(() => !this.isDisabled() && !this.readOnly());

  /** El botón de limpiar solo existe si hay algo que limpiar y se puede. */
  protected readonly canClear = computed(
    () => this.allowClear() && this.value() !== null && this.interactive(),
  );

  /**
   * Índice (base 0) de la única estrella que participa del orden de tabulación:
   * la enfocada por última vez, si no la marcada, y si tampoco hay, la primera.
   * Nunca depende de la vista previa del ratón.
   */
  protected readonly rovingIndex = computed(() => {
    const focused = this.focusedIndex();
    if (focused !== null) return focused;
    const current = this.value();
    return current !== null ? current - 1 : 0;
  });

  protected readonly groupLabel = computed(() =>
    this.text(this.ariaLabelKey(), 'Rating from 1 to 5 stars'),
  );

  protected readonly clearLabel = computed(() =>
    this.text(this.clearLabelKey(), 'Clear the rating'),
  );

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  /** `aria-checked` de la estrella: mira SOLO el valor, jamás la vista previa. */
  protected isChecked(star: number): boolean {
    return this.value() === star;
  }

  /** Pintado: la vista previa manda sobre el valor mientras el puntero esté encima. */
  protected isFilled(star: number): boolean {
    const reference = this.previewValue() ?? this.value();
    return reference !== null && star <= reference;
  }

  protected tabIndexFor(star: number): number {
    return star - 1 === this.rovingIndex() ? 0 : -1;
  }

  protected optionLabel(star: number): string {
    return this.text(this.optionLabelKey(), `${star} of ${MAX_STARS}`, {
      value: star,
      max: MAX_STARS,
    });
  }

  protected onStarFocus(star: number): void {
    this.focusedIndex.set(star - 1);
  }

  protected preview(star: number): void {
    if (!this.interactive()) return;
    this.previewValue.set(star);
  }

  protected clearPreview(): void {
    this.previewValue.set(null);
  }

  protected markTouched(): void {
    this.onTouched();
  }

  /**
   * Marca una estrella. Reemite solo si el valor cambió de verdad.
   *
   * Normaliza la entrada (`1..5`) antes de tocar nada: la plantilla nunca
   * manda un valor fuera de escala, pero este método es público y un consumidor
   * podría llamarlo con cualquier número — una calificación de 9 rompería el
   * `aria-checked` de las cinco estrellas.
   */
  select(star: number): void {
    if (!this.interactive()) return;
    const next = normalizeRating(star);
    if (next === null) return;
    this.focusedIndex.set(next - 1);
    if (this.value() === next) return;
    this.value.set(next);
    this.onChange(next);
    this.ratingChanged.emit(next);
    this.onTouched();
  }

  /** Vuelve al estado «sin responder». Requiere `allowClear`. */
  clear(): void {
    if (!this.interactive() || !this.allowClear()) return;
    if (this.value() === null) return;
    this.value.set(null);
    this.previewValue.set(null);
    this.onChange(null);
    this.ratingChanged.emit(null);
    this.onTouched();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.interactive()) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!this.allowClear() || this.value() === null) return;
      event.preventDefault();
      this.clear();
      return;
    }

    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.select(this.rovingIndex() + 1);
      return;
    }

    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const home = event.key === 'Home';
    const end = event.key === 'End';
    if (!forward && !backward && !home && !end) return;

    event.preventDefault();

    const current = this.rovingIndex();
    let next: number;
    if (home) next = 0;
    else if (end) next = MAX_STARS - 1;
    // Sin vuelta en los extremos: `←` sobre la primera la deja ahí y la marca,
    // que es la única forma de elegir "1" con teclado desde el grupo vacío.
    else if (forward) next = Math.min(current + 1, MAX_STARS - 1);
    else next = Math.max(current - 1, 0);

    this.select(next + 1);
    this.focusStar(next);
  }

  /**
   * Mueve el foco a la estrella `index` (base 0) por referencia de plantilla,
   * sin depender de selectores CSS internos — mismo criterio que `sol-chip-group`.
   */
  private focusStar(index: number): void {
    this.starRefs()[index]?.nativeElement.focus();
  }

  /**
   * Resuelve un texto por i18n con respaldo propio en inglés.
   *
   * El contrato `SolI18n` devuelve la CLAVE cuando falta la traducción, así que
   * ese caso se detecta y se cae al texto de la casa en vez de anunciarle la
   * clave cruda a un lector de pantalla — mismo criterio de `sol-star-rating`.
   */
  private text(key: string, fallback: string, params?: Record<string, unknown>): string {
    this.i18n.activeLang();
    const translated = this.i18n.translate(key, params);
    return translated && translated !== key ? translated : fallback;
  }

  // ── ControlValueAccessor ──

  /**
   * Normaliza lo que llegue del formulario a `1..5` o `null`. Un `0`, un `NaN`
   * o un `undefined` significan «sin responder», no «cero estrellas»: la escala
   * empieza en 1 y el vacío tiene que seguir siendo distinguible.
   */
  writeValue(value: number | null): void {
    this.value.set(normalizeRating(value));
    this.previewValue.set(null);
    this.focusedIndex.set(null);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}

/** Recorta cualquier entrada a una calificación válida (`1..5`) o a `null`. */
export function normalizeRating(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined || !Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  if (rounded < 1) return null;
  return Math.min(rounded, MAX_STARS);
}

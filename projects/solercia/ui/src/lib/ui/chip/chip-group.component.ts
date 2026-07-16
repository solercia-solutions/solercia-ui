import {
  Component,
  ChangeDetectionStrategy,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolChipComponent, type SolChipSize } from './chip.component';
import {
  MULTIPLE_SELECT_STRATEGY,
  SINGLE_SELECT_STRATEGY,
  type SolChipSelectionStrategy,
} from './chip-selection.strategy';

export interface SolChipOption {
  value: string;
  label: string;
  emoji?: string;
  disabled?: boolean;
  count?: number;
}

/**
 * `sol-chip-group` — grupo de selección con chips (11-f PR2, ciclo 3 UX).
 *
 * CVA (patrón `sol-select`): en modo `single` el valor es un `string`
 * (`''` cuando nada está seleccionado); en modo `multiple` es un `string[]`.
 * Esta FORMA del valor la decide `multiple()` directamente en `writeValue`/
 * `emitValue` — es un concepto aparte de la Strategy de abajo, y SÍ ramifica
 * sobre `multiple()` a propósito.
 *
 * La política de selección — qué CONJUNTO queda seleccionado tras activar un
 * chip, y qué rol ARIA usar — vive detrás de `SolChipSelectionStrategy`
 * (Strategy, Open/Closed): el template y los manejadores de activación
 * llaman siempre a `strategy().isSelected(...)`, `strategy().select(...)`,
 * `strategy().chipRole` y `strategy().groupRole`, nunca `@if (multiple())`
 * para decidir el conjunto. Agregar una política nueva es agregar una
 * Strategy nueva, no ramificar esta clase.
 *
 * Roving tabindex: `tabIndexFor` usa `rovingIndex()`, que NUNCA apunta a una
 * opción `disabled` — si `activeIndex()` señala una deshabilitada (p.ej. la
 * primera opción del arreglo llegó `disabled`), recae en la primera opción
 * habilitada. Sin esta guarda el grupo entero queda fuera del orden de Tab,
 * porque `sol-chip` fuerza `tabindex="-1"` en cualquier chip deshabilitado.
 *
 * CVA idempotente: si activar un chip no cambia el conjunto seleccionado
 * resultante (p.ej. reactivar el ya seleccionado con `allowDeselect=false`),
 * NO se reinvoca `onChange` — misma guarda por igualdad que
 * `SolNumberInputComponent.setValue`.
 *
 * Teclado: roving tabindex con flechas (◀▶ u ◀▲▼▶, todas aceptadas) +
 * Home/End para mover el foco entre chips habilitados. Las flechas SOLO
 * mueven el foco — nunca seleccionan por sí solas — la (de)selección
 * siempre requiere una activación explícita (click, Enter o Espacio sobre
 * el chip enfocado). Esto es deliberadamente uniforme entre `single` y
 * `multiple`: un radiogroup nativo del navegador selecciona al navegar con
 * flechas, pero replicar eso aquí haría que single y multiple se
 * comportaran distinto ante el mismo gesto de teclado, y podría cambiar el
 * valor del formulario mientras el usuario solo está explorando las
 * opciones. Ver `SolChipSelectionStrategy.groupRole` para la justificación
 * del rol ARIA del contenedor.
 */
@Component({
  selector: 'sol-chip-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolChipComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolChipGroupComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="sol-chip-group"
      [attr.role]="strategy().groupRole"
      [attr.aria-label]="groupAriaLabel()"
      [attr.aria-disabled]="disabled() || null"
      (keydown)="onKeydown($event)"
    >
      @for (opt of options(); track opt.value; let i = $index) {
        <sol-chip
          [value]="opt.value"
          [label]="opt.label"
          [emoji]="opt.emoji ?? ''"
          [count]="opt.count ?? null"
          [selected]="isSelected(opt.value)"
          [disabled]="disabled() || !!opt.disabled"
          [size]="size()"
          [role]="strategy().chipRole"
          [tabIndex]="tabIndexFor(i)"
          [removable]="removable()"
          [removeLabelKey]="removeLabelKey()"
          (toggled)="onChipToggled($event)"
          (removed)="onChipRemoved($event)"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sol-chip-group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sol-space-sm, 0.5rem);
    }
  `,
})
export class SolChipGroupComponent implements ControlValueAccessor {
  private readonly i18n = inject(SOL_I18N);
  /** Instancias renderizadas de `sol-chip`, en el mismo orden que `options()` — usadas por `focusChipAt` para enfocar sin depender de clases CSS internas. */
  private readonly chipViews = viewChildren(SolChipComponent);

  /** Options to render, in order. */
  readonly options = input.required<SolChipOption[]>();
  /** `false` (default): single-select (radiogroup). `true`: multi-select (group of checkboxes). */
  readonly multiple = input<boolean>(false);
  /** Single-select only: whether re-activating the already-selected chip clears the selection. */
  readonly allowDeselect = input<boolean>(true);
  readonly disabled = input<boolean>(false);
  readonly size = input<SolChipSize>('md');
  /** Shows a trailing "remove" icon-button on every chip (force-deselects regardless of `allowDeselect`). */
  readonly removable = input<boolean>(false);
  /** i18n key for the group's accessible name — required: every instance describes a different domain choice (e.g. "Filtrar por categoría"), so there is no sensible built-in default. */
  readonly ariaLabelKey = input.required<string>();
  /** i18n key for each chip's "remove" button accessible name. */
  readonly removeLabelKey = input<string>('shared.chip.remove');

  private readonly selectedValues = signal<string[]>([]);
  private readonly activeIndex = signal(0);

  readonly strategy = computed<SolChipSelectionStrategy>(() =>
    this.multiple() ? MULTIPLE_SELECT_STRATEGY : SINGLE_SELECT_STRATEGY,
  );

  /**
   * Roving-tabindex efectivo: `activeIndex()` si esa opción está habilitada;
   * si no, el índice de la PRIMERA opción habilitada (`-1` si ninguna lo
   * está). Ver el JSDoc de la clase.
   */
  readonly rovingIndex = computed(() => {
    const opts = this.options();
    const active = this.activeIndex();
    if (opts[active] && !opts[active].disabled) return active;
    return opts.findIndex(o => !o.disabled);
  });

  readonly groupAriaLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(this.ariaLabelKey());
  });

  private onChange: (value: string | string[]) => void = () => {};
  private onTouched: () => void = () => {};

  isSelected(value: string): boolean {
    return this.strategy().isSelected(this.selectedValues(), value);
  }

  tabIndexFor(index: number): number {
    return index === this.rovingIndex() ? 0 : -1;
  }

  onChipToggled(value: string): void {
    if (this.disabled()) return;
    const opt = this.options().find(o => o.value === value);
    // Revalidación defensiva: `opt.disabled` es por-opción (independiente de
    // `disabled()` del grupo), y el evento `toggled` puede llegar igual si
    // el DOM se manipula por fuera del flujo normal de click/teclado.
    if (!opt || opt.disabled) return;

    this.activeIndex.set(this.options().findIndex(o => o.value === value));
    const previous = this.selectedValues();
    const next = this.strategy().select(previous, value, this.allowDeselect());
    this.selectedValues.set(next);
    this.onTouched();
    this.emitValue(next, previous);
  }

  onChipRemoved(value: string): void {
    if (this.disabled()) return;
    const previous = this.selectedValues();
    const next = previous.filter(v => v !== value);
    this.selectedValues.set(next);
    this.onTouched();
    this.emitValue(next, previous);
  }

  /**
   * Emite el valor CVA solo si el conjunto seleccionado cambió respecto al
   * anterior (comparación por contenido) — evita reemitir el mismo valor
   * cuando, p.ej., `allowDeselect=false` y se reactiva el chip ya
   * seleccionado.
   */
  private emitValue(next: string[], previous: string[]): void {
    if (this.sameValues(next, previous)) return;
    this.onChange(this.multiple() ? next : (next[0] ?? ''));
  }

  private sameValues(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  private focusableIndexes(): number[] {
    return this.options()
      .map((_, i) => i)
      .filter(i => !this.options()[i].disabled);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;

    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const home = event.key === 'Home';
    const end = event.key === 'End';
    if (!forward && !backward && !home && !end) return;

    const focusable = this.focusableIndexes();
    if (focusable.length === 0) return;

    const currentPos = focusable.indexOf(this.rovingIndex());
    let nextPos: number;
    if (home) nextPos = 0;
    else if (end) nextPos = focusable.length - 1;
    else if (currentPos === -1) nextPos = 0;
    else if (forward) nextPos = Math.min(currentPos + 1, focusable.length - 1);
    else nextPos = Math.max(currentPos - 1, 0);

    event.preventDefault();
    const nextIndex = focusable[nextPos];
    this.activeIndex.set(nextIndex);
    this.focusChipAt(nextIndex);
  }

  private focusChipAt(index: number): void {
    this.chipViews()[index]?.focus();
  }

  // ── ControlValueAccessor ──

  writeValue(value: string | string[] | null): void {
    if (this.multiple()) {
      this.selectedValues.set(Array.isArray(value) ? value.map(String) : []);
    } else {
      this.selectedValues.set(value != null && value !== '' ? [String(value)] : []);
    }
  }

  registerOnChange(fn: (value: string | string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(_isDisabled: boolean): void {
    // Handled via the `disabled()` input binding, same convention as sol-select.
  }
}

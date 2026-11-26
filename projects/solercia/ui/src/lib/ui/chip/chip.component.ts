import {
  Component,
  ChangeDetectionStrategy,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolIconComponent } from '../icon/icon.component';

export type SolChipRole = 'button' | 'radio' | 'checkbox';
export type SolChipSize = 'sm' | 'md';

/**
 * `sol-chip` — átomo presentacional de selección (11-f PR2, ciclo 3 UX).
 *
 * Standalone (fuera de un `sol-chip-group`) es un botón de alternancia
 * simple: `role="button"` + `aria-pressed`. Dentro de un `sol-chip-group`,
 * el grupo le inyecta `role` (`radio`|`checkbox`, elegido por la Strategy de
 * selección — ver `chip-selection.strategy.ts`) y `tabIndex` (roving
 * tabindex); en ese caso el chip expone `aria-checked` en vez de
 * `aria-pressed` (semántica correcta de ARIA para ambos roles).
 *
 * El elemento raíz interactivo es un `<div>` con rol ARIA explícito, NO un
 * `<button>`: cuando `removable()` está activo se necesita anidar un
 * `<button>` real para la acción de quitar, y un `<button>` no puede
 * contener otro `<button>` (contenido interactivo anidado inválido en
 * HTML). Al ser un `<div>`, Enter/Espacio se manejan a mano en
 * `onKeydown()` — un `<div>` no los activa nativamente.
 *
 * Móvil: el chip NO contiene ningún `<input>` de texto (es un botón/rol
 * interactivo puro), así que el criterio de zoom de iOS Safari del fix de
 * PR1 (`font-size:16px` en `@media (max-width:640px)`) no aplica aquí — no
 * hay ningún campo de texto que dispare el zoom.
 */
@Component({
  selector: 'sol-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  template: `
    <div class="sol-chip-wrapper" [class.sol-chip-wrapper--selected]="selected()">
      <div
        #chipRoot
        class="sol-chip"
        [class.sol-chip--selected]="selected()"
        [class.sol-chip--disabled]="disabled()"
        [class.sol-chip--sm]="size() === 'sm'"
        [attr.role]="role()"
        [attr.aria-pressed]="role() === 'button' ? selected() : null"
        [attr.aria-checked]="role() !== 'button' ? selected() : null"
        [attr.aria-disabled]="disabled() || null"
        [attr.tabindex]="disabled() ? -1 : tabIndex()"
        (click)="onActivate()"
        (keydown)="onKeydown($event)"
      >
        @if (emoji()) {
          <span class="sol-chip__emoji" aria-hidden="true">{{ emoji() }}</span>
        }
        <span class="sol-chip__label">{{ label() }}</span>
        @if (count() != null) {
          <span class="sol-chip__count">{{ count() }}</span>
        }
      </div>

      @if (removable()) {
        <button
          type="button"
          class="sol-chip__remove"
          [attr.aria-label]="removeLabel()"
          [disabled]="disabled()"
          (click)="onRemove($event)"
        >
          <sol-icon name="x" size="sm" />
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      --sol-chip-bg: var(--sol-bg-page, #f1f5f9);
      --sol-chip-text: var(--sol-color-text-secondary, #475569);
      --sol-chip-border: var(--sol-border-color-default, #cbd5e1);
      --sol-chip-selected-bg: var(--sol-color-primary, #6366f1);
      --sol-chip-selected-text: var(--sol-color-primary-contrast, #ffffff);
      --sol-chip-hover-bg: var(--sol-color-bg-hover, rgba(0, 0, 0, 0.04));
      --sol-chip-danger: var(--sol-color-danger, #ef4444);
      --sol-chip-focus-ring: var(--sol-color-primary, #6366f1);
      --sol-chip-disabled-opacity: var(--sol-disabled-opacity, 0.55);
      --sol-chip-radius: var(--sol-border-radius-full, 9999px);
      --sol-chip-font-size: var(--sol-font-size-sm, 0.8125rem);
      --sol-chip-font-size-sm: var(--sol-font-size-xs, 0.6875rem);
      --sol-chip-transition: var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
    }

    .sol-chip-wrapper {
      display: inline-flex;
      align-items: stretch;
      border-radius: var(--sol-chip-radius);
      overflow: hidden;
    }

    .sol-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      font-family: var(--sol-font-family);
      font-size: var(--sol-chip-font-size);
      font-weight: 500;
      line-height: 1.2;
      color: var(--sol-chip-text);
      background: var(--sol-chip-bg);
      border: 1px solid var(--sol-chip-border);
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: background-color var(--sol-chip-transition), color var(--sol-chip-transition),
        border-color var(--sol-chip-transition);
    }

    .sol-chip--sm {
      padding: 4px 10px;
      font-size: var(--sol-chip-font-size-sm);
    }

    .sol-chip:hover:not(.sol-chip--disabled) {
      background: var(--sol-chip-hover-bg);
    }

    .sol-chip:focus-visible {
      outline: 2px solid var(--sol-chip-focus-ring);
      outline-offset: 2px;
    }

    .sol-chip--selected {
      background: var(--sol-chip-selected-bg);
      border-color: var(--sol-chip-selected-bg);
      color: var(--sol-chip-selected-text);
    }

    .sol-chip--disabled {
      cursor: not-allowed;
      opacity: var(--sol-chip-disabled-opacity);
    }

    .sol-chip__emoji {
      font-size: 1em;
      line-height: 1;
    }

    .sol-chip__count {
      font-size: 0.85em;
      font-weight: 600;
      opacity: 0.75;
    }

    .sol-chip__remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 10px;
      border: 1px solid var(--sol-chip-border);
      border-left: none;
      background: var(--sol-chip-bg);
      color: var(--sol-chip-text);
      cursor: pointer;
      transition: background-color var(--sol-chip-transition), color var(--sol-chip-transition);
    }

    .sol-chip-wrapper--selected .sol-chip__remove {
      background: var(--sol-chip-selected-bg);
      border-color: var(--sol-chip-selected-bg);
      color: var(--sol-chip-selected-text);
    }

    .sol-chip__remove:hover:not(:disabled) {
      background: var(--sol-chip-danger);
      border-color: var(--sol-chip-danger);
      color: #ffffff;
    }

    .sol-chip__remove:focus-visible {
      outline: 2px solid var(--sol-chip-focus-ring);
      outline-offset: -2px;
    }

    .sol-chip__remove:disabled {
      cursor: not-allowed;
      opacity: var(--sol-chip-disabled-opacity);
    }
  `,
})
export class SolChipComponent {
  private readonly i18n = injectSolI18n();
  private readonly chipRoot = viewChild.required<ElementRef<HTMLElement>>('chipRoot');

  /** Stable identifier emitted by `toggled`/`removed`. */
  readonly value = input.required<string>();
  /** Visible text. Plain string — same convention as `SolSelectOption.label`: the caller resolves i18n before passing dynamic/business data in. */
  readonly label = input.required<string>();
  /** Optional leading emoji. Decorative — rendered `aria-hidden`, the accessible name comes from `label`. */
  readonly emoji = input<string>('');
  /** Optional trailing counter (e.g. number of matching items). */
  readonly count = input<number | null>(null);
  readonly selected = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly size = input<SolChipSize>('md');
  /** Shows a trailing "remove" icon-button that emits `removed` instead of `toggled`. */
  readonly removable = input<boolean>(false);
  /** ARIA role. Set by `sol-chip-group`; defaults to a plain toggle button for standalone usage. */
  readonly role = input<SolChipRole>('button');
  /** Roving-tabindex value. Set by `sol-chip-group`; defaults to focusable (0) for standalone usage. */
  readonly tabIndex = input<number>(0);
  /** i18n key for the remove button's accessible name. */
  readonly removeLabelKey = input<string>('shared.chip.remove');

  readonly toggled = output<string>();
  readonly removed = output<string>();

  readonly removeLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(this.removeLabelKey());
  });

  /** Focuses the chip's interactive root element. Called by `sol-chip-group`'s roving tabindex via `viewChildren(SolChipComponent)`, so the group never needs to query internal CSS classes. */
  focus(): void {
    this.chipRoot().nativeElement.focus();
  }

  onActivate(): void {
    if (this.disabled()) return;
    this.toggled.emit(this.value());
  }

  onRemove(event: Event): void {
    event.stopPropagation();
    if (this.disabled()) return;
    this.removed.emit(this.value());
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key === 'Enter' || event.key === ' ') {
      // preventDefault first: on a real <button> this would suppress the
      // browser's own Enter/Space→click synthesis, avoiding a double toggle.
      // Here the root is a <div>, which never auto-activates on keydown, so
      // this call is the ONLY thing that triggers the action.
      event.preventDefault();
      this.onActivate();
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { SolIconComponent } from '../icon/icon.component';
import type { SolIconName } from '../icon/icon.component';

/** Estilo visual del botón de ícono, alineado con las variantes de `sol-button`. */
export type SolIconButtonVariant = 'default' | 'danger' | 'ghost';

/** Tamaño (cuadrado) del botón de ícono. */
export type SolIconButtonSize = 'sm' | 'md' | 'lg';

/**
 * Botón cuadrado de solo ícono, con `aria-label` obligatorio por accesibilidad.
 * El ícono sale del registry de la librería vía `sol-icon` (nunca SVG inline).
 * Tematizado con `var(--sol-*)` — soporta light y dark.
 *
 * Uso:
 * ```html
 * <sol-icon-button icon="edit" ariaLabel="Editar" (clicked)="editar()" />
 * <sol-icon-button icon="trash" variant="danger" ariaLabel="Eliminar" (clicked)="eliminar()" />
 * ```
 */
@Component({
  selector: 'sol-icon-button',
  standalone: true,
  imports: [SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [class]="cssClass()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      (click)="onClick($event)"
    >
      <sol-icon [name]="icon()" [size]="size()" />
    </button>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .sol-icon-btn {
      display: grid;
      place-items: center;
      padding: 0;
      border: 1px solid transparent;
      border-radius: var(--sol-button-radius, var(--sol-border-radius-md, 0.5rem));
      background: transparent;
      color: var(--sol-color-text-muted, #64748b);
      cursor: pointer;
      transition:
        background-color var(--sol-dur-fast, 150ms) var(--sol-ease, ease),
        color var(--sol-dur-fast, 150ms) var(--sol-ease, ease),
        box-shadow var(--sol-dur-fast, 150ms) var(--sol-ease, ease),
        transform var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
    }

    .sol-icon-btn:active:not(:disabled) {
      transform: scale(var(--sol-press-scale, 0.96));
    }

    .sol-icon-btn:focus-visible {
      outline: none;
      box-shadow: var(--sol-focus-ring, 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #6366f1) 40%, transparent));
    }

    .sol-icon-btn:disabled {
      cursor: not-allowed;
      opacity: var(--sol-disabled-opacity, 0.55);
    }

    /* ---- variants ---- */

    .sol-icon-btn--default {
      border-color: var(--sol-border-color-default, #e2e8f0);
      background: var(--sol-bg-surface, #fff);
      color: var(--sol-color-text-muted, #64748b);
    }
    .sol-icon-btn--default:hover:not(:disabled) {
      background: color-mix(in srgb, var(--sol-color-primary, #2563eb) 8%, var(--sol-bg-surface, #fff));
      color: var(--sol-color-text-primary, #0f172a);
    }

    .sol-icon-btn--danger {
      color: var(--sol-color-danger, #ef4444);
    }
    .sol-icon-btn--danger:hover:not(:disabled) {
      background: color-mix(in srgb, var(--sol-color-danger, #ef4444) 12%, transparent);
    }

    .sol-icon-btn--ghost {
      color: var(--sol-color-text-muted, #64748b);
    }
    .sol-icon-btn--ghost:hover:not(:disabled) {
      background: color-mix(in srgb, var(--sol-color-primary, #2563eb) 10%, transparent);
      color: var(--sol-color-text-primary, #0f172a);
    }

    /* ---- sizes (cuadrado, alineado con las alturas de sol-button) ---- */

    .sol-icon-btn--sm { width: 32px; height: 32px; }
    .sol-icon-btn--md { width: 36px; height: 36px; }
    .sol-icon-btn--lg { width: 40px; height: 40px; }
  `,
})
export class SolIconButtonComponent {
  /** Ícono del registry a mostrar. Obligatorio. */
  readonly icon = input.required<SolIconName>();

  /** Etiqueta accesible obligatoria (el botón no tiene texto visible). */
  readonly ariaLabel = input.required<string>();

  /** Atributo `type` nativo del botón. */
  readonly type = input<'button' | 'submit'>('button');

  /** Estilo visual. */
  readonly variant = input<SolIconButtonVariant>('default');

  /** Tamaño cuadrado. */
  readonly size = input<SolIconButtonSize>('md');

  /** Deshabilita el botón. */
  readonly disabled = input<boolean>(false);

  /** Se emite al hacer clic cuando el botón no está deshabilitado. */
  readonly clicked = output<void>();

  /** Clases CSS combinando variante y tamaño. */
  readonly cssClass = computed(
    () => `sol-icon-btn sol-icon-btn--${this.variant()} sol-icon-btn--${this.size()}`,
  );

  onClick(event: MouseEvent): void {
    if (this.disabled()) {
      event.stopPropagation();
      return;
    }
    this.clicked.emit();
  }
}

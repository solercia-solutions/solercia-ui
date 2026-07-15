import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

export type SolButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type SolButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'sol-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [class]="cssClass()"
      [disabled]="disabled() || loading()"
      (click)="onClick($event)"
    >
      @if (loading()) {
        <svg
          class="sol-btn__spinner"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-dasharray="31.4 31.4"
            stroke-linecap="round"
          />
        </svg>
      }
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: inline-block;

      /* ---- colour tokens ---- */
      --sol-btn-primary-bg: var(--sol-color-primary, #6366f1);
      --sol-btn-primary-text: var(--sol-color-primary-contrast, #ffffff);
      --sol-btn-secondary-bg: var(--sol-color-secondary, #e2e8f0);
      --sol-btn-secondary-text: var(--sol-color-secondary-contrast, #1e293b);
      --sol-btn-danger-bg: var(--sol-color-danger, #ef4444);
      --sol-btn-danger-text: var(--sol-color-danger-contrast, #ffffff);
      --sol-btn-ghost-bg: transparent;
      --sol-btn-ghost-text: var(--sol-color-primary, #6366f1);

      /* ---- size tokens ---- */
      --sol-btn-font-sm: var(--sol-font-size-sm, 0.75rem);
      --sol-btn-font-md: var(--sol-font-size-md, 0.875rem);
      --sol-btn-font-lg: var(--sol-font-size-lg, 1rem);
      --sol-btn-padding-sm: var(--sol-spacing-xs, 0.25rem) var(--sol-spacing-sm, 0.5rem);
      --sol-btn-padding-md: var(--sol-spacing-sm, 0.5rem) var(--sol-spacing-md, 1rem);
      --sol-btn-padding-lg: var(--sol-spacing-md, 0.75rem) var(--sol-spacing-lg, 1.5rem);

      /* ---- shared tokens (v2: forma y carácter del botón salen del tema) ---- */
      --sol-btn-radius: var(--sol-button-radius, var(--sol-border-radius-md, 0.5rem));
      --sol-btn-font-weight: var(--sol-button-weight, 500);
      --sol-btn-transition: var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
      --sol-btn-focus-ring: var(--sol-focus-ring, 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #6366f1) 40%, transparent));
      --sol-btn-disabled-opacity: var(--sol-disabled-opacity, 0.55);
    }

    .sol-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5em;
      border: none;
      border-radius: var(--sol-btn-radius);
      box-shadow: var(--sol-button-shadow, none);
      font-family: inherit;
      font-weight: var(--sol-btn-font-weight);
      text-transform: var(--sol-button-transform, none);
      line-height: 1;
      cursor: pointer;
      transition: background-color var(--sol-btn-transition),
                  box-shadow var(--sol-btn-transition),
                  transform var(--sol-btn-transition),
                  filter var(--sol-btn-transition),
                  opacity var(--sol-btn-transition);
      white-space: nowrap;
      user-select: none;
    }

    /* Press scale del tema (v2): aplica a todas las variantes. */
    .sol-btn:active:not(:disabled) {
      transform: scale(var(--sol-press-scale, 0.98));
    }

    .sol-btn:focus-visible {
      outline: none;
      box-shadow: var(--sol-btn-focus-ring);
    }

    .sol-btn:disabled {
      cursor: not-allowed;
      opacity: var(--sol-btn-disabled-opacity);
    }

    /* ---- variants ---- */

    .sol-btn--primary {
      background-color: var(--sol-btn-primary-bg);
      color: var(--sol-btn-primary-text);
    }
    .sol-btn--primary:hover:not(:disabled) {
      filter: brightness(1.1);
    }
    .sol-btn--primary:active:not(:disabled) {
      filter: brightness(0.95);
    }

    .sol-btn--secondary {
      background-color: var(--sol-btn-secondary-bg);
      color: var(--sol-btn-secondary-text);
    }
    .sol-btn--secondary:hover:not(:disabled) {
      background-color: color-mix(in srgb, var(--sol-btn-secondary-bg) 80%, black);
    }
    .sol-btn--secondary:active:not(:disabled) {
      background-color: color-mix(in srgb, var(--sol-btn-secondary-bg) 70%, black);
    }

    .sol-btn--danger {
      background-color: var(--sol-btn-danger-bg);
      color: var(--sol-btn-danger-text);
    }
    .sol-btn--danger:hover:not(:disabled) {
      background-color: color-mix(in srgb, var(--sol-btn-danger-bg) 85%, black);
    }
    .sol-btn--danger:active:not(:disabled) {
      background-color: color-mix(in srgb, var(--sol-btn-danger-bg) 75%, black);
    }

    .sol-btn--ghost {
      background-color: var(--sol-btn-ghost-bg);
      color: var(--sol-btn-ghost-text);
    }
    .sol-btn--ghost:hover:not(:disabled) {
      background-color: color-mix(in srgb, var(--sol-btn-ghost-text) 10%, transparent);
    }
    .sol-btn--ghost:active:not(:disabled) {
      background-color: color-mix(in srgb, var(--sol-btn-ghost-text) 18%, transparent);
    }

    /* ---- sizes ---- */

    .sol-btn--sm {
      font-size: var(--sol-font-size-sm, 12px);
      height: 32px;
      padding: 0 12px;
    }
    .sol-btn--md {
      font-size: var(--sol-font-size-base, 14px);
      height: 36px;
      padding: 0 16px;
    }
    .sol-btn--lg {
      font-size: var(--sol-font-size-base, 14px);
      height: 40px;
      padding: 0 20px;
    }

    /* ---- spinner ---- */

    .sol-btn__spinner {
      width: 1em;
      height: 1em;
      flex-shrink: 0;
      animation: sol-spin 0.75s linear infinite;
    }

    @keyframes sol-spin {
      to { transform: rotate(360deg); }
    }
  `,
})
export class SolButtonComponent {
  /** Visual style variant. */
  readonly variant = input<SolButtonVariant>('primary');

  /** Size preset. */
  readonly size = input<SolButtonSize>('md');

  /** Whether the button is disabled. */
  readonly disabled = input<boolean>(false);

  /** Native button type attribute. */
  readonly type = input<string>('button');

  /** Shows a spinner and disables the button. */
  readonly loading = input<boolean>(false);

  /** Emitted on click when the button is not disabled or loading. */
  readonly clicked = output<void>();

  /** Computed CSS class string combining variant and size modifiers. */
  readonly cssClass = computed(
    () => `sol-btn sol-btn--${this.variant()} sol-btn--${this.size()}`,
  );

  onClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) {
      event.stopPropagation();
      return;
    }
    this.clicked.emit();
  }
}

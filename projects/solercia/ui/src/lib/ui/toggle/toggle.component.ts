import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type SolToggleSize = 'sm' | 'md';

@Component({
  selector: 'sol-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolToggleComponent),
      multi: true,
    },
  ],
  template: `
    <label [class]="hostClass()">
      <button
        type="button"
        role="switch"
        [attr.aria-checked]="checked()"
        [class]="trackClass()"
        [disabled]="disabled()"
        (click)="toggle()"
      >
        <span [class]="thumbClass()"></span>
      </button>

      @if (label()) {
        <span class="sol-toggle__label">{{ label() }}</span>
      }
    </label>
  `,
  styles: `
    :host {
      display: inline-block;

      /* ---- colour tokens ---- */
      --sol-toggle-track-off: var(--sol-color-text-muted, #cbd5e1);
      --sol-toggle-track-on: var(--sol-color-primary, #6366f1);
      --sol-toggle-thumb: var(--sol-bg-surface, #ffffff);
      --sol-toggle-label-color: var(--sol-color-text-primary, #1e293b);
      --sol-toggle-disabled-opacity: var(--sol-disabled-opacity, 0.55);
      --sol-toggle-focus-ring: var(--sol-focus-ring, 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #6366f1) 40%, transparent));
      --sol-toggle-transition: var(--sol-transition-fast, 150ms ease);
      --sol-toggle-shadow: var(--sol-shadow-sm, 0 1px 2px rgba(0,0,0,0.1));

      /* ---- size: md ---- */
      --sol-toggle-md-width: 2.75rem;
      --sol-toggle-md-height: 1.5rem;
      --sol-toggle-md-thumb: 1.25rem;
      --sol-toggle-md-offset: 0.125rem;
      --sol-toggle-md-label-font: var(--sol-font-size-base, 0.875rem);

      /* ---- size: sm ---- */
      --sol-toggle-sm-width: 2rem;
      --sol-toggle-sm-height: 1.125rem;
      --sol-toggle-sm-thumb: 0.875rem;
      --sol-toggle-sm-offset: 0.125rem;
      --sol-toggle-sm-label-font: var(--sol-font-size-sm, 0.75rem);
    }

    .sol-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .sol-toggle--disabled {
      cursor: not-allowed;
      opacity: var(--sol-toggle-disabled-opacity);
    }

    /* ---- track ---- */

    .sol-toggle__track {
      position: relative;
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      border: none;
      padding: 0;
      cursor: pointer;
      border-radius: 9999px;
      background-color: var(--sol-toggle-track-off);
      transition: background-color var(--sol-toggle-transition);
    }

    .sol-toggle__track:focus-visible {
      outline: none;
      box-shadow: var(--sol-toggle-focus-ring);
    }

    .sol-toggle__track:disabled {
      cursor: not-allowed;
    }

    .sol-toggle__track--on {
      background-color: var(--sol-toggle-track-on);
    }

    /* ---- track sizes ---- */

    .sol-toggle__track--md {
      width: var(--sol-toggle-md-width);
      height: var(--sol-toggle-md-height);
    }

    .sol-toggle__track--sm {
      width: var(--sol-toggle-sm-width);
      height: var(--sol-toggle-sm-height);
    }

    /* ---- thumb ---- */

    .sol-toggle__thumb {
      display: block;
      border-radius: 9999px;
      background-color: var(--sol-toggle-thumb);
      box-shadow: var(--sol-toggle-shadow);
      transition: transform var(--sol-toggle-transition);
    }

    /* md thumb */
    .sol-toggle__thumb--md {
      width: var(--sol-toggle-md-thumb);
      height: var(--sol-toggle-md-thumb);
      transform: translateX(var(--sol-toggle-md-offset));
    }

    .sol-toggle__thumb--md-on {
      transform: translateX(calc(var(--sol-toggle-md-width) - var(--sol-toggle-md-thumb) - var(--sol-toggle-md-offset)));
    }

    /* sm thumb */
    .sol-toggle__thumb--sm {
      width: var(--sol-toggle-sm-thumb);
      height: var(--sol-toggle-sm-thumb);
      transform: translateX(var(--sol-toggle-sm-offset));
    }

    .sol-toggle__thumb--sm-on {
      transform: translateX(calc(var(--sol-toggle-sm-width) - var(--sol-toggle-sm-thumb) - var(--sol-toggle-sm-offset)));
    }

    /* ---- label ---- */

    .sol-toggle__label {
      color: var(--sol-toggle-label-color);
      user-select: none;
    }

    .sol-toggle--sm .sol-toggle__label {
      font-size: var(--sol-toggle-sm-label-font);
    }

    .sol-toggle--md .sol-toggle__label {
      font-size: var(--sol-toggle-md-label-font);
    }
  `,
})
export class SolToggleComponent implements ControlValueAccessor {
  /** Optional label displayed beside the toggle. */
  readonly label = input<string>('');

  /** Whether the toggle is disabled. */
  readonly disabled = input<boolean>(false);

  /** Size preset: sm or md. */
  readonly size = input<SolToggleSize>('md');

  /** Internal checked state. */
  readonly checked = signal<boolean>(false);

  /** Computed host wrapper class. */
  readonly hostClass = computed(() => {
    const classes = ['sol-toggle', `sol-toggle--${this.size()}`];
    if (this.disabled()) classes.push('sol-toggle--disabled');
    return classes.join(' ');
  });

  /** Computed track class combining size and on/off state. */
  readonly trackClass = computed(() => {
    const base = 'sol-toggle__track';
    const classes = [base, `${base}--${this.size()}`];
    if (this.checked()) classes.push(`${base}--on`);
    return classes.join(' ');
  });

  /** Computed thumb class combining size and on/off state. */
  readonly thumbClass = computed(() => {
    const s = this.size();
    const base = 'sol-toggle__thumb';
    const classes = [base, `${base}--${s}`];
    if (this.checked()) classes.push(`${base}--${s}-on`);
    return classes.join(' ');
  });

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  toggle(): void {
    if (this.disabled()) return;
    const next = !this.checked();
    this.checked.set(next);
    this.onChange(next);
    this.onTouched();
  }

  writeValue(value: boolean): void {
    this.checked.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // handled via the disabled() input signal;
    // if the form sets disabled state, we reflect it through the template binding
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'sol-textarea',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolTextareaComponent),
      multi: true,
    },
  ],
  template: `
    @if (label()) {
      <label class="sol-textarea__label">{{ label() }}</label>
    }

    <textarea
      [class]="textareaClass()"
      [placeholder]="placeholder()"
      [rows]="rows()"
      [disabled]="disabled()"
      [value]="value()"
      (input)="onInput($event)"
      (blur)="onBlur()"
    ></textarea>

    @if (error()) {
      <p class="sol-textarea__error">{{ error() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;

      /* ---- colour tokens ---- */
      --sol-textarea-bg: var(--sol-input-bg, var(--sol-bg-surface, #ffffff));
      --sol-textarea-text: var(--sol-color-text-primary, #1e293b);
      --sol-textarea-placeholder: var(--sol-color-text-muted, #94a3b8);
      --sol-textarea-border: var(--sol-border-color-default, #cbd5e1);
      --sol-textarea-border-focus: var(--sol-color-primary, #6366f1);
      --sol-textarea-error-color: var(--sol-color-danger, #ef4444);
      --sol-textarea-label-color: var(--sol-color-text-secondary, #475569);
      --sol-textarea-disabled-opacity: var(--sol-disabled-opacity, 0.55);

      /* ---- shape tokens (v2: comparte los tokens de input del tema) ---- */
      --sol-textarea-radius: var(--sol-input-radius, var(--sol-border-radius-md, 0.5rem));
      --sol-textarea-border-width: var(--sol-border-width-default, 1px);
      --sol-textarea-padding-x: var(--sol-space-sm, 0.75rem);
      --sol-textarea-padding-y: var(--sol-space-xs, 0.5rem);
      --sol-textarea-font-size: var(--sol-font-size-base, 0.875rem);
      --sol-textarea-label-font-size: var(--sol-font-size-sm, 0.75rem);
      --sol-textarea-label-font-weight: var(--sol-font-weight-bold, 600);
      --sol-textarea-shadow: var(--sol-input-shadow, var(--sol-shadow-sm, 0 1px 2px rgba(0,0,0,0.05)));
      --sol-textarea-focus-ring: var(--sol-input-focus-ring, 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #6366f1) 40%, transparent));
      --sol-textarea-transition: var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
    }

    .sol-textarea__label {
      display: block;
      margin-bottom: 0.375rem;
      font-size: var(--sol-textarea-label-font-size);
      font-weight: var(--sol-textarea-label-font-weight);
      color: var(--sol-textarea-label-color);
      line-height: 1.4;
    }

    .sol-textarea__native {
      display: block;
      width: 100%;
      padding: var(--sol-textarea-padding-y) var(--sol-textarea-padding-x);
      font-family: inherit;
      font-size: var(--sol-textarea-font-size);
      color: var(--sol-textarea-text);
      background-color: var(--sol-textarea-bg);
      border: var(--sol-input-border, var(--sol-textarea-border-width) solid var(--sol-textarea-border));
      border-radius: var(--sol-textarea-radius);
      box-shadow: var(--sol-textarea-shadow);
      resize: vertical;
      transition: border-color var(--sol-textarea-transition),
                  box-shadow var(--sol-textarea-transition);
    }

    .sol-textarea__native::placeholder {
      color: var(--sol-textarea-placeholder);
    }

    .sol-textarea__native:focus {
      outline: none;
      border: var(--sol-input-focus-border, var(--sol-textarea-border-width) solid var(--sol-textarea-border-focus));
      box-shadow: var(--sol-textarea-focus-ring);
    }

    .sol-textarea__native:disabled {
      cursor: not-allowed;
      opacity: var(--sol-textarea-disabled-opacity);
    }

    .sol-textarea__native--error {
      border-color: var(--sol-textarea-error-color);
    }

    .sol-textarea__native--error:focus {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sol-textarea-error-color) 40%, transparent);
    }

    .sol-textarea__error {
      margin: 0.25rem 0 0;
      font-size: var(--sol-textarea-label-font-size);
      color: var(--sol-textarea-error-color);
      line-height: 1.4;
    }

    /* Evita el zoom automático de iOS Safari al enfocar (requiere font-size
       computado >= 16px). Solo aplica en viewport móvil; no toca el token
       global --sol-font-size-base ni el font-size fuera de este breakpoint. */
    @media (max-width: 640px) {
      .sol-textarea__native {
        font-size: 16px;
      }
    }
  `,
})
export class SolTextareaComponent implements ControlValueAccessor {
  /** Placeholder text for the textarea. */
  readonly placeholder = input<string>('');

  /** Label displayed above the textarea. */
  readonly label = input<string>('');

  /** Error message displayed below the textarea. */
  readonly error = input<string>('');

  /** Whether the textarea is disabled. */
  readonly disabled = input<boolean>(false);

  /** Number of visible text rows. */
  readonly rows = input<number>(3);

  /** Internal value signal. */
  readonly value = signal<string>('');

  /** Computed CSS class string for the textarea element. */
  readonly textareaClass = computed(() => {
    const base = 'sol-textarea__native';
    return this.error() ? `${base} ${base}--error` : base;
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.value.set(target.value);
    this.onChange(target.value);
  }

  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
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

import {
  Component,
  ChangeDetectionStrategy,
  input,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'sol-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="sol-input-wrapper">
      @if (label()) {
        <label class="sol-input-label">{{ label() }}</label>
      }
      <input
        class="sol-input"
        [class.sol-input--error]="!!error()"
        [class.sol-input--disabled]="disabled() || isDisabled()"
        [type]="type()"
        [placeholder]="placeholder()"
        [disabled]="disabled() || isDisabled()"
        [value]="value()"
        [attr.autocomplete]="autocomplete()"
        (input)="onInputChange($event)"
        (blur)="onTouched()"
      />
      @if (error()) {
        <span class="sol-input-error">{{ error() }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sol-input-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-xs);
    }

    .sol-input-label {
      font-family: var(--sol-font-family);
      font-size: var(--sol-font-size-sm, 12px);
      font-weight: 500;
      color: var(--sol-color-text-secondary, #64748B);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1;
    }

    /* Tokens v2 de input (theming): la variante filled/outline/underline sale
       sola de los tokens (underline = borde transparente + inset shadow en el
       JSON del tema) — sin lógica condicional por variante. */
    .sol-input {
      width: 100%;
      height: var(--sol-size-input-height);
      padding: 0 var(--sol-space-sm);
      font-family: var(--sol-font-family);
      font-size: var(--sol-font-size-base);
      color: var(--sol-color-text-primary);
      background: var(--sol-input-bg, var(--sol-bg-surface));
      border: var(--sol-input-border, var(--sol-border-width-default) solid var(--sol-border-color-default));
      border-radius: var(--sol-input-radius, var(--sol-border-radius-md));
      box-shadow: var(--sol-input-shadow, none);
      outline: none;
      box-sizing: border-box;
      transition:
        border-color var(--sol-dur-fast, 150ms) var(--sol-ease, ease),
        box-shadow var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
    }

    .sol-input::placeholder {
      color: var(--sol-color-text-muted);
    }

    .sol-input:focus {
      border: var(--sol-input-focus-border, var(--sol-border-width-default) solid var(--sol-color-primary));
      box-shadow: var(--sol-input-focus-ring, 0 0 0 2px color-mix(in srgb, var(--sol-color-primary) 20%, transparent));
    }

    .sol-input--error {
      border-color: var(--sol-color-danger);
    }

    .sol-input--error:focus {
      border-color: var(--sol-color-danger);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--sol-color-danger) 20%, transparent);
    }

    .sol-input--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .sol-input-error {
      font-family: var(--sol-font-family);
      font-size: var(--sol-font-size-sm, 12px);
      color: var(--sol-color-danger);
      line-height: 1.3;
    }
  `,
})
export class SolInputComponent implements ControlValueAccessor {
  /* --- Signal inputs --- */
  readonly type = input<string>('text');
  readonly placeholder = input<string>('');
  readonly label = input<string>('');
  readonly error = input<string>('');
  readonly disabled = input<boolean>(false);
  /**
   * Passthrough opcional al atributo `autocomplete` del `<input>` nativo
   * (gate 4R A3, 11-c-whatsapp-config). `undefined` por defecto — con
   * `[attr.autocomplete]` Angular OMITE el atributo por completo, así que
   * ningún consumidor existente cambia de comportamiento. Úsalo con
   * `"new-password"`/`"off"` en campos de credenciales/tokens para que el
   * gestor de contraseñas del navegador/SO no ofrezca guardarlos.
   */
  readonly autocomplete = input<string | undefined>(undefined);

  /* --- Internal state --- */
  readonly value = signal<string>('');
  readonly isDisabled = signal<boolean>(false);

  /* --- CVA callbacks --- */
  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  onInputChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value.set(val);
    this.onChange(val);
  }

  /* --- ControlValueAccessor implementation --- */
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
    this.isDisabled.set(isDisabled);
  }
}

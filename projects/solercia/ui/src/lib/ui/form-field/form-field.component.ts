import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';

@Component({
  selector: 'sol-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-form-field">
      @if (label()) {
        <label class="sol-form-field__label">{{ label() }}</label>
      }
      <ng-content />
      @if (error()) {
        <span class="sol-form-field__error">{{ error() }}</span>
      }
      @if (hint() && !error()) {
        <span class="sol-form-field__hint">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .sol-form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .sol-form-field__label {
      font-size: var(--sol-font-size-sm, 12px);
      font-weight: 500;
      color: var(--sol-color-text-secondary, #64748B);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1;
    }

    .sol-form-field__error {
      font-size: var(--sol-font-size-sm, 12px);
      color: var(--sol-color-danger, #EF4444);
      line-height: 1.3;
    }

    .sol-form-field__hint {
      font-size: var(--sol-font-size-sm, 12px);
      color: var(--sol-color-text-muted, #94A3B8);
      line-height: 1.3;
    }
  `,
})
export class SolFormFieldComponent {
  readonly label = input<string>('');
  readonly error = input<string>('');
  readonly hint = input<string>('');
}

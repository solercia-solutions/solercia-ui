import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { SolIconComponent } from '../icon/icon.component';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';

@Component({
  selector: 'sol-search-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  template: `
    <div class="sol-search-input">
      <sol-icon name="search" size="sm" class="sol-search-input__icon" />
      <input
        class="sol-search-input__field"
        type="text"
        [placeholder]="placeholderText()"
        [value]="value()"
        (input)="onInput($event)"
      />
      @if (value()) {
        <button
          type="button"
          class="sol-search-input__clear"
          (click)="onClear()"
          [attr.aria-label]="clearLabel()"
        >
          <sol-icon name="x" size="sm" />
        </button>
      }
    </div>
  `,
  styles: `
    .sol-search-input {
      position: relative;
      display: flex;
      align-items: center;
    }

    .sol-search-input__icon {
      position: absolute;
      left: 10px;
      color: var(--sol-color-text-muted, #94A3B8);
      pointer-events: none;
    }

    .sol-search-input__field {
      width: 100%;
      height: var(--sol-size-input-height, 36px);
      padding: 0 32px 0 34px;
      border: 1px solid var(--sol-border-color-default, #E2E8F0);
      border-radius: var(--sol-border-radius-full, 9999px);
      background: var(--sol-bg-surface, #fff);
      color: var(--sol-color-text-primary, #0F172A);
      font-size: var(--sol-font-size-sm, 12px);
      font-family: var(--sol-font-family);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .sol-search-input__field::placeholder {
      color: var(--sol-color-text-muted, #94A3B8);
    }

    .sol-search-input__field:focus {
      border-color: var(--sol-color-primary, #2563EB);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--sol-color-primary, #2563EB) 15%, transparent);
    }

    .sol-search-input__clear {
      position: absolute;
      right: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--sol-color-text-muted, #94A3B8);
      cursor: pointer;
      transition: color 0.15s, background 0.15s;
    }

    .sol-search-input__clear:hover {
      color: var(--sol-color-text-primary, #0F172A);
      background: color-mix(in srgb, var(--sol-color-text-muted, #94A3B8) 15%, transparent);
    }

    /* Evita el zoom automático de iOS Safari al enfocar (requiere font-size
       computado >= 16px). Solo aplica en viewport móvil; no toca el token
       global --sol-font-size-base ni el font-size fuera de este breakpoint. */
    @media (max-width: 640px) {
      .sol-search-input__field {
        font-size: 16px;
      }
    }
  `,
})
export class SolSearchInputComponent {
  private readonly i18n = injectSolI18n();

  /** Placeholder of the field. Without a value it uses `shared.searchInput.placeholder`. */
  readonly placeholder = input<string | undefined>(undefined);
  readonly searchChange = output<string>();

  readonly value = signal('');

  readonly placeholderText = computed(() => {
    this.i18n.activeLang();
    return this.placeholder() ?? this.i18n.translate('shared.searchInput.placeholder');
  });

  readonly clearLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.searchInput.clear');
  });

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value.set(val);
    this.searchChange.emit(val);
  }

  onClear(): void {
    this.value.set('');
    this.searchChange.emit('');
  }
}

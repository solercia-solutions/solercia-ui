import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { SolIconComponent } from '../icon/icon.component';
import type { SolIconName } from '../icon/icon.component';

export interface SolViewToggleOption {
  value: string;
  label: string;
  icon?: SolIconName;
}

@Component({
  selector: 'sol-view-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  template: `
    <div class="sol-view-toggle">
      @for (option of options(); track option.value) {
        <button
          type="button"
          class="sol-view-toggle__btn"
          [class.sol-view-toggle__btn--active]="option.value === value()"
          (click)="onSelect(option.value)"
        >
          @if (option.icon) {
            <sol-icon [name]="option.icon" size="sm" />
          }
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: inline-flex; }

    .sol-view-toggle {
      display: inline-flex;
      align-items: center;
      background: var(--sol-bg-page, #F1F5F9);
      border: 1px solid var(--sol-border-color-default, #E2E8F0);
      border-radius: var(--sol-border-radius-full, 9999px);
      padding: 3px;
      gap: 2px;
    }

    .sol-view-toggle__btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 14px;
      border: none;
      border-radius: var(--sol-border-radius-full, 9999px);
      background: transparent;
      color: var(--sol-color-text-muted, #64748B);
      font-size: var(--sol-font-size-sm, 13px);
      font-family: var(--sol-font-family);
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, box-shadow 0.15s;
      white-space: nowrap;
    }

    .sol-view-toggle__btn:hover:not(.sol-view-toggle__btn--active) {
      color: var(--sol-color-text-primary, #0F172A);
    }

    .sol-view-toggle__btn--active {
      background: var(--sol-color-primary, #2563EB);
      color: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
  `,
})
export class SolViewToggleComponent {
  readonly options = input.required<SolViewToggleOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();

  onSelect(value: string): void {
    this.valueChange.emit(value);
  }
}

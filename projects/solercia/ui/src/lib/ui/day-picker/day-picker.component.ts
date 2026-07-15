import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

export interface DayPickerItem {
  dateStr: string;
  dayName: string;
  dayNumber: number;
  isToday?: boolean;
  isPast: boolean;
}

@Component({
  selector: 'sol-day-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-day-picker">
      @for (day of days(); track day.dateStr) {
        <button
          type="button"
          class="sol-day-picker__item"
          [class.sol-day-picker__item--selected]="selectedDate() === day.dateStr"
          [class.sol-day-picker__item--today]="day.isToday"
          [disabled]="day.isPast"
          (click)="dateSelected.emit(day.dateStr)">
          <span class="sol-day-picker__name">{{ day.dayName }}</span>
          <span class="sol-day-picker__number">{{ day.dayNumber }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .sol-day-picker {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .sol-day-picker__item {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: 2px solid var(--sol-border-color-default, #E2E8F0);
      background-color: var(--sol-bg-surface, #fff);
      gap: 2px;
      flex-shrink: 0;
      transition: border-color 0.15s, background-color 0.15s, color 0.15s;
    }

    .sol-day-picker__item:hover:not(:disabled) {
      border-color: var(--sol-color-primary, #2563EB);
    }

    .sol-day-picker__item--selected {
      background-color: var(--sol-color-primary, #2563EB) !important;
      border-color: var(--sol-color-primary, #2563EB) !important;
      color: #fff !important;
    }

    .sol-day-picker__item--today:not(.sol-day-picker__item--selected) {
      border-color: var(--sol-color-primary, #2563EB);
    }

    .sol-day-picker__item:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .sol-day-picker__name {
      font-size: var(--sol-font-size-xs, 11px);
      font-weight: 500;
      color: var(--sol-color-text-muted, #94A3B8);
    }

    .sol-day-picker__item--selected .sol-day-picker__name {
      color: rgba(255, 255, 255, 0.85);
    }

    .sol-day-picker__number {
      font-size: var(--sol-font-size-sm, 13px);
      font-weight: 600;
      color: var(--sol-color-text-primary, #1E293B);
    }

    .sol-day-picker__item--selected .sol-day-picker__number {
      color: #fff;
    }

    .sol-day-picker__item:disabled .sol-day-picker__name,
    .sol-day-picker__item:disabled .sol-day-picker__number {
      color: var(--sol-color-text-muted, #94A3B8);
    }
  `,
})
export class SolDayPickerComponent {
  readonly days = input.required<DayPickerItem[]>();
  readonly selectedDate = input<string | null>(null);
  readonly dateSelected = output<string>();
}

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SolDatePickerComponent, SolDayPickerComponent, type DayPickerItem } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function nextDays(count: number): DayPickerItem[] {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset - 1);
    return {
      dateStr: iso(date),
      dayName: names[date.getDay()],
      dayNumber: date.getDate(),
      isToday: offset === 1,
      isPast: offset === 0,
    };
  });
}

@Component({
  selector: 'app-dates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageComponent, DemoComponent, SolDatePickerComponent, SolDayPickerComponent],
  template: `
    <app-page
      title="Date & day picker"
      lead="A full calendar popover with day, month and year views, and a horizontal strip of bookable days."
      [selectors]="['sol-date-picker', 'sol-day-picker']"
    >
      <app-demo title="Date picker" description="Value is an ISO date string (yyyy-mm-dd). min and max disable days outside the range." [code]="pickerCode">
        <sol-date-picker [(ngModel)]="dueDate" />
        <sol-date-picker size="sm" [min]="min" [max]="max" placeholder="Within 30 days" (valueChange)="ranged.set($event)" />
        <sol-date-picker [disabled]="true" [value]="min" />
        <p class="hint">Due date: {{ dueDate() || '—' }} · Ranged: {{ ranged() || '—' }}</p>
      </app-demo>

      <app-demo title="Day picker" description="The host computes the days (agenda-driven); past days are disabled." [code]="dayCode" [stack]="true">
        <div class="scroll-x"><sol-day-picker [days]="days" [selectedDate]="selectedDay()" (dateSelected)="selectedDay.set($event)" /></div>
        <p class="hint">Selected: {{ selectedDay() }}</p>
      </app-demo>
    </app-page>
  `,
  styles: `
    .scroll-x {
      overflow-x: auto;
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class DatesPage {
  private readonly today = new Date();
  protected readonly min = iso(this.today);
  protected readonly max = iso(new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate() + 30));
  protected readonly dueDate = signal(iso(this.today));
  protected readonly ranged = signal('');
  protected readonly days = nextDays(10);
  protected readonly selectedDay = signal(this.days[1].dateStr);

  protected readonly pickerCode = `<sol-date-picker [(ngModel)]="dueDate" />
<sol-date-picker size="sm" min="2026-11-24" max="2026-12-24" placeholder="Within 30 days" (valueChange)="onPick($event)" />
<sol-date-picker [disabled]="true" value="2026-11-24" />`;
  protected readonly dayCode = `<sol-day-picker [days]="days" [selectedDate]="selected()" (dateSelected)="selected.set($event)" />

days: DayPickerItem[] = [
  { dateStr: '2026-11-24', dayName: 'Tue', dayNumber: 24, isToday: true, isPast: false },
  { dateStr: '2026-11-25', dayName: 'Wed', dayNumber: 25, isPast: false },
];`;
}

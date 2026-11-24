import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  SolCalendarComponent,
  SolCalendarGridComponent,
  SolCalendarHeaderComponent,
  getWeekStart,
  type SolCalendarEvent,
  type SolCalendarLegendItem,
  type SolCalendarView,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

function at(base: Date, dayOffset: number, hour: number, minute = 0): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute);
}

function sampleEvents(): SolCalendarEvent[] {
  const monday = getWeekStart(new Date());
  const confirmed = 'var(--sol-color-primary)';
  const tentative = 'var(--sol-color-warning)';
  return [
    { id: 1, title: 'Sprint planning', start: at(monday, 0, 9), end: at(monday, 0, 10, 30), color: confirmed },
    { id: 2, title: 'Design review', start: at(monday, 1, 11), end: at(monday, 1, 12), color: tentative },
    { id: 3, title: 'Client demo', start: at(monday, 2, 15), end: at(monday, 2, 16), color: confirmed },
    { id: 4, title: '1:1 with Ada', start: at(monday, 3, 8, 30), end: at(monday, 3, 9), color: confirmed },
    { id: 5, title: 'Retrospective', start: at(monday, 4, 14), end: at(monday, 4, 15, 30), color: tentative },
    { id: 6, title: 'Office hours', start: at(new Date(), 0, 10), end: at(new Date(), 0, 11) },
  ];
}

@Component({
  selector: 'app-calendar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolCalendarComponent, SolCalendarHeaderComponent, SolCalendarGridComponent],
  template: `
    <ng-template #eventTpl let-event>
      <strong>{{ event.title }}</strong>
    </ng-template>

    <app-page
      title="Calendar"
      lead="Week and day agenda. sol-calendar composes sol-calendar-header and sol-calendar-grid; colors derive from each event color or a SOL_CALENDAR_COLOR strategy."
      [selectors]="['sol-calendar', 'sol-calendar-header', 'sol-calendar-grid']"
    >
      <app-demo title="Calendar" description="Click an event or an empty slot." [code]="calendarCode" [stack]="true">
        <sol-calendar
          [events]="events()"
          [view]="view()"
          [currentDate]="date()"
          [legend]="legend"
          (eventClicked)="log.set('Event: ' + $event.title)"
          (slotClicked)="log.set('Slot: ' + $event.date.toDateString() + ' ' + $event.time)"
        />
        <p class="hint">{{ log() || 'Nothing selected yet.' }}</p>
      </app-demo>

      <app-demo title="Header and grid composed by the host" description="Useful when the toolbar lives elsewhere; eventTemplate customizes the event body." [code]="partsCode" [stack]="true">
        <sol-calendar-header [currentDate]="date()" [view]="view()" (dateChange)="date.set($event)" (viewChange)="view.set($event)" />
        <sol-calendar-grid [events]="events()" view="day" [currentDate]="date()" [eventTemplate]="eventTpl" />
      </app-demo>
    </app-page>
  `,
  styles: `
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class CalendarPage {
  protected readonly events = signal(sampleEvents());
  protected readonly view = signal<SolCalendarView>('week');
  protected readonly date = signal(new Date());
  protected readonly legend: SolCalendarLegendItem[] = [
    { color: 'var(--sol-color-primary)', labelKey: 'showcase.calendar.confirmed' },
    { color: 'var(--sol-color-warning)', labelKey: 'showcase.calendar.tentative' },
  ];
  protected readonly log = signal('');

  protected readonly calendarCode = `<sol-calendar
  [events]="events()"
  [view]="view()"                  <!-- 'week' | 'day' -->
  [currentDate]="date()"
  [legend]="legend"
  (eventClicked)="open($event)"
  (slotClicked)="book($event.date, $event.time)"
/>

events: SolCalendarEvent[] = [
  { id: 1, title: 'Sprint planning', start: '2026-11-23T09:00', end: '2026-11-23T10:30', color: 'var(--sol-color-primary)' },
];
legend: SolCalendarLegendItem[] = [{ color: 'var(--sol-color-primary)', labelKey: 'showcase.calendar.confirmed' }];`;
  protected readonly partsCode = `<ng-template #eventTpl let-event><strong>{{ event.title }}</strong></ng-template>

<sol-calendar-header [currentDate]="date()" [view]="view()" (dateChange)="date.set($event)" (viewChange)="view.set($event)" />
<sol-calendar-grid [events]="events()" view="day" [currentDate]="date()" [eventTemplate]="eventTpl" />`;
}

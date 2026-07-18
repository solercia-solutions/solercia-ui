import { Component, ChangeDetectionStrategy, computed, inject, input, output } from '@angular/core';
import { SolIconComponent } from '../icon/icon.component';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { getWeekStart } from './calendar-layout';
import type { SolCalendarView } from './calendar.model';

/**
 * `sol-calendar-header` — navegación (anterior/hoy/siguiente) + selector de
 * vista (semana/día). Generaliza
 * `boki-front/src/widgets/calendar/ui/calendar-header.component.ts`: SIN
 * leyenda (spec#Leyenda configurable — la renderiza `sol-calendar`, no el
 * header, para que "leyenda configurable" no dependa de esta sub-pieza) y
 * SIN conocimiento de dominio (nunca referencia estados de cita).
 *
 * Robustez de entrada (lecciones PR3/PR4/PR5): `currentDate`/`view` toleran
 * `null`/`undefined`/fecha inválida sin lanzar — degradan a una etiqueta
 * vacía y asumen `'week'` respectivamente.
 */
@Component({
  selector: 'sol-calendar-header',
  standalone: true,
  imports: [SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-calendar-header">
      <div class="sol-calendar-header__nav">
        <span class="sol-calendar-header__range">{{ dateRangeLabel() }}</span>
        <button
          type="button"
          class="sol-calendar-header__arrow"
          (click)="navigatePrev()"
          [attr.aria-label]="previousLabel()"
        >
          <sol-icon name="chevron-left" size="sm" />
        </button>
        <button type="button" class="sol-calendar-header__today" (click)="goToday()">{{ todayLabel() }}</button>
        <button
          type="button"
          class="sol-calendar-header__arrow"
          (click)="navigateNext()"
          [attr.aria-label]="nextLabel()"
        >
          <sol-icon name="chevron-right" size="sm" />
        </button>
      </div>

      <div class="sol-calendar-header__view-toggle">
        <button
          type="button"
          class="sol-calendar-header__toggle-btn"
          [class.sol-calendar-header__toggle-btn--active]="view() === 'week'"
          (click)="setView('week')"
        >{{ viewWeekLabel() }}</button>
        <button
          type="button"
          class="sol-calendar-header__toggle-btn"
          [class.sol-calendar-header__toggle-btn--active]="view() === 'day'"
          (click)="setView('day')"
        >{{ viewDayLabel() }}</button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sol-calendar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sol-space-md, 16px);
      padding: var(--sol-space-sm, 12px) 0;
      border-bottom: 1px solid var(--sol-border-color-default, #e5e7eb);
      flex-wrap: wrap;
    }

    .sol-calendar-header__nav {
      display: flex;
      align-items: center;
      gap: var(--sol-space-xs, 6px);
    }

    .sol-calendar-header__range {
      font-size: var(--sol-font-size-sm, 15px);
      font-weight: 600;
      color: var(--sol-color-text-primary);
      min-width: 10rem;
    }

    .sol-calendar-header__arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      background: var(--sol-bg-surface, #fff);
      border: 1px solid var(--sol-border-color-default, #e5e7eb);
      border-radius: var(--sol-border-radius-md, 6px);
      cursor: pointer;
      color: var(--sol-color-text-primary);
      transition: background 0.15s;
    }

    .sol-calendar-header__arrow:hover {
      background: var(--sol-border-color-default, #e5e7eb);
    }

    .sol-calendar-header__today {
      height: 2rem;
      padding: 0 0.875rem;
      background: var(--sol-bg-surface, #fff);
      border: 1px solid var(--sol-border-color-default, #e5e7eb);
      border-radius: var(--sol-border-radius-md, 6px);
      font-size: var(--sol-font-size-xs, 13px);
      font-weight: 500;
      color: var(--sol-color-text-primary);
      cursor: pointer;
      transition: background 0.15s;
    }

    .sol-calendar-header__today:hover {
      background: var(--sol-border-color-default, #e5e7eb);
    }

    .sol-calendar-header__view-toggle {
      display: flex;
      border: 1px solid var(--sol-border-color-default, #e5e7eb);
      border-radius: var(--sol-border-radius-lg, 8px);
      overflow: hidden;
    }

    .sol-calendar-header__toggle-btn {
      height: 2rem;
      padding: 0 0.875rem;
      font-size: var(--sol-font-size-xs, 13px);
      font-weight: 500;
      background: var(--sol-bg-surface, #fff);
      border: none;
      color: var(--sol-color-text-muted);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .sol-calendar-header__toggle-btn + .sol-calendar-header__toggle-btn {
      border-left: 1px solid var(--sol-border-color-default, #e5e7eb);
    }

    .sol-calendar-header__toggle-btn--active {
      background: var(--sol-color-primary, #3b82f6);
      color: #fff;
    }

    .sol-calendar-header__toggle-btn:not(.sol-calendar-header__toggle-btn--active):hover {
      background: var(--sol-border-color-default, #e5e7eb);
    }
  `,
})
export class SolCalendarHeaderComponent {
  private readonly i18n = inject(SOL_I18N);

  /** Tolera `null`/`undefined`/fecha inválida (lección PR3/PR4/PR5): `input.required()` no garantiza un dato válido en runtime. */
  readonly currentDate = input.required<Date | null | undefined>();

  readonly view = input.required<SolCalendarView | null | undefined>();

  readonly dateChange = output<Date>();

  readonly viewChange = output<SolCalendarView>();

  readonly todayLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.calendar.today');
  });

  readonly previousLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.calendar.previous');
  });

  readonly nextLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.calendar.next');
  });

  readonly viewWeekLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.calendar.viewWeek');
  });

  readonly viewDayLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.calendar.viewDay');
  });

  readonly dateRangeLabel = computed(() => {
    this.i18n.activeLang();
    const date = this.validDate();
    if (!date) return '';

    if (this.view() === 'day') {
      const weekday = this.i18n.translate(`shared.calendar.weekdayShort.${date.getDay()}`);
      const month = this.i18n.translate(`shared.calendar.months.${date.getMonth()}`);
      return `${weekday} ${date.getDate()} ${month}`;
    }

    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startMonth = this.i18n.translate(`shared.calendar.months.${start.getMonth()}`);
    const endMonth = this.i18n.translate(`shared.calendar.months.${end.getMonth()}`);
    return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
  });

  navigatePrev(): void {
    const date = this.validDate();
    if (!date) return;
    const next = new Date(date);
    if (this.view() === 'day') next.setDate(next.getDate() - 1);
    else next.setDate(next.getDate() - 7);
    this.dateChange.emit(next);
  }

  navigateNext(): void {
    const date = this.validDate();
    if (!date) return;
    const next = new Date(date);
    if (this.view() === 'day') next.setDate(next.getDate() + 1);
    else next.setDate(next.getDate() + 7);
    this.dateChange.emit(next);
  }

  goToday(): void {
    this.dateChange.emit(new Date());
  }

  setView(view: SolCalendarView): void {
    this.viewChange.emit(view);
  }

  /** `currentDate()` normalizado: `null` si es `null`/`undefined`/inválido (degrada, no lanza). */
  private validDate(): Date | null {
    const date = this.currentDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
}

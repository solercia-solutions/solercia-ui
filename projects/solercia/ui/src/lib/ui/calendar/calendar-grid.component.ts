import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  TemplateRef,
  computed,
  inject,
  input,
  output,
  signal,
  type Signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { ThemeService } from '../../tokens';
import { NEUTRAL_CALENDAR_COLOR, SOL_CALENDAR_COLOR } from './calendar-color';
import {
  buildDayColumns,
  computeEventHeight,
  computeEventTop,
  computeNowTop,
  countEventIds,
  dayKey,
  safeEventTrackKey,
  type CalendarDayColumn,
} from './calendar-layout';
import type { SolCalendarEvent, SolCalendarView, StateColorSet } from './calendar.model';

const HOUR_START = 6;
const HOUR_END = 22;
const HOUR_PX = 60; // px por hora
const TOTAL_HOURS = HOUR_END - HOUR_START;
const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

/**
 * Señal booleana reactiva al viewport móvil (breakpoint canónico 767px).
 * Duplicado a propósito (mismo patrón que `sol-data-table`, PR7 del
 * proyecto): el widget de citas usaba `@shared/lib` (app-side, no
 * importable desde la librería); cada componente de `@solercia/ui` que
 * necesita esto mantiene su propia copia mínima, sin depender de la app.
 */
function observeMobileViewport(): Signal<boolean> {
  const destroyRef = inject(DestroyRef);
  const matches = signal(false);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return matches.asReadonly();
  }

  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
  matches.set(mediaQueryList.matches);

  if (typeof mediaQueryList.addEventListener === 'function') {
    const onChange = (event: MediaQueryListEvent): void => matches.set(event.matches);
    mediaQueryList.addEventListener('change', onChange);
    destroyRef.onDestroy(() => mediaQueryList.removeEventListener('change', onChange));
  }

  return matches.asReadonly();
}

/** Contexto del `ng-template` de evento: `let-event` (`$implicit`) o `let-event="event"`. */
export interface SolCalendarEventTemplateContext<T extends SolCalendarEvent = SolCalendarEvent> {
  $implicit: T;
  event: T;
}

/**
 * `sol-calendar-grid` — grilla de horas con posicionamiento absoluto (px por
 * minuto), línea de "ahora" y slots clicables (spec: solercia-ui-calendar).
 * Generaliza `boki-front/src/widgets/calendar/ui/calendar-grid.component.ts`:
 * eventos genéricos `{id,start,end,title,color?,data?}` (nunca
 * `clientName`/`professionalName`/`stateId`), color resuelto por
 * `SOL_CALENDAR_COLOR` (D3, en vez de una paleta hardcodeada) y el cuerpo de
 * cada tarjeta por `eventTemplate` proyectado (spec#Cuerpo de tarjeta por
 * template proyectado) — sin template, cae a mostrar solo `event.title`.
 *
 * Robustez de entrada (lecciones PR3/PR4/PR5): `events`/`view`/`currentDate`
 * toleran `null`/`undefined`/valores inválidos sin lanzar (degradan vía
 * `calendar-layout.ts`, funciones puras testeadas en aislamiento). Un evento
 * con `id` ausente/duplicado no rompe `@for` (fix NG0955, mismo patrón que
 * `sol-kanban`/`sol-timeline`).
 */
@Component({
  selector: 'sol-calendar-grid',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-calendar-grid-wrap">
      <div class="sol-calendar-grid-header" [style.--day-count]="dayCount()">
        <div class="sol-calendar-grid-header__corner"></div>
        @for (day of dayColumns(); track dayKeyOf(day)) {
          <div class="sol-calendar-grid-header__day" [class.sol-calendar-grid-header__day--today]="day.isToday">
            {{ dayLabel(day.date) }}
          </div>
        }
      </div>

      <div class="sol-calendar-grid-body">
        <div class="sol-calendar-grid-times">
          @for (hour of hours; track hour) {
            <div class="sol-calendar-grid-times__label" [style.height.px]="HOUR_PX">{{ formatHour(hour) }}</div>
          }
        </div>

        <div class="sol-calendar-grid-days" [style.--day-count]="dayCount()">
          @for (day of dayColumns(); track dayKeyOf(day)) {
            <div class="sol-calendar-grid-day" [class.sol-calendar-grid-day--today]="day.isToday">
              @for (hour of hours; track hour) {
                <div class="sol-calendar-grid-day__hour" [style.height.px]="HOUR_PX">
                  <div class="sol-calendar-grid-day__half-line"></div>
                </div>
              }

              @if (day.isToday && nowTop() >= 0) {
                <div class="sol-calendar-grid-now-line" [style.top.px]="nowTop()"></div>
              }

              @for (event of day.events; track trackEvent(event, $index)) {
                <div
                  class="sol-calendar-event"
                  [style.top.px]="eventTop(event)"
                  [style.height.px]="eventHeight(event)"
                  [style.background-color]="eventColor(event).bg"
                  [style.border-left]="'3px solid ' + eventColor(event).border"
                  [style.color]="eventColor(event).text"
                  (click)="onEventClick(event, $event)"
                >
                  @if (eventTemplate(); as tpl) {
                    <ng-container *ngTemplateOutlet="tpl; context: { $implicit: event, event: event }" />
                  } @else {
                    <div class="sol-calendar-event__title">{{ event.title }}</div>
                  }
                </div>
              }

              @for (hour of hours; track hour) {
                <div
                  class="sol-calendar-grid-day__slot"
                  [style.top.px]="hour * HOUR_PX - HOUR_START * HOUR_PX"
                  [style.height.px]="HOUR_PX"
                  (click)="onSlotClick(day.date, hour)"
                ></div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sol-calendar-grid-wrap {
      border: var(--sol-card-border, 1px solid var(--sol-border-color-default, #e5e7eb));
      border-radius: var(--sol-card-radius, var(--sol-border-radius-lg, 8px));
      box-shadow: var(--sol-card-shadow, var(--sol-shadow-sm));
      overflow: hidden;
      background: var(--sol-card-bg, var(--sol-bg-surface, #fff));
      display: flex;
      flex-direction: column;
      max-height: 42rem;
    }

    .sol-calendar-grid-header {
      display: grid;
      grid-template-columns: 3.5rem repeat(var(--day-count, 7), 1fr);
      flex-shrink: 0;
      border-bottom: 1px solid var(--sol-border-color-default, #e5e7eb);
      background: var(--sol-bg-surface, #fff);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .sol-calendar-grid-header__corner {
      border-right: 1px solid var(--sol-border-color-default, #e5e7eb);
    }

    .sol-calendar-grid-header__day {
      text-align: center;
      padding: 0.625rem 0.25rem 0.5rem;
      font-size: var(--sol-font-size-xs, 12px);
      font-weight: 600;
      color: var(--sol-color-text-muted);
      border-right: 1px solid var(--sol-border-color-default, #e5e7eb);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .sol-calendar-grid-header__day--today {
      color: var(--sol-color-primary, #3b82f6);
    }

    .sol-calendar-grid-body {
      display: flex;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }

    .sol-calendar-grid-times {
      width: 3.5rem;
      flex-shrink: 0;
      border-right: 1px solid var(--sol-border-color-default, #e5e7eb);
    }

    .sol-calendar-grid-times__label {
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding-right: 0.5rem;
      padding-top: 0.25rem;
      font-size: var(--sol-font-size-xs, 11px);
      color: var(--sol-color-text-muted);
      box-sizing: border-box;
      border-top: 1px solid var(--sol-border-color-default, #e5e7eb);
    }

    .sol-calendar-grid-times__label:first-child {
      border-top: none;
    }

    .sol-calendar-grid-days {
      display: grid;
      grid-template-columns: repeat(var(--day-count, 7), 1fr);
      flex: 1;
      min-width: 0;
    }

    .sol-calendar-grid-day {
      position: relative;
      border-right: 1px solid var(--sol-border-color-default, #e5e7eb);
      min-height: 0;
    }

    .sol-calendar-grid-day:last-child {
      border-right: none;
    }

    .sol-calendar-grid-day--today {
      background: color-mix(in srgb, var(--sol-color-primary, #3b82f6) 4%, transparent);
    }

    .sol-calendar-grid-day__hour {
      position: relative;
      border-top: 1px solid var(--sol-border-color-default, #e5e7eb);
      box-sizing: border-box;
    }

    .sol-calendar-grid-day__hour:first-child {
      border-top: none;
    }

    .sol-calendar-grid-day__half-line {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      border-top: 1px dashed var(--sol-border-color-default, #e5e7eb);
      opacity: 0.6;
      pointer-events: none;
    }

    .sol-calendar-grid-day__slot {
      position: absolute;
      left: 0;
      right: 0;
      cursor: pointer;
      z-index: 0;
    }

    .sol-calendar-grid-day__slot:hover {
      background: color-mix(in srgb, var(--sol-color-primary, #3b82f6) 6%, transparent);
    }

    .sol-calendar-grid-now-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--sol-color-danger, #ef4444);
      z-index: 8;
      pointer-events: none;
    }

    .sol-calendar-grid-now-line::before {
      content: '';
      position: absolute;
      left: -4px;
      top: -4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--sol-color-danger, #ef4444);
    }

    .sol-calendar-event {
      position: absolute;
      left: 2px;
      right: 2px;
      border-radius: 4px;
      padding: 4px 6px;
      font-size: var(--sol-font-size-xs, 11px);
      overflow: hidden;
      cursor: pointer;
      z-index: 2;
      transition: box-shadow 0.15s;
      box-sizing: border-box;
      min-height: 22px;
    }

    .sol-calendar-event:hover {
      box-shadow: var(--sol-shadow-md, 0 2px 8px rgba(0, 0, 0, 0.15));
      z-index: 4;
    }

    .sol-calendar-event__title {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Móvil (paridad con el widget actual): columnas ajustadas al ancho, sin
       overflow horizontal; la columna de horas se compacta. El número de
       días lo decide el componente (token aditivo calendar.mobileDays). */
    @media (max-width: 767px) {
      .sol-calendar-grid-header {
        grid-template-columns: 2.75rem repeat(var(--day-count, 5), minmax(0, 1fr));
      }

      .sol-calendar-grid-times {
        width: 2.75rem;
      }

      .sol-calendar-grid-times__label {
        padding-right: 0.25rem;
        font-size: 10px;
      }

      .sol-calendar-grid-days {
        grid-template-columns: repeat(var(--day-count, 5), minmax(0, 1fr));
      }

      .sol-calendar-grid-header__day {
        padding: 0.5rem 0.125rem 0.375rem;
        font-size: 10px;
        letter-spacing: 0.02em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
    }
  `,
})
export class SolCalendarGridComponent<T extends SolCalendarEvent = SolCalendarEvent> {
  private readonly colorResolver = inject(SOL_CALENDAR_COLOR);
  private readonly themeService = inject(ThemeService);
  private readonly i18n = inject(SOL_I18N);
  private readonly destroyRef = inject(DestroyRef);

  /** Tolera `null`/`undefined` (lección PR3/PR4/PR5): `input.required()` no garantiza un dato válido en runtime. */
  readonly events = input.required<T[] | null | undefined>();

  readonly view = input.required<SolCalendarView | null | undefined>();

  readonly currentDate = input.required<Date | null | undefined>();

  /** Sin este, el cuerpo del evento cae a mostrar solo `event.title` (spec#Cuerpo de tarjeta por template proyectado). */
  readonly eventTemplate = input<TemplateRef<SolCalendarEventTemplateContext<T>> | null>(null);

  readonly eventClicked = output<T>();

  readonly slotClicked = output<{ date: Date; time: string }>();

  readonly HOUR_PX = HOUR_PX;
  readonly HOUR_START = HOUR_START;
  readonly hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);

  private readonly isMobileViewport = observeMobileViewport();

  /**
   * Token aditivo `component.calendar.mobileDays` del ThemeFile activo (v2).
   * Default 5 (lunes–viernes ajustados al ancho); 7 conserva la semana
   * completa — mismo patrón que `component.table.mobile` en `sol-data-table`.
   */
  private readonly mobileDays = computed<5 | 7>(() => {
    const file = this.themeService.activeTheme();
    const mode = this.themeService.isDark() ? 'dark' : 'light';
    return file?.modes?.[mode]?.component?.calendar?.mobileDays ?? 5;
  });

  readonly dayCount = computed(() => {
    if (this.view() === 'day') return 1;
    return this.isMobileViewport() ? this.mobileDays() : 7;
  });

  private readonly validCurrentDate = computed<Date>(() => {
    const date = this.currentDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  });

  readonly dayColumns = computed<CalendarDayColumn<T>[]>(() =>
    buildDayColumns<T>(this.view() ?? 'week', this.validCurrentDate(), this.events(), this.dayCount()),
  );

  private readonly now = signal(new Date());

  constructor() {
    const interval = setInterval(() => this.now.set(new Date()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(interval));
  }

  readonly nowTop = computed(() => computeNowTop(this.now(), HOUR_START, HOUR_END, HOUR_PX));

  /**
   * Frecuencia de `id` entre TODOS los eventos visibles (todas las columnas)
   * — soporte de `trackEvent` (fix NG0955 con id duplicado/ausente, mismo
   * patrón que `sol-kanban`/`sol-timeline`). `computed()` para no recalcular
   * en cada invocación de `trackEvent` dentro del mismo render.
   */
  private readonly allEventsIdFrequency = computed(() => countEventIds(this.dayColumns().flatMap((d) => d.events)));

  dayKeyOf(day: CalendarDayColumn<T>): string {
    return dayKey(day.date);
  }

  trackEvent(event: T, index: number): unknown {
    return safeEventTrackKey(event?.id, index, this.allEventsIdFrequency());
  }

  formatHour(hour: number): string {
    return `${hour}:00`;
  }

  dayLabel(date: Date): string {
    this.i18n.activeLang();
    const weekday = this.i18n.translate(`shared.calendar.weekdayShort.${date.getDay()}`);
    return `${weekday} ${date.getDate()}/${date.getMonth() + 1}`;
  }

  /**
   * DEUDA DOCUMENTADA (SUGGESTION del 4R, re-gate PR6, deliberadamente NO
   * implementada en esta corrección): `eventTop`/`eventHeight`/`eventColor`
   * se llaman COMO MÉTODOS dentro del `@for` de eventos, así que Angular
   * los reevalúa en CADA ciclo de detección de cambios (incluido el tick de
   * 60s de `now`, que solo afecta la línea de "ahora" pero dispara CD sobre
   * todo el componente). Con cientos de eventos visibles esto podría
   * degradar a lentitud. Mejora futura: memoizar el layout del día completo
   * vía un `computed()` sobre `(events, view, currentDate)` que devuelva
   * `{event, top, height, color}[]` ya resueltos, y que el `@for` itere esa
   * estructura en vez de llamar métodos por evento. No se implementó acá a
   * propósito — el 4R lo marcó opcional y esta corrección ya prioriza los 2
   * WARNING obligatorios (color inseguro + evento que cruza medianoche).
   */
  eventTop(event: T): number {
    return computeEventTop(event, HOUR_START, HOUR_END, HOUR_PX);
  }

  eventHeight(event: T): number {
    return computeEventHeight(event, HOUR_START, HOUR_END, HOUR_PX);
  }

  /**
   * Delega en el `colorResolver` INYECTADO (corrección 4R WARNING —
   * resilience, re-gate PR6): una `SolCalendarColorStrategy` de dominio
   * provista por el consumidor es código EXTERNO a la librería — si lanza,
   * antes rompía el render de TODA la grilla (un solo evento defectuoso
   * tumbaba el resto). Ahora degrada a `NEUTRAL_CALENDAR_COLOR` SOLO para
   * ESE evento; el resto del calendario sigue renderizando con normalidad.
   */
  eventColor(event: T): StateColorSet {
    try {
      return this.colorResolver.resolve(event, this.themeService.isDark());
    } catch {
      return NEUTRAL_CALENDAR_COLOR;
    }
  }

  onEventClick(event: T, domEvent: MouseEvent): void {
    domEvent.stopPropagation();
    this.eventClicked.emit(event);
  }

  onSlotClick(date: Date, hour: number): void {
    this.slotClicked.emit({ date, time: `${String(hour).padStart(2, '0')}:00` });
  }
}

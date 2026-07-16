import {
  Component,
  ChangeDetectionStrategy,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolCalendarGridComponent, type SolCalendarEventTemplateContext } from './calendar-grid.component';
import { SolCalendarHeaderComponent } from './calendar-header.component';
import type { SolCalendarEvent, SolCalendarLegendItem, SolCalendarView } from './calendar.model';

/**
 * `sol-calendar` — orquestador genérico de `sol-calendar-header` +
 * `sol-calendar-grid` + leyenda (spec: solercia-ui-calendar). Generaliza
 * `boki-front/src/widgets/calendar`: evento genérico `{id,start,end,title,
 * color?,data?}` (NUNCA `clientName`/`professionalName`/`stateId`), color
 * por `SOL_CALENDAR_COLOR` (Strategy inyectable, D3), cuerpo de tarjeta por
 * `eventTemplate` proyectado y leyenda TOTALMENTE controlada por `[legend]`
 * (spec#Leyenda configurable — sin default hardcodeado de estados de cita).
 *
 * Vista mes y arrastrar-para-reagendar (`eventDropped`) quedan DIFERIDOS —
 * decisión ratificada, documentada como no-meta de esta versión (`view`
 * solo tipa `'week'|'day'`, `'month'` no existe en el tipo a propósito).
 *
 * Espejo interno (`signal` + `effect`, D4 del design, mismo patrón que
 * `sol-kanban`/`sol-timeline`): `currentDate`/`view` son inputs que
 * SIEMBRAN el estado interno de navegación — el consumidor puede montar
 * `sol-calendar` sin wiring adicional (autocontenido: los clics de
 * "anterior"/"siguiente"/"hoy"/toggle de vista los maneja este componente
 * internamente), y también puede saltar programáticamente a otra fecha
 * reasignando el input.
 *
 * Robustez de entrada (lecciones PR3/PR4/PR5): `events`/`view`/`currentDate`
 * toleran `null`/`undefined`/valores inválidos sin lanzar (degradan a
 * arreglo vacío / `'week'` / fecha actual del sistema, respectivamente).
 */
@Component({
  selector: 'sol-calendar',
  standalone: true,
  imports: [SolCalendarHeaderComponent, SolCalendarGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-calendar">
      <sol-calendar-header
        [currentDate]="mirroredDate()"
        [view]="mirroredView()"
        (dateChange)="onDateChange($event)"
        (viewChange)="onViewChange($event)"
      />

      @if (legendItems().length > 0) {
        <div class="sol-calendar__legend">
          @for (item of legendItems(); track item.labelKey) {
            <span class="sol-calendar__legend-item">
              <span class="sol-calendar__legend-dot" [style.background]="item.color"></span>
              <span class="sol-calendar__legend-label">{{ legendLabel(item) }}</span>
            </span>
          }
        </div>
      }

      <sol-calendar-grid
        [events]="events()"
        [view]="mirroredView()"
        [currentDate]="mirroredDate()"
        [eventTemplate]="eventTemplate()"
        (eventClicked)="eventClicked.emit($event)"
        (slotClicked)="slotClicked.emit($event)"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sol-calendar {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-sm, 8px);
    }

    .sol-calendar__legend {
      display: flex;
      align-items: center;
      gap: var(--sol-space-md, 12px);
      flex-wrap: wrap;
    }

    .sol-calendar__legend-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .sol-calendar__legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .sol-calendar__legend-label {
      font-size: var(--sol-font-size-xs, 12px);
      color: var(--sol-color-text-muted);
    }
  `,
})
export class SolCalendarComponent<T extends SolCalendarEvent = SolCalendarEvent> {
  private readonly i18n = inject(SOL_I18N);

  /** Tolera `null`/`undefined` (lección PR3/PR4/PR5): `input.required()` no garantiza un dato válido en runtime. */
  readonly events = input.required<T[] | null | undefined>();

  readonly view = input.required<SolCalendarView | null | undefined>();

  readonly currentDate = input.required<Date | null | undefined>();

  /** Sin este, `sol-calendar-grid` cae a mostrar solo `event.title` (spec#Cuerpo de tarjeta por template proyectado). */
  readonly eventTemplate = input<TemplateRef<SolCalendarEventTemplateContext<T>> | null>(null);

  /** Leyenda TOTALMENTE controlada por el consumidor — sin este input, no se muestra ninguna leyenda (spec#Leyenda configurable). */
  readonly legend = input<SolCalendarLegendItem[] | null | undefined>(null);

  readonly eventClicked = output<T>();

  readonly slotClicked = output<{ date: Date; time: string }>();

  /** `protected` (no `private`): el template necesita leerlos, y Angular exige acceso no-privado para bindings de plantilla. */
  protected readonly mirroredDate = signal<Date>(new Date());
  protected readonly mirroredView = signal<SolCalendarView>('week');

  constructor() {
    effect(() => {
      const date = this.currentDate();
      this.mirroredDate.set(date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date());
    });
    effect(() => {
      const view = this.view();
      this.mirroredView.set(view === 'day' ? 'day' : 'week');
    });
  }

  protected readonly legendItems = computed(() => (this.legend() ?? []).filter((item): item is SolCalendarLegendItem => !!item));

  legendLabel(item: SolCalendarLegendItem): string {
    this.i18n.activeLang();
    return this.i18n.translate(item.labelKey);
  }

  protected onDateChange(date: Date): void {
    this.mirroredDate.set(date);
  }

  protected onViewChange(view: SolCalendarView): void {
    this.mirroredView.set(view);
  }
}

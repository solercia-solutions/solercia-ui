import type { SolCalendarEvent, SolCalendarView } from './calendar.model';

/**
 * Funciones puras del motor de posicionamiento de `sol-calendar` — extraídas
 * para testear en aislamiento (mismo espíritu que `timeline-position.ts` del
 * PR4 y `kanban-reorder.service.ts` del PR5b: la lógica no trivial vive
 * fuera del ciclo de render). Robustez de entrada (lecciones PR3/PR4/PR5):
 * `start`/`end` inválidos o ausentes DEGRADAN (valor por defecto, nunca
 * lanzan) — un evento malformado no debe romper la grilla completa.
 */

/** Convierte `start`/`end` (`Date | string`) a un `Date` válido; `null` si es inválido/ausente. */
export function parseEventDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Clave de agrupación por día calendario (año-mes-día), ignora la hora. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Lunes de la semana que contiene `date` (semana lunes→domingo), a medianoche. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=domingo
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface CalendarDayColumn<T extends SolCalendarEvent = SolCalendarEvent> {
  date: Date;
  isToday: boolean;
  events: T[];
}

/**
 * Construye las columnas de día con sus eventos ya agrupados: 1 columna para
 * `'day'`, `dayCount` columnas (desde el lunes de la semana de `currentDate`)
 * para `'week'`. Tolera `events` null/undefined y elementos `null`/`undefined`
 * dentro del arreglo (se filtran); un evento con `start` inválido/ausente se
 * excluye de TODAS las columnas (no puede ubicarse en ningún día) sin lanzar.
 *
 * LIMITACIÓN DOCUMENTADA (corrección 4R WARNING — reliability, re-gate PR6):
 * un evento se agrupa ÚNICAMENTE por el día calendario de `start` — un
 * evento que CRUZA MEDIANOCHE (p. ej. `start` 23:30 / `end` 00:30 del día
 * siguiente) aparece SOLO en la columna del día de `start`; NO se replica
 * ni se recorta al día de `end`. Vista mes/multi-día es no-meta de esta
 * versión (ya diferida) — soportar eventos multi-día correctamente
 * requeriría particionar el evento por día, alcance NUEVO fuera de esta
 * corrección. `computeEventTop`/`computeEventHeight` sí clampan la caja al
 * rango horario visible para que NUNCA se salga de la grilla, incluso
 * cuando el evento cruza medianoche.
 */
export function buildDayColumns<T extends SolCalendarEvent>(
  view: SolCalendarView,
  currentDate: Date,
  events: readonly (T | null | undefined)[] | null | undefined,
  dayCount: number,
): CalendarDayColumn<T>[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const safeDayCount = Math.max(1, Math.trunc(dayCount) || 1);
  const dates: Date[] =
    view === 'day'
      ? [new Date(currentDate)]
      : Array.from({ length: safeDayCount }, (_, i) => {
          const d = new Date(getWeekStart(currentDate));
          d.setDate(d.getDate() + i);
          return d;
        });

  const safeEvents = (events ?? []).filter((e): e is T => !!e);

  return dates.map((date) => {
    const key = dayKey(date);
    const dateCopy = new Date(date);
    dateCopy.setHours(0, 0, 0, 0);
    return {
      date,
      isToday: dateCopy.getTime() === today.getTime(),
      events: safeEvents.filter((e) => {
        const start = parseEventDate(e.start);
        return start ? dayKey(start) === key : false;
      }),
    };
  });
}

/**
 * Offset vertical (px) del evento dentro de la grilla, según su hora de
 * inicio relativa a `hourStart`. `start` inválido/ausente → `0` (degrada,
 * no lanza). Clampado a `[0, (hourEnd-hourStart)*hourPx - minHeightPx]`
 * (corrección 4R WARNING — reliability, re-gate PR6): un evento que empieza
 * antes de `hourStart` se clampa al borde superior; uno que empieza en o
 * después de `hourEnd` (p. ej. cruza medianoche, `start` 23:30 con
 * `hourEnd`=22) se clampa al borde inferior — reservando `minHeightPx` para
 * que la caja NUNCA se salga por debajo de la grilla visible.
 */
export function computeEventTop(
  event: SolCalendarEvent | null | undefined,
  hourStart: number,
  hourEnd: number,
  hourPx: number,
  minHeightPx = 22,
): number {
  const start = parseEventDate(event?.start);
  if (!start) return 0;
  const hoursFromStart = start.getHours() - hourStart + start.getMinutes() / 60;
  const maxTop = Math.max(0, (hourEnd - hourStart) * hourPx - minHeightPx);
  return Math.min(Math.max(0, hoursFromStart * hourPx), maxTop);
}

/**
 * Alto (px) del evento según la duración `end - start`. `start`/`end`
 * inválidos, ausentes, o duración no positiva → `minHeightPx` (degrada, no
 * lanza) — nunca menor que `minHeightPx` (visibilidad mínima garantizada).
 * Clampado (corrección 4R WARNING — reliability, re-gate PR6) para que
 * `top + height` NUNCA exceda el borde inferior de la grilla visible — un
 * evento que cruza medianoche (fuera de `[hourStart, hourEnd)`) ya no
 * produce una caja gigante fuera de la grilla; se recorta visualmente al
 * día de `start` (ver limitación documentada en `buildDayColumns`).
 */
export function computeEventHeight(
  event: SolCalendarEvent | null | undefined,
  hourStart: number,
  hourEnd: number,
  hourPx: number,
  minHeightPx = 22,
): number {
  const start = parseEventDate(event?.start);
  const end = parseEventDate(event?.end);
  if (!start || !end) return minHeightPx;

  const durationMin = (end.getTime() - start.getTime()) / 60_000;
  if (!Number.isFinite(durationMin) || durationMin <= 0) return minHeightPx;

  const rawHeight = Math.max((durationMin / 60) * hourPx, minHeightPx);
  const top = computeEventTop(event, hourStart, hourEnd, hourPx, minHeightPx);
  const gridHeight = (hourEnd - hourStart) * hourPx;
  const maxHeight = Math.max(minHeightPx, gridHeight - top);
  return Math.min(rawHeight, maxHeight);
}

/**
 * Offset (px) de la línea de "ahora" dentro del rango horario visible;
 * `-1` si "ahora" cae fuera de `[hourStart, hourEnd)` (no se muestra la línea).
 */
export function computeNowTop(now: Date, hourStart: number, hourEnd: number, hourPx: number): number {
  const h = now.getHours();
  const m = now.getMinutes();
  if (h < hourStart || h >= hourEnd) return -1;
  return (h - hourStart + m / 60) * hourPx;
}

/**
 * Frecuencia de `id` entre eventos — soporte de `safeEventTrackKey` (fix
 * NG0955 con id duplicado/ausente, mismo patrón que `kanban-track.ts` del
 * PR5a/`timeline-position.ts` del PR4 — duplicado localmente a propósito:
 * cada área de la librería mantiene su propia copia de esta utilidad
 * mínima, sin acoplar `ui/calendar` a `ui/kanban`).
 */
export function countEventIds(events: readonly ({ id?: unknown } | null | undefined)[] | null | undefined): Map<unknown, number> {
  const frequency = new Map<unknown, number>();
  for (const event of events ?? []) {
    if (!event) continue;
    frequency.set(event.id, (frequency.get(event.id) ?? 0) + 1);
  }
  return frequency;
}

/** Clave de `track` segura: el índice si `id` está ausente o duplicado; si no, el propio `id`. */
export function safeEventTrackKey(id: unknown, index: number, frequency: ReadonlyMap<unknown, number>): unknown {
  if (id == null) return index;
  return (frequency.get(id) ?? 0) > 1 ? index : id;
}

import {
  buildDayColumns,
  computeEventHeight,
  computeEventTop,
  computeNowTop,
  countEventIds,
  dayKey,
  getWeekStart,
  parseEventDate,
  safeEventTrackKey,
} from './calendar-layout';
import type { SolCalendarEvent } from './calendar.model';

interface DemoEvent extends SolCalendarEvent {
  clientName?: string;
}

describe('parseEventDate (pura)', () => {
  it('Date válido se devuelve tal cual (misma fecha)', () => {
    const d = new Date(2024, 0, 10, 9, 0);
    expect(parseEventDate(d)?.getTime()).toBe(d.getTime());
  });

  it('string ISO parseable se convierte a Date', () => {
    expect(parseEventDate('2024-01-10T09:00:00')?.getFullYear()).toBe(2024);
  });

  it('[robustez] string no parseable devuelve null, sin lanzar', () => {
    expect(() => parseEventDate('no-es-una-fecha')).not.toThrow();
    expect(parseEventDate('no-es-una-fecha')).toBeNull();
  });

  it('[robustez] null/undefined devuelve null', () => {
    expect(parseEventDate(null)).toBeNull();
    expect(parseEventDate(undefined)).toBeNull();
  });
});

describe('dayKey / getWeekStart (puras)', () => {
  it('dos fechas del mismo día calendario (distinta hora) producen la MISMA clave', () => {
    const a = new Date(2024, 0, 10, 8, 0);
    const b = new Date(2024, 0, 10, 23, 59);
    expect(dayKey(a)).toBe(dayKey(b));
  });

  it('getWeekStart de un miércoles devuelve el LUNES de esa semana, a medianoche', () => {
    const wednesday = new Date(2024, 0, 10); // 10 ene 2024 es miércoles
    const start = getWeekStart(wednesday);
    expect(start.getDay()).toBe(1); // lunes
    expect(start.getDate()).toBe(8);
    expect(start.getHours()).toBe(0);
  });

  it('getWeekStart de un domingo retrocede 6 días (caso borde day===0)', () => {
    const sunday = new Date(2024, 0, 14); // 14 ene 2024 es domingo
    const start = getWeekStart(sunday);
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(8);
  });
});

describe('buildDayColumns (pura)', () => {
  const currentDate = new Date(2024, 0, 10); // miércoles

  it('[spec] vista "day": devuelve UNA sola columna con la fecha dada', () => {
    const columns = buildDayColumns<DemoEvent>('day', currentDate, [], 7);
    expect(columns.length).toBe(1);
    expect(dayKey(columns[0].date)).toBe(dayKey(currentDate));
  });

  it('[spec] vista "week": devuelve `dayCount` columnas empezando el lunes de la semana', () => {
    const columns = buildDayColumns<DemoEvent>('week', currentDate, [], 7);
    expect(columns.length).toBe(7);
    expect(columns[0].date.getDay()).toBe(1); // lunes
  });

  it('vista "week" con dayCount=5 (preferencia móvil) devuelve 5 columnas (lunes–viernes)', () => {
    const columns = buildDayColumns<DemoEvent>('week', currentDate, [], 5);
    expect(columns.length).toBe(5);
    expect(columns[4].date.getDay()).toBe(5); // viernes
  });

  it('agrupa correctamente un evento en su columna de día, por start (ignorando la hora)', () => {
    const event: DemoEvent = {
      id: '1',
      title: 'Cita',
      start: new Date(2024, 0, 10, 9, 0),
      end: new Date(2024, 0, 10, 10, 0),
    };
    const columns = buildDayColumns<DemoEvent>('week', currentDate, [event], 7);
    const wednesdayColumn = columns.find((c) => c.date.getDay() === 3)!;
    expect(wednesdayColumn.events).toEqual([event]);
    expect(columns.filter((c) => c.events.length > 0).length).toBe(1);
  });

  it('marca `isToday` en la columna que corresponde a la fecha actual del sistema', () => {
    const today = new Date();
    const columns = buildDayColumns<DemoEvent>('day', today, [], 7);
    expect(columns[0].isToday).toBe(true);
  });

  it('[robustez] events null/undefined no lanza — columnas vacías', () => {
    expect(() => buildDayColumns<DemoEvent>('week', currentDate, null, 7)).not.toThrow();
    const columns = buildDayColumns<DemoEvent>('week', currentDate, undefined, 7);
    expect(columns.every((c) => c.events.length === 0)).toBe(true);
  });

  it('[robustez] un elemento null dentro de `events` se filtra sin lanzar', () => {
    const event: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) };
    expect(() => buildDayColumns<DemoEvent>('week', currentDate, [null as unknown as DemoEvent, event], 7)).not.toThrow();
  });

  it('[robustez] un evento con `start` inválido/ausente no aparece en NINGUNA columna, sin lanzar', () => {
    const malformed: DemoEvent = { id: '1', title: 'Cita', start: 'fecha-invalida', end: new Date(2024, 0, 10, 10, 0) };
    const columns = buildDayColumns<DemoEvent>('week', currentDate, [malformed], 7);
    expect(columns.every((c) => c.events.length === 0)).toBe(true);
  });

  it('[robustez] dayCount inválido (0, negativo, NaN) se clampa a 1, sin lanzar', () => {
    expect(() => buildDayColumns<DemoEvent>('week', currentDate, [], 0)).not.toThrow();
    expect(buildDayColumns<DemoEvent>('week', currentDate, [], 0).length).toBe(1);
    expect(buildDayColumns<DemoEvent>('week', currentDate, [], -3).length).toBe(1);
    expect(buildDayColumns<DemoEvent>('week', currentDate, [], NaN).length).toBe(1);
  });
});

describe('computeEventTop (pura)', () => {
  it('evento a las 9:00 con hourStart=6, hourPx=60 → top = 180 (3 horas × 60px)', () => {
    const event: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) };
    expect(computeEventTop(event, 6, 60)).toBe(180);
  });

  it('evento a las 9:30 con hourPx=60 incluye los minutos proporcionalmente (210px)', () => {
    const event: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 9, 30), end: new Date(2024, 0, 10, 10, 0) };
    expect(computeEventTop(event, 6, 60)).toBe(210);
  });

  it('escala correctamente con hourPx≠60 (p. ej. 9:30 con hourPx=40 → 3.5h × 40 = 140px)', () => {
    const event: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 9, 30), end: new Date(2024, 0, 10, 10, 0) };
    expect(computeEventTop(event, 6, 40)).toBe(140);
  });

  it('un evento que empieza ANTES de hourStart se clampa a 0 (no negativo)', () => {
    const event: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 5, 0), end: new Date(2024, 0, 10, 6, 0) };
    expect(computeEventTop(event, 6, 60)).toBe(0);
  });

  it('[robustez] event/start inválido o ausente → 0, sin lanzar', () => {
    expect(computeEventTop(null, 6, 60)).toBe(0);
    expect(computeEventTop({ id: '1', title: 'X', start: 'invalido', end: new Date() }, 6, 60)).toBe(0);
  });
});

describe('computeEventHeight (pura)', () => {
  it('evento de 9:00 a 10:00 con hourPx=60 → 60px (1 hora)', () => {
    const event: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) };
    expect(computeEventHeight(event, 60)).toBe(60);
  });

  it('evento de 30 minutos con hourPx=60 → 30px', () => {
    const event: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 9, 30) };
    expect(computeEventHeight(event, 60)).toBe(30);
  });

  it('escala correctamente con hourPx≠60 (1 hora con hourPx=40 → 40px, por encima del mínimo)', () => {
    const event: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) };
    expect(computeEventHeight(event, 40)).toBe(40);
  });

  it('un evento MUY corto (5 min) respeta la altura mínima (22px default)', () => {
    const event: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 9, 5) };
    expect(computeEventHeight(event, 60)).toBe(22);
  });

  it('[robustez] end anterior o igual a start (duración ≤ 0) → altura mínima, sin lanzar', () => {
    const inverted: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 10, 0), end: new Date(2024, 0, 10, 9, 0) };
    expect(computeEventHeight(inverted, 60)).toBe(22);
    const same: DemoEvent = { id: '1', title: 'Cita', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 9, 0) };
    expect(computeEventHeight(same, 60)).toBe(22);
  });

  it('[robustez] start/end inválidos o ausentes → altura mínima, sin lanzar', () => {
    expect(computeEventHeight(null, 60)).toBe(22);
    expect(computeEventHeight({ id: '1', title: 'X', start: 'invalido', end: 'tambien-invalido' }, 60)).toBe(22);
  });
});

describe('computeNowTop (pura)', () => {
  it('"ahora" dentro del rango horario visible devuelve un offset correcto', () => {
    const now = new Date(2024, 0, 10, 9, 30);
    expect(computeNowTop(now, 6, 22, 60)).toBe(210);
  });

  it('"ahora" fuera del rango (antes de hourStart o después de hourEnd) devuelve -1', () => {
    expect(computeNowTop(new Date(2024, 0, 10, 5, 0), 6, 22, 60)).toBe(-1);
    expect(computeNowTop(new Date(2024, 0, 10, 23, 0), 6, 22, 60)).toBe(-1);
  });

  it('"ahora" exactamente en hourEnd (borde exclusivo) devuelve -1', () => {
    expect(computeNowTop(new Date(2024, 0, 10, 22, 0), 6, 22, 60)).toBe(-1);
  });
});

describe('countEventIds / safeEventTrackKey (puras, fix NG0955)', () => {
  it('un id ausente o duplicado cae al índice de la iteración — nunca lanza', () => {
    const events = [{ id: 'dup' }, { id: 'dup' }, { id: undefined }];
    const frequency = countEventIds(events);

    expect(safeEventTrackKey('dup', 0, frequency)).toBe(0);
    expect(safeEventTrackKey('dup', 1, frequency)).toBe(1);
    expect(safeEventTrackKey(undefined, 2, frequency)).toBe(2);
  });

  it('un id único (no duplicado) se usa tal cual como clave de track', () => {
    const events = [{ id: 'a' }, { id: 'b' }];
    const frequency = countEventIds(events);

    expect(safeEventTrackKey('a', 0, frequency)).toBe('a');
    expect(safeEventTrackKey('b', 1, frequency)).toBe('b');
  });

  it('[robustez] events null/undefined o con elementos null no lanza', () => {
    expect(() => countEventIds(null)).not.toThrow();
    expect(() => countEventIds(undefined)).not.toThrow();
    expect(() => countEventIds([null, { id: '1' }])).not.toThrow();
  });
});

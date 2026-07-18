/**
 * Contrato genérico de `sol-calendar` (spec: solercia-ui-calendar). Sin
 * conocimiento de dominio: NUNCA referencia `clientName`/`professionalName`/
 * `stateId`/`stateName` (eso es dominio de citas, hoy en
 * `boki-front/src/widgets/calendar`) — el consumidor extiende `data` con su
 * propio modelo y proyecta su propio contenido de evento vía `eventTemplate`
 * (spec#Cuerpo de tarjeta por template proyectado).
 */

/**
 * Evento genérico de calendario. `start`/`end` aceptan `Date` o `string`
 * (ISO parseable) — la librería los normaliza internamente y degrada sin
 * lanzar ante un valor inválido (lecciones PR3/PR4/PR5: robustez de
 * entrada).
 *
 * LIMITACIÓN DOCUMENTADA (corrección 4R WARNING, re-gate PR6): un evento que
 * CRUZA MEDIANOCHE (`start` y `end` en días calendario distintos) se agrupa
 * y renderiza ÚNICAMENTE en el día de `start` — no se replica ni se recorta
 * al día de `end`. La caja se clampa al rango horario visible (nunca se
 * sale de la grilla), pero el soporte completo de eventos multi-día es
 * no-meta de esta versión (vista mes/multi-día ya diferida — ver
 * `calendar-layout.ts#buildDayColumns`).
 */
export interface SolCalendarEvent {
  id: string | number;
  start: Date | string;
  end: Date | string;
  title: string;
  /**
   * Color CSS opcional, resuelto por `SolCalendarColorStrategy`
   * (spec#Resolución de color por Strategy inyectable). Sin `color`
   * explícito, la estrategia por defecto usa una superficie neutra — la
   * librería NUNCA asume una paleta de dominio.
   *
   * SOLO se acepta hex (`#rgb`/`#rrggbb`/`#rrggbbaa`), notación funcional
   * (`rgb()`/`rgba()`/`hsl()`/`hsla()`) o una referencia a token
   * (`var(--sol-*)`) — corrección 4R WARNING (risk): cualquier otro valor
   * (p. ej. `url(...)`, un vector de "CSS beacon" hacia una petición de
   * red) se rechaza y degrada a la superficie neutra por defecto. Ver
   * `calendar-color.ts#isSafeCssColor`.
   */
  color?: string;
  /** Passthrough para el template proyectado — el consumidor guarda ahí su propio modelo (p. ej. una cita completa). */
  data?: unknown;
}

/**
 * Vista soportada en esta versión (spec#paridad de vistas semana/día). Vista
 * mes y arrastrar-para-reagendar (`eventDropped`) quedan DIFERIDOS — decisión
 * ratificada, documentada, no implementados en 0.2.0 (`'month'` NO existe en
 * este tipo a propósito).
 */
export type SolCalendarView = 'week' | 'day';

/**
 * Entrada de leyenda totalmente controlada por el consumidor
 * (spec#Leyenda configurable) — la librería NUNCA deriva una leyenda
 * hardcodeada de estados de dominio. `labelKey` se resuelve vía `SOL_I18N`
 * con el catálogo del CONSUMIDOR (la librería no conoce el significado).
 */
export interface SolCalendarLegendItem {
  color: string;
  labelKey: string;
}

/** Conjunto de colores resuelto para un evento — mismo shape que el `StateColorSet` histórico del widget de citas, ahora genérico. */
export interface StateColorSet {
  bg: string;
  border: string;
  text: string;
}

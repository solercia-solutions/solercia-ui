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
 */
export interface SolCalendarEvent {
  id: string | number;
  start: Date | string;
  end: Date | string;
  title: string;
  /**
   * Color CSS opcional (hex/rgb/`var(--...)`), resuelto por
   * `SolCalendarColorStrategy` (spec#Resolución de color por Strategy
   * inyectable). Sin `color` explícito, la estrategia por defecto usa una
   * superficie neutra — la librería NUNCA asume una paleta de dominio.
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

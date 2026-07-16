/**
 * Nodo genérico y recursivo del timeline jerárquico (spec:
 * solercia-ui-timeline#Modelo genérico jerárquico). Sin conocimiento de
 * dominio: NUNCA referencia `epic`/`sprint`/`historia de usuario` — el
 * consumidor mapea su propio modelo a este contrato.
 *
 * `label`/`labelKey` son mutuamente alternativos: `label` para texto crudo
 * (dato del consumidor, p. ej. el nombre de un proyecto — no es copy de UI),
 * `labelKey` para una clave i18n cuando la etiqueta SÍ es texto genérico de
 * UI. Si ninguno se da, la fila se renderiza sin etiqueta (cadena vacía).
 */
export interface TimelineNode {
  id: string | number;
  label?: string;
  labelKey?: string;
  /** Tolera `string`/`Date`/`null`/`undefined`; una fecha inválida se trata como ausente. */
  start?: string | Date | null;
  end?: string | Date | null;
  /** Estado genérico → color vía `statusToken` (default: `ui/tone/sol-tone.ts`). */
  status?: string;
  children?: TimelineNode[];
  /**
   * Estado INICIAL de colapso al montar. El componente lo copia a un estado
   * interno propio (patrón "espejo", igual que `sol-kanban-board`) — clics
   * posteriores NO mutan este objeto de entrada.
   */
  collapsed?: boolean;
}

/** Entrada de leyenda: `status` (el mismo valor que trae `TimelineNode.status`) + clave i18n del texto. */
export interface TimelineLegendItem {
  status: string;
  labelKey: string;
}

/** Resuelve un `status` genérico a un color CSS (`var(--sol-color-*)` u otro). */
export type SolTimelineStatusResolver = (status: string | undefined) => string;

/** Rango de fechas en epoch-ms (inclusivo), usado por el motor de posicionamiento. */
export interface SolTimelineRange {
  start: number;
  end: number;
}

import { TONE_COLOR, type SolTone } from '../tone/sol-tone';
import type {
  SolTimelineRange,
  SolTimelineStatusResolver,
  TimelineNode,
} from './timeline.model';

/**
 * Motor de posicionamiento del timeline (spec: solercia-ui-timeline, design.md
 * D5) — generaliza a N niveles el cálculo `%` de `sprint-timeline` de
 * `gestion_proyectos`. PURO en su totalidad: sin Angular, sin DOM, sin
 * dependencias externas (spec#Sin dependencias externas).
 *
 * Robustez de entrada (lección del PR3 — CRITICAL de `sol-avatar`): TODAS las
 * funciones exportadas toleran `nodes` nulo/indefinido y fechas inválidas sin
 * lanzar — Angular no garantiza que un `input.required()` resuelva a un valor
 * no-nulo en runtime, y las fechas suelen venir de una API externa.
 */

const MIN_WIDTH_PCT = 2; // igual que sprint-timeline: barras mínimamente visibles

export interface PositionedTimelineRow {
  node: TimelineNode;
  depth: number;
  leftPct: number;
  widthPct: number;
}

interface ResolvedRange {
  start: number;
  end: number;
}

/** `string | Date | null | undefined` → epoch-ms, o `null` si falta o es inválida. */
function toValidTime(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/** Rango PROPIO de un nodo (ambas fechas válidas), o `null` si le falta alguna. */
function ownRange(node: TimelineNode): ResolvedRange | null {
  const start = toValidTime(node.start);
  const end = toValidTime(node.end);
  return start !== null && end !== null ? { start, end } : null;
}

/**
 * Rango efectivo de un nodo: el propio si lo tiene; si no, la ENVOLVENTE
 * recursiva de sus hijos (min/max de los rangos resueltos de los hijos, que a
 * su vez pueden ser envolventes) — spec#Barra envolvente del padre. `null`
 * si el nodo (y todo su subárbol) no tiene ninguna fecha resoluble.
 */
function resolveNodeRange(node: TimelineNode): ResolvedRange | null {
  const own = ownRange(node);
  if (own) return own;

  const childRanges = (node.children ?? [])
    .map(resolveNodeRange)
    .filter((r): r is ResolvedRange => r !== null);
  if (childRanges.length === 0) return null;

  return {
    start: Math.min(...childRanges.map((r) => r.start)),
    end: Math.max(...childRanges.map((r) => r.end)),
  };
}

/**
 * Rango global del timeline: `min(start)/max(end)` sobre TODAS las HOJAS
 * (nodos sin hijos) con ambas fechas válidas — un nodo intermedio con fechas
 * propias no participa por sí solo (su rango ya se refleja en sus hojas).
 * `null` si ninguna hoja tiene fechas resolubles.
 */
export function computeGlobalRange(nodes: TimelineNode[] | null | undefined): SolTimelineRange | null {
  const times: number[] = [];

  const walk = (list: TimelineNode[]) => {
    for (const node of list) {
      if (!node) continue;
      const children = node.children ?? [];
      if (children.length === 0) {
        const range = ownRange(node);
        if (range) {
          times.push(range.start, range.end);
        }
      } else {
        walk(children);
      }
    }
  };
  walk(nodes ?? []);

  if (times.length === 0) return null;
  return { start: Math.min(...times), end: Math.max(...times) };
}

/**
 * Aplana `nodes` a filas posicionadas (`leftPct`/`widthPct` como % de
 * `range`), recorriendo hasta N niveles. Un nodo (y todo su subárbol) SIN
 * fecha resoluble se omite aquí — se maneja aparte, ver
 * {@link collectUndatedNodes} (spec: sección "sin fechas", igual que
 * `sprint-timeline` hoy). Los hijos de un nodo colapsado (según
 * `options.isCollapsed`, o `node.collapsed` por defecto) no se incluyen.
 */
export function positionRows(
  nodes: TimelineNode[] | null | undefined,
  range: SolTimelineRange,
  options?: { depth?: number; isCollapsed?: (node: TimelineNode) => boolean },
): PositionedTimelineRow[] {
  const depth = options?.depth ?? 0;
  const isCollapsed = options?.isCollapsed ?? ((node: TimelineNode) => !!node.collapsed);
  const totalMs = range.end - range.start;
  const rows: PositionedTimelineRow[] = [];

  for (const node of nodes ?? []) {
    if (!node) continue;
    const nodeRange = resolveNodeRange(node);
    if (!nodeRange) continue; // sin fecha resoluble en todo el subárbol → sección aparte

    const leftPct = totalMs > 0 ? ((nodeRange.start - range.start) / totalMs) * 100 : 0;
    const rawWidthPct = totalMs > 0 ? ((nodeRange.end - nodeRange.start) / totalMs) * 100 : 100;
    rows.push({ node, depth, leftPct, widthPct: Math.max(rawWidthPct, MIN_WIDTH_PCT) });

    if (!isCollapsed(node) && node.children?.length) {
      rows.push(...positionRows(node.children, range, { depth: depth + 1, isCollapsed }));
    }
  }

  return rows;
}

/**
 * Recorre `nodes` y devuelve, en una lista PLANA (sin jerarquía — igual que
 * `sprint-timeline` hoy), todo nodo cuyo subárbol completo no tenga ninguna
 * fecha resoluble. Un nodo con fecha propia o con AL MENOS un descendiente
 * con fecha no entra aquí (se posiciona vía {@link positionRows}).
 */
export function collectUndatedNodes(nodes: TimelineNode[] | null | undefined): TimelineNode[] {
  const result: TimelineNode[] = [];
  for (const node of nodes ?? []) {
    if (!node) continue;
    if (resolveNodeRange(node) === null) {
      result.push(node);
    } else if (node.children?.length) {
      result.push(...collectUndatedNodes(node.children));
    }
  }
  return result;
}

export interface SolTimelineAxisTick {
  leftPct: number;
  year: number;
  month: number; // 0-11
}

/**
 * Marcas del eje temporal (un tick por mes dentro de `range`, más el límite
 * final). PURA y AGNÓSTICA de i18n a propósito: devuelve `{year, month}`
 * crudos — el componente resuelve el nombre del mes por clave i18n (spec:
 * eje temporal en español, cero texto hardcodeado).
 */
export function computeMonthAxisTicks(range: SolTimelineRange): SolTimelineAxisTick[] {
  const { start, end } = range;
  if (!(end > start)) return [];
  const totalMs = end - start;
  const ticks: SolTimelineAxisTick[] = [];

  const startDate = new Date(start);
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor.getTime() <= end) {
    const leftPct = ((cursor.getTime() - start) / totalMs) * 100;
    if (leftPct >= 0 && leftPct <= 100) {
      ticks.push({ leftPct, year: cursor.getFullYear(), month: cursor.getMonth() });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const endDate = new Date(end);
  ticks.push({ leftPct: 100, year: endDate.getFullYear(), month: endDate.getMonth() });
  return ticks;
}

const DEFAULT_STATUS_TONE: Record<string, SolTone> = {
  active: 'info',
  inprogress: 'info',
  done: 'success',
  completed: 'success',
  closed: 'success',
  blocked: 'danger',
  atrisk: 'warning',
  pending: 'neutral',
};

/**
 * Resolución de color por defecto cuando el consumidor no da `statusToken`:
 * normaliza `status` (minúsculas, sin espacios) contra un mapa reducido de
 * estados comunes → `SolTone`; cualquier estado no reconocido cae a
 * `'neutral'`. Reutiliza `ui/tone/sol-tone.ts` (mismo mapa que
 * `sol-score-badge`/`sol-trend`) en vez de inventar colores nuevos.
 */
export const defaultStatusToken: SolTimelineStatusResolver = (status) => {
  const key = status?.trim().toLowerCase().replace(/[\s_-]/g, '') ?? '';
  const tone = DEFAULT_STATUS_TONE[key] ?? 'neutral';
  return TONE_COLOR[tone];
};

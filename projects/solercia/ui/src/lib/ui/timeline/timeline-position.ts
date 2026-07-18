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

/**
 * Rango PROPIO de un nodo (ambas fechas válidas Y `start <= end`), o `null`
 * si le falta alguna o vienen invertidas. Fechas invertidas (`start > end`)
 * se tratan como "sin fecha" — igual criterio que una fecha ausente/inválida
 * (hallazgo de review: NUNCA posicionar una barra con rango negativo).
 */
function ownRange(node: TimelineNode): ResolvedRange | null {
  const start = toValidTime(node.start);
  const end = toValidTime(node.end);
  if (start === null || end === null || start > end) return null;
  return { start, end };
}

/**
 * Rango efectivo de un nodo: UNIÓN de su rango propio (si lo tiene) con la
 * envolvente recursiva de sus hijos (min/max de los rangos resueltos de los
 * hijos, que a su vez pueden ser envolventes) — spec#Barra envolvente del
 * padre. `null` si el nodo (y todo su subárbol) no tiene ninguna fecha
 * resoluble.
 *
 * CRÍTICO: este es el ÚNICO criterio de rango de un nodo en todo el motor —
 * {@link computeGlobalRange} llama a esta MISMA función sobre cada raíz (no
 * un cálculo aparte "solo hojas"). Antes del fix, computeGlobalRange
 * ignoraba las fechas propias de un nodo con hijos, mientras que esta
 * función SÍ las usaba (y ahí paraba, sin unir con los hijos) — la
 * asimetría producía barras fuera de `[0,100]` (un padre con fecha propia
 * más ancha que sus hijos quedaba posicionado contra un rango global más
 * angosto que el suyo propio).
 *
 * `visited` protege contra CICLOS (`node.children` que se referencia a sí
 * mismo, directa o transitivamente): un nodo ya visitado en esta misma
 * llamada-raíz corta con `null` en vez de recursar sin fin.
 */
function resolveNodeRange(node: TimelineNode, visited: WeakSet<TimelineNode> = new WeakSet()): ResolvedRange | null {
  if (visited.has(node)) return null;
  visited.add(node);

  const own = ownRange(node);
  const childRanges = (node.children ?? [])
    .filter((child): child is TimelineNode => !!child)
    .map((child) => resolveNodeRange(child, visited))
    .filter((r): r is ResolvedRange => r !== null);

  if (childRanges.length === 0) return own;

  const envelope = {
    start: Math.min(...childRanges.map((r) => r.start)),
    end: Math.max(...childRanges.map((r) => r.end)),
  };
  if (!own) return envelope;

  return {
    start: Math.min(own.start, envelope.start),
    end: Math.max(own.end, envelope.end),
  };
}

/**
 * Rango global del timeline: `min(start)/max(end)` de {@link resolveNodeRange}
 * sobre cada nodo RAÍZ de `nodes` — MISMO criterio que posiciona la barra de
 * cada nodo individual (ver el comentario de `resolveNodeRange`). `null` si
 * ninguna raíz tiene un rango resoluble.
 */
export function computeGlobalRange(nodes: TimelineNode[] | null | undefined): SolTimelineRange | null {
  const ranges = (nodes ?? [])
    .filter((node): node is TimelineNode => !!node)
    .map((node) => resolveNodeRange(node))
    .filter((r): r is ResolvedRange => r !== null);

  if (ranges.length === 0) return null;
  return {
    start: Math.min(...ranges.map((r) => r.start)),
    end: Math.max(...ranges.map((r) => r.end)),
  };
}

/**
 * Aplana `nodes` a filas posicionadas (`leftPct`/`widthPct` como % de
 * `range`), recorriendo hasta N niveles. Un nodo (y todo su subárbol) SIN
 * fecha resoluble se omite aquí — se maneja aparte, ver
 * {@link collectUndatedNodes} (spec: sección "sin fechas", igual que
 * `sprint-timeline` hoy). Los hijos de un nodo colapsado (según
 * `options.isCollapsed`, o `node.collapsed` por defecto) no se incluyen.
 *
 * `leftPct`/`widthPct` se CLAMPEAN a `[0,100]` como red defensiva adicional
 * (aunque `resolveNodeRange`/`computeGlobalRange` ya comparten criterio y no
 * deberían producir valores fuera de rango).
 *
 * `options.visited` protege contra CICLOS en la propia estructura del árbol
 * (`node.children` recorrido aquí directamente, independiente de la guarda
 * interna de `resolveNodeRange`): un nodo ya visitado en esta llamada se
 * omite en vez de recursar sin fin.
 */
export function positionRows(
  nodes: TimelineNode[] | null | undefined,
  range: SolTimelineRange,
  options?: { depth?: number; isCollapsed?: (node: TimelineNode) => boolean; visited?: WeakSet<TimelineNode> },
): PositionedTimelineRow[] {
  const depth = options?.depth ?? 0;
  const isCollapsed = options?.isCollapsed ?? ((node: TimelineNode) => !!node.collapsed);
  const visited = options?.visited ?? new WeakSet<TimelineNode>();
  const totalMs = range.end - range.start;
  const rows: PositionedTimelineRow[] = [];

  for (const node of nodes ?? []) {
    if (!node || visited.has(node)) continue;
    visited.add(node);

    const nodeRange = resolveNodeRange(node);
    if (!nodeRange) continue; // sin fecha resoluble en todo el subárbol → sección aparte

    const rawLeftPct = totalMs > 0 ? ((nodeRange.start - range.start) / totalMs) * 100 : 0;
    const rawWidthPct = totalMs > 0 ? ((nodeRange.end - nodeRange.start) / totalMs) * 100 : 100;

    const leftPct = Math.min(Math.max(rawLeftPct, 0), 100);
    const widthPct = Math.min(Math.max(rawWidthPct, MIN_WIDTH_PCT), 100 - leftPct);

    rows.push({ node, depth, leftPct, widthPct });

    if (!isCollapsed(node) && node.children?.length) {
      rows.push(...positionRows(node.children, range, { depth: depth + 1, isCollapsed, visited }));
    }
  }

  return rows;
}

/**
 * Recorre `nodes` y devuelve, en una lista PLANA (sin jerarquía — igual que
 * `sprint-timeline` hoy), todo nodo cuyo subárbol completo no tenga ninguna
 * fecha resoluble. Un nodo con fecha propia o con AL MENOS un descendiente
 * con fecha no entra aquí (se posiciona vía {@link positionRows}).
 * `visited` protege contra ciclos, igual que en `positionRows`.
 */
export function collectUndatedNodes(
  nodes: TimelineNode[] | null | undefined,
  visited: WeakSet<TimelineNode> = new WeakSet(),
): TimelineNode[] {
  const result: TimelineNode[] = [];
  for (const node of nodes ?? []) {
    if (!node || visited.has(node)) continue;
    visited.add(node);

    if (resolveNodeRange(node) === null) {
      result.push(node);
    } else if (node.children?.length) {
      result.push(...collectUndatedNodes(node.children, visited));
    }
  }
  return result;
}

export interface SolTimelineAxisTick {
  leftPct: number;
  year: number;
  month: number; // 0-11
}

const AXIS_TICK_EPSILON = 1e-9;

/**
 * Marcas del eje temporal (un tick por mes dentro de `range`, más el límite
 * final). PURA y AGNÓSTICA de i18n a propósito: devuelve `{year, month}`
 * crudos — el componente resuelve el nombre del mes por clave i18n (spec:
 * eje temporal en español, cero texto hardcodeado).
 *
 * DEDUPLICA el tick final contra el último generado por el bucle: si `end`
 * cae EXACTO en el 1º de un mes, el bucle ya agrega ese tick en `leftPct=100`
 * — sumar el tick de cierre de nuevo produciría dos entradas idénticas
 * (misma posición, mismo mes) y rompería el `@for track` del componente
 * (`NG0955`, clave de tracking duplicada).
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

  const last = ticks[ticks.length - 1];
  const lastIsAlreadyBoundary = !!last && Math.abs(last.leftPct - 100) < AXIS_TICK_EPSILON;
  if (!lastIsAlreadyBoundary) {
    const endDate = new Date(end);
    ticks.push({ leftPct: 100, year: endDate.getFullYear(), month: endDate.getMonth() });
  } else {
    last.leftPct = 100; // asienta el redondeo de punto flotante exactamente en el borde
  }
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
 *
 * `typeof status === 'string'` ANTES de `.trim()` (no solo `status?.`):
 * un `status` no-string (dato malformado o de un futuro esquema numérico)
 * pasaría el chequeo de nulidad de `?.` pero `.trim` no existe en un
 * `number` — mismo bug de forma que el `name` de `sol-avatar` en el PR3.
 */
export const defaultStatusToken: SolTimelineStatusResolver = (status) => {
  const key = typeof status === 'string' ? status.trim().toLowerCase().replace(/[\s_-]/g, '') : '';
  const tone = DEFAULT_STATUS_TONE[key] ?? 'neutral';
  return TONE_COLOR[tone];
};

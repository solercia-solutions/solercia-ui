import type { SolFlowCanvasEdge, SolFlowCanvasNode, SolFlowCanvasPosition } from './flow-canvas.model';

/**
 * Motor de auto-layout de `sol-flow-canvas` (Ola 5 PR-C1) — PURO, sin
 * Angular, sin DOM. Deliberadamente SIMPLE: capas por BFS desde las raíces
 * (nodos sin arista entrante), sin minimizar cruces ni enrutar curvas — el
 * motor real (dagre/ELK) es un entregable EXPLÍCITO de PR-C3 (GOAL §4:
 * "Persistencia de posiciones + auto-layout (dagre/ELK)"), no de C1. Este
 * placeholder solo necesita ubicar nodos SIN posición de forma legible y
 * determinística mientras la columna `canvas_position` de boki-ai no exista.
 *
 * BFS de "primer toque gana" (NUNCA recalcula la profundidad de un nodo ya
 * visitado) a propósito: un layout por camino MÁS LARGO sería más prolijo en
 * grafos en diamante, pero puede DIVERGER en un ciclo LEGAL (p. ej. un nodo
 * de recolección que vuelve sobre sí mismo tras un `interrupt()` — ver
 * `FlowValidator._validate_cycles` en boki-ai) si se recalculara la
 * profundidad cada vez que se re-alcanza un nodo. BFS clásico visita cada
 * nodo UNA sola vez → termina siempre, incluso con ciclos.
 */

const COLUMN_GAP_PX = 220;
const ROW_GAP_PX = 120;

/**
 * Calcula una posición `{x,y}` para CADA nodo de `nodes`, en capas
 * horizontales según la distancia (BFS) desde la raíz más cercana. Nodos sin
 * arista entrante son raíces (columna 0); un grafo sin aristas (o
 * completamente cíclico, sin ninguna raíz) trata CADA nodo como su propia
 * raíz. Aristas que referencian un nodo ausente en `nodes` se ignoran.
 *
 * Robustez de entrada (mismo criterio que el resto de `@solercia/ui`):
 * `nodes`/`edges` toleran `null`/`undefined` sin lanzar.
 */
export function computeAutoLayoutPositions(
  nodes: readonly SolFlowCanvasNode[] | null | undefined,
  edges: readonly SolFlowCanvasEdge[] | null | undefined,
): Map<string, SolFlowCanvasPosition> {
  const safeNodes = (nodes ?? []).filter((n): n is SolFlowCanvasNode => !!n);
  const safeEdges = (edges ?? []).filter((e): e is SolFlowCanvasEdge => !!e);
  const ids = safeNodes.map((n) => n.id);
  const idSet = new Set(ids);

  const outgoing = new Map<string, string[]>();
  const hasIncoming = new Set<string>();
  for (const edge of safeEdges) {
    if (!idSet.has(edge.sourceId) || !idSet.has(edge.targetId)) continue;
    const list = outgoing.get(edge.sourceId) ?? [];
    list.push(edge.targetId);
    outgoing.set(edge.sourceId, list);
    hasIncoming.add(edge.targetId);
  }

  const roots = ids.filter((id) => !hasIncoming.has(id));
  const seeds = [...(roots.length > 0 ? roots : ids)].sort(); // orden determinista, independiente del orden de inserción

  const depthOf = new Map<string, number>();
  const queue: string[] = [];
  for (const seed of seeds) {
    if (depthOf.has(seed)) continue;
    depthOf.set(seed, 0);
    queue.push(seed);
  }
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const depth = depthOf.get(current) as number;
    for (const next of outgoing.get(current) ?? []) {
      if (depthOf.has(next)) continue; // primer toque gana — ver docstring del módulo (evita divergir en ciclos)
      depthOf.set(next, depth + 1);
      queue.push(next);
    }
  }
  for (const id of ids) {
    if (!depthOf.has(id)) depthOf.set(id, 0); // inalcanzable desde cualquier raíz (grafo desconectado): columna propia
  }

  const byDepth = new Map<number, string[]>();
  for (const id of ids) {
    const depth = depthOf.get(id) as number;
    const bucket = byDepth.get(depth) ?? [];
    bucket.push(id);
    byDepth.set(depth, bucket);
  }

  const positions = new Map<string, SolFlowCanvasPosition>();
  for (const [depth, bucket] of byDepth) {
    const ordered = [...bucket].sort(); // filas deterministas dentro de la misma columna
    ordered.forEach((id, index) => {
      positions.set(id, { x: depth * COLUMN_GAP_PX, y: index * ROW_GAP_PX });
    });
  }
  return positions;
}

/**
 * Frecuencia de `id` entre los nodos actuales — soporte de {@link safeTrackKey}
 * (fix NG0955 con id duplicado/ausente). Duplicado A PROPÓSITO de
 * `ui/kanban/kanban-track.ts`/`ui/timeline`/`ui/calendar` (mismo criterio ya
 * documentado en `calendar-grid.component.ts::observeMobileViewport`): cada
 * componente de `@solercia/ui` que necesita esto mantiene su propia copia
 * mínima en vez de crear un acoplamiento cruzado entre carpetas de `ui/*`.
 */
export function countNodeIds(nodes: readonly SolFlowCanvasNode[]): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const node of nodes) {
    if (!node) continue;
    frequency.set(node.id, (frequency.get(node.id) ?? 0) + 1);
  }
  return frequency;
}

/** `track` seguro: cae al índice si el id está ausente o duplicado. */
export function safeTrackKey(id: string | undefined, index: number, frequency: Map<string, number>): unknown {
  if (id === undefined || id === null || (frequency.get(id) ?? 0) > 1) return index;
  return id;
}

/**
 * Frecuencia de `id` entre las edges actuales — soporte de {@link safeTrackKey}
 * aplicado a las aristas (fix NG0955 con id duplicado — antes solo los nodos
 * tenían este resguardo; C2, 4R Ola 5). Copia mínima A PROPÓSITO de
 * {@link countNodeIds} sobre una colección distinta (edges, no nodos) — mismo
 * criterio de duplicación deliberada documentado arriba.
 */
export function countEdgeIds(edges: readonly SolFlowCanvasEdge[]): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const edge of edges) {
    if (!edge) continue;
    frequency.set(edge.id, (frequency.get(edge.id) ?? 0) + 1);
  }
  return frequency;
}

import { graphlib, layout as dagreLayout } from '@dagrejs/dagre';
import type { SolFlowCanvasEdge, SolFlowCanvasNode, SolFlowCanvasPosition } from './flow-canvas.model';

/**
 * Motor de auto-layout de `sol-flow-canvas` (Ola 5 PR-C3 — GOAL §4:
 * "Persistencia de posiciones + auto-layout (dagre/ELK)", reemplaza el
 * placeholder BFS-por-capas de PR-C1) — PURO, sin Angular, sin DOM.
 *
 * `@dagrejs/dagre` (MIT, fork mantenido del `dagre` original — verificado
 * `npm view @dagrejs/dagre license` antes de instalar; su única dependencia,
 * `@dagrejs/graphlib`, también MIT) implementa el algoritmo de Sugiyama
 * (ranking + minimización de cruces + posicionamiento) — a diferencia del
 * BFS de "primer toque gana" que reemplaza, resuelve el ranking GLOBAL
 * respetando TODAS las aristas simultáneamente (una rama más larga hacia el
 * mismo destino empuja el rango real, no solo el del primer camino
 * visitado) y reordena filas dentro de cada rango para minimizar cruces
 * visuales — ver los casos "DIAMANTE"/"MINIMIZA cruces" en
 * `flow-canvas-layout.spec.ts`, que el BFS anterior NO podía satisfacer.
 *
 * Encapsulado DETRÁS de esta función pura — ningún componente de la app
 * (`boki-front`) importa `@dagrejs/dagre` directo; solo consume
 * `SolFlowCanvasComponent.autoLayout()`, que delega en `computeAutoLayoutPositions`
 * (sin cambios en su firma ni en la del método público — mismo criterio de
 * encapsulación que `sol-chart` con `chart.js`).
 *
 * `rankdir: 'LR'` (izquierda→derecha) — mismo eje horizontal que las curvas
 * bezier de `flow-canvas-edge-geometry.ts`. `NODE_WIDTH_PX`/`NODE_HEIGHT_PX`
 * duplican a propósito las mismas constantes de `flow-canvas.component.ts`
 * (mismo criterio de duplicación deliberada ya documentado en este archivo
 * para `countNodeIds`/`countEdgeIds`: cada módulo de `@solercia/ui` que las
 * necesita mantiene su propia copia mínima en vez de un acoplamiento
 * cruzado). dagre devuelve el CENTRO de cada nodo; `sol-flow-canvas`
 * posiciona por esquina superior izquierda (`resolvedPosition`/`nodeCenter`
 * en el componente) — la conversión ocurre acá, una sola vez.
 */

const NODE_WIDTH_PX = 180;
const NODE_HEIGHT_PX = 56;
/** Separación horizontal ENTRE columnas (gap, no distancia centro-a-centro) — mismo pitch visual aproximado que el placeholder anterior (220px de columna con nodos de 180px de ancho). */
const RANK_SEP_PX = 60;
/** Separación vertical entre nodos de la MISMA columna. */
const NODE_SEP_PX = 70;

/**
 * Calcula una posición `{x,y}` (esquina superior izquierda, espacio canvas)
 * para CADA nodo de `nodes`, vía `dagre.layout()`. Aristas que referencian
 * un nodo ausente en `nodes` se ignoran (mismo criterio de robustez que
 * `visibleEdges()` del componente). Grafos con ciclos NUNCA lanzan — dagre
 * los rompe internamente (`acyclicer`) solo para calcular el ranking, sin
 * mutar el grafo de entrada de este módulo.
 *
 * Determinístico: nodos/aristas se insertan en el grafo de dagre en un orden
 * ESTABLE (ids ordenados alfabéticamente), nunca el orden de inserción de
 * `nodes`/`edges` — la MISMA entrada produce SIEMPRE la misma salida.
 * Normaliza el resultado al origen (resta el mínimo x/y de todas las
 * posiciones) — nunca devuelve coordenadas negativas, mismo criterio que
 * `clampPosition` en `flow-canvas.component.ts` (ese clamp sigue existiendo
 * como red de seguridad en el punto de lectura, pero el layout ya arranca
 * normalizado).
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
  if (safeNodes.length === 0) return new Map();

  const idSet = new Set(safeNodes.map((n) => n.id));
  const sortedIds = [...idSet].sort(); // orden determinista, independiente del orden de inserción

  const graph = new graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: NODE_SEP_PX, ranksep: RANK_SEP_PX, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const id of sortedIds) {
    graph.setNode(id, { width: NODE_WIDTH_PX, height: NODE_HEIGHT_PX });
  }

  const sortedEdges = safeEdges
    .filter((edge) => idSet.has(edge.sourceId) && idSet.has(edge.targetId))
    .sort((a, b) => (a.sourceId === b.sourceId ? a.targetId.localeCompare(b.targetId) : a.sourceId.localeCompare(b.sourceId)));
  for (const edge of sortedEdges) {
    graph.setEdge(edge.sourceId, edge.targetId);
  }

  dagreLayout(graph);

  const rawPositions = new Map<string, SolFlowCanvasPosition>();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const id of sortedIds) {
    const box = graph.node(id);
    const topLeft = { x: box.x - NODE_WIDTH_PX / 2, y: box.y - NODE_HEIGHT_PX / 2 };
    rawPositions.set(id, topLeft);
    minX = Math.min(minX, topLeft.x);
    minY = Math.min(minY, topLeft.y);
  }

  const positions = new Map<string, SolFlowCanvasPosition>();
  for (const [id, position] of rawPositions) {
    positions.set(id, { x: position.x - minX, y: position.y - minY });
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

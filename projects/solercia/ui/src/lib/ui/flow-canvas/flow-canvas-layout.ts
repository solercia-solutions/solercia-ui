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
 * Encapsulado DETRÁS de esta función — ningún componente de la app
 * (`boki-front`) importa `@dagrejs/dagre` directo; solo consume
 * `SolFlowCanvasComponent.autoLayout()`, que delega en `computeAutoLayoutPositions`
 * (sin cambios en su firma pública salvo volverse `Promise` — ver W3 abajo).
 *
 * **W3 (4R Ola 5 post PR-C3, fuga de bundle)** — `@dagrejs/dagre` (~100kB)
 * pasaba por el chunk EAGER (`main-*.js`) porque `flow-canvas-layout.ts` lo
 * importaba de forma ESTÁTICA — el peso viajaba a TODA la app, incluso a
 * quien nunca visita `/dashboard/flujos`. `computeAutoLayoutPositions` ahora
 * es `async` y carga el módulo vía `import()` DINÁMICO (mismo espíritu de
 * encapsulación que `sol-chart`/`SOL_CHART_ENGINE` con `chart.js`, llevado un
 * paso más allá: acá el propio MÓDULO se carga perezoso, no solo la
 * instancia que lo consume) — el bundler lo saca a un chunk propio, lazy,
 * que solo se pide la PRIMERA vez que `autoLayout()` corre de verdad.
 * `dagreModulePromise` cachea la promesa a nivel de MÓDULO: la primera
 * llamada dispara el `import()`; las siguientes reusan la misma promesa
 * resuelta, nunca reimportan. CAMBIO DE CONTRATO DELIBERADO: `autoLayout()`
 * (`flow-canvas.component.ts`) también pasa a `Promise<void>` — ver su
 * docstring y el de `flow-canvas-acceptance.spec.ts`.
 *
 * **W2 (4R Ola 5 post PR-C3, "dagre sin red")** — un `import()` dinámico
 * puede FALLAR a mitad de sesión (chunk 404 tras un deploy nuevo, conexión
 * caída, etc.) — mismo riesgo que cualquier `loadComponent()` de ruta de
 * Angular. `computeAutoLayoutPositions` envuelve TANTO la carga del módulo
 * COMO el cálculo del layout en un único `try/catch`: si cualquiera de los
 * dos falla, cae a {@link computeLayeredFallbackPositions} — el placeholder
 * BFS-por-capas ORIGINAL de PR-C1, conservado TAL CUAL (nunca se borró, solo
 * se renombró) como red de seguridad síncrona que NUNCA depende de red. Un
 * `console.warn` (mismo criterio que `i18n.provider.ts`/`theme.service.ts`
 * de este mismo repo) deja rastro del degradado sin romper la UX — el
 * usuario sigue viendo un layout usable, solo con un algoritmo más simple.
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

/** Placeholder BFS-por-capas ORIGINAL de PR-C1 — mismo pitch visual que usaba antes de dagre. */
const FALLBACK_COLUMN_GAP_PX = 220;
const FALLBACK_ROW_GAP_PX = 120;

type DagreModule = typeof import('@dagrejs/dagre');

/** Cache a nivel de MÓDULO (W3) — la primera llamada dispara el `import()`; las siguientes reusan la misma promesa. */
let dagreModulePromise: Promise<DagreModule> | null = null;

function loadDagre(): Promise<DagreModule> {
  if (!dagreModulePromise) {
    dagreModulePromise = import('@dagrejs/dagre');
  }
  return dagreModulePromise;
}

/**
 * Calcula una posición `{x,y}` (esquina superior izquierda, espacio canvas)
 * para CADA nodo de `nodes` — dagre cuando el chunk lazy carga y el layout
 * corre sin errores; el fallback BFS síncrono si cualquiera de los dos falla
 * (W2, "dagre sin red" — ver docstring del módulo). Aristas que referencian
 * un nodo ausente en `nodes` se ignoran (mismo criterio de robustez que
 * `visibleEdges()` del componente). Grafos con ciclos (incluidos self-loops,
 * ver `flow-canvas-layout.spec.ts`) NUNCA lanzan por sí solos — dagre los
 * rompe internamente (`acyclicer`) solo para calcular el ranking, sin mutar
 * el grafo de entrada de este módulo; el `try/catch` cubre fallas AJENAS al
 * grafo (carga del chunk, errores internos inesperados de la librería).
 *
 * Determinístico bajo AMBOS caminos: nodos/aristas se insertan/procesan en
 * un orden ESTABLE (ids ordenados alfabéticamente), nunca el orden de
 * inserción de `nodes`/`edges` — la MISMA entrada produce SIEMPRE la misma
 * salida. Normaliza el resultado al origen (nunca devuelve coordenadas
 * negativas), mismo criterio que `clampPosition` en `flow-canvas.component.ts`
 * (ese clamp sigue existiendo como red de seguridad en el punto de lectura).
 *
 * Robustez de entrada (mismo criterio que el resto de `@solercia/ui`):
 * `nodes`/`edges` toleran `null`/`undefined` sin lanzar.
 */
export async function computeAutoLayoutPositions(
  nodes: readonly SolFlowCanvasNode[] | null | undefined,
  edges: readonly SolFlowCanvasEdge[] | null | undefined,
): Promise<Map<string, SolFlowCanvasPosition>> {
  const safeNodes = (nodes ?? []).filter((n): n is SolFlowCanvasNode => !!n);
  const safeEdges = (edges ?? []).filter((e): e is SolFlowCanvasEdge => !!e);
  if (safeNodes.length === 0) return new Map();

  try {
    const { graphlib, layout: dagreLayout } = await loadDagre();
    return computeDagrePositions(graphlib, dagreLayout, safeNodes, safeEdges);
  } catch (err) {
    // W2 — el chunk lazy de dagre puede fallar a mitad de sesión (chunk 404
    // tras un deploy nuevo, offline, etc.); nunca deja al usuario sin ningún
    // layout, solo degrada al fallback BFS síncrono.
    console.warn('[sol-flow-canvas] auto-layout con dagre falló — se usa el fallback BFS por capas.', err);
    return computeLayeredFallbackPositions(safeNodes, safeEdges);
  }
}

function computeDagrePositions(
  graphlib: DagreModule['graphlib'],
  dagreLayout: DagreModule['layout'],
  safeNodes: SolFlowCanvasNode[],
  safeEdges: SolFlowCanvasEdge[],
): Map<string, SolFlowCanvasPosition> {
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
 * W2 (4R Ola 5 post PR-C3) — placeholder BFS-por-capas ORIGINAL de PR-C1,
 * conservado TAL CUAL (renombrado desde `computeAutoLayoutPositions` de
 * aquel PR): capas por BFS desde las raíces (nodos sin arista entrante), sin
 * minimizar cruces ni enrutar curvas. Sirve de fallback SÍNCRONO —
 * NUNCA depende de red — cuando el chunk lazy de dagre falla a mitad de
 * sesión ("dagre sin red").
 *
 * BFS de "primer toque gana" (NUNCA recalcula la profundidad de un nodo ya
 * visitado) a propósito: un layout por camino MÁS LARGO sería más prolijo en
 * grafos en diamante, pero puede DIVERGER en un ciclo LEGAL (p. ej. un nodo
 * de recolección que vuelve sobre sí mismo tras un `interrupt()` — ver
 * `FlowValidator._validate_cycles` en boki-ai) si se recalculara la
 * profundidad cada vez que se re-alcanza un nodo. BFS clásico visita cada
 * nodo UNA sola vez → termina siempre, incluso con ciclos (incluidos
 * self-loops).
 */
export function computeLayeredFallbackPositions(
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
      if (depthOf.has(next)) continue; // primer toque gana — ver docstring de la función (evita divergir en ciclos)
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
      positions.set(id, { x: depth * FALLBACK_COLUMN_GAP_PX, y: index * FALLBACK_ROW_GAP_PX });
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

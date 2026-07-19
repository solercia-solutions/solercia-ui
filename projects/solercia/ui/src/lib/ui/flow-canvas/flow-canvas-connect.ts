import type { SolFlowCanvasEdge, SolFlowCanvasNode } from './flow-canvas.model';

/**
 * Validez de destino al "tap-para-conectar" de `sol-flow-canvas` (Ola 5
 * PR-C2B) — PURA, sin Angular/DOM (mismo criterio que `flow-canvas-layout.ts`).
 *
 * Decisión de diseño: `sol-flow-canvas` es una librería AGNÓSTICA de dominio
 * (ver docstring de `flow-canvas.model.ts` — "cero conocimiento de dominio",
 * NUNCA referencia `FlowNodeSpec`/`handler_kind`) y por FSD (`app → ... →
 * shared`) NUNCA puede importar `entities/flow/model/flow.validators.ts` de
 * la app — sería una dependencia hacia ARRIBA, prohibida. Este módulo
 * reimplementa el MISMO criterio estructural que motiva 2 reglas de
 * `flow.validators.ts` (`checkNoDuplicateTransitions` y el espíritu de
 * "ciclo ilegal" de `FlowValidator._validate_cycles` en boki-ai) como grafo
 * PURO — sin `yields_turn` (atributo de dominio que ni siquiera viaja a la
 * API, ver docstring de `flow.validators.ts`), así que la regla de ciclos de
 * acá es DELIBERADAMENTE más estricta que la del backend: excluye CUALQUIER
 * destino que hoy ya pueda alcanzar el origen (cerraría un ciclo visible en
 * el lienzo), aunque el validador real permita ciclos legítimos con
 * `interrupt()`. Es un HINT visual del canvas (resalta destinos sugeridos),
 * NO bloquea la conexión ni reemplaza al validador real — `entities/flow`
 * sigue siendo la fuente de verdad final sobre legalidad de dominio.
 */

function safeNodes(nodes: readonly SolFlowCanvasNode[] | null | undefined): SolFlowCanvasNode[] {
  return (nodes ?? []).filter((n): n is SolFlowCanvasNode => !!n);
}

function safeEdges(edges: readonly SolFlowCanvasEdge[] | null | undefined): SolFlowCanvasEdge[] {
  return (edges ?? []).filter((e): e is SolFlowCanvasEdge => !!e);
}

/**
 * Destinos válidos para conectar DESDE `sourceId`, dado el grafo actual:
 *  1. Nunca el propio `sourceId` (sin auto-loop).
 *  2. Nunca un destino con el que YA existe una arista `sourceId→destino`
 *     (evita una conexión duplicada).
 *  3. Nunca un destino desde el que HOY se puede alcanzar `sourceId` (directa
 *     o transitivamente) vía aristas existentes — conectarlo cerraría un
 *     ciclo.
 *
 * `sourceId` ausente entre los nodos actuales devuelve un set vacío
 * (defensivo — mismo criterio de robustez del resto del módulo).
 */
export function computeValidConnectionTargets(
  nodes: readonly SolFlowCanvasNode[] | null | undefined,
  edges: readonly SolFlowCanvasEdge[] | null | undefined,
  sourceId: string,
): Set<string> {
  const idSet = new Set(safeNodes(nodes).map((n) => n.id));
  if (!idSet.has(sourceId)) return new Set();

  const incoming = new Map<string, string[]>(); // target -> [sources] — para el BFS reverso de la regla 3
  const existingOutgoingPairs = new Set<string>(); // "source::target" ya conectados — para la regla 2

  for (const edge of safeEdges(edges)) {
    if (!idSet.has(edge.sourceId) || !idSet.has(edge.targetId)) continue; // arista "fantasma" — mismo criterio que visibleEdges()
    const predecessors = incoming.get(edge.targetId) ?? [];
    predecessors.push(edge.sourceId);
    incoming.set(edge.targetId, predecessors);
    existingOutgoingPairs.add(`${edge.sourceId}::${edge.targetId}`);
  }

  // BFS reverso desde sourceId siguiendo aristas ENTRANTES: todo nodo alcanzado YA puede llegar a
  // sourceId por el camino existente — conectarlo como destino cerraría un ciclo. sourceId mismo
  // arranca incluido (cubre la regla 1, el auto-loop, sin un caso especial aparte).
  const reachesSource = new Set<string>([sourceId]);
  const queue: string[] = [sourceId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const predecessor of incoming.get(current) ?? []) {
      if (reachesSource.has(predecessor)) continue; // primer toque gana — mismo criterio anti-ciclo-infinito que computeAutoLayoutPositions
      reachesSource.add(predecessor);
      queue.push(predecessor);
    }
  }

  const valid = new Set<string>();
  for (const id of idSet) {
    if (reachesSource.has(id)) continue; // regla 1 (sourceId) + regla 3 (cerraría un ciclo)
    if (existingOutgoingPairs.has(`${sourceId}::${id}`)) continue; // regla 2 (ya conectados — duplicado)
    valid.add(id);
  }
  return valid;
}

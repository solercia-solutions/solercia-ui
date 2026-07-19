/**
 * Contrato AGNÓSTICO del motor de `sol-flow-canvas` (Ola 5 —
 * `openspec/GOAL-ola5-flow-canvas-y-cutover.md` §4, PR-C1). Esta API es
 * ESTABLE: PR-C2A (motor `@foblex/flow`) y PR-C2B (motor nativo SVG+CDK)
 * REEMPLAZAN solo el interior de `SolFlowCanvasComponent`, nunca estos
 * tipos ni los inputs/outputs/métodos públicos que los usan.
 *
 * Cero conocimiento de dominio (mismo criterio que `KanbanItem`/
 * `TimelineNode`/`SolCalendarEvent`): NUNCA referencia `FlowNodeSpec`,
 * `handler_kind` ni ningún concepto de flujos conversacionales — el mapeo
 * `FlowDetail → SolFlowCanvasNode[]/SolFlowCanvasEdge[]` vive en
 * `entities/flow` de la app (boki-front), NO en esta librería.
 */

/** Coordenadas absolutas dentro del lienzo (px, sistema propio del canvas). */
export interface SolFlowCanvasPosition {
  x: number;
  y: number;
}

/**
 * Estado visual de un nodo — hooks para el trace de ejecución futuro (GOAL
 * §4 PR-C1: "estado visual por nodo — hooks para el trace futuro"). La lib
 * NUNCA decide CUÁNDO cambia; solo lo pinta.
 */
export type SolFlowCanvasNodeVisualState = 'idle' | 'running' | 'ok' | 'error';

/** Insignia mínima tipada sobre un nodo — texto libre, sin significado de dominio para la lib. */
export interface SolFlowCanvasNodeBadge {
  id: string;
  label: string;
}

/** Nodo del lienzo — agnóstico: `kind` es una etiqueta libre que el consumidor interpreta (p. ej. vía `nodeTemplate`). */
export interface SolFlowCanvasNode {
  id: string;
  label: string;
  kind: string;
  position: SolFlowCanvasPosition;
  visualState?: SolFlowCanvasNodeVisualState;
  badges?: SolFlowCanvasNodeBadge[];
  /** Metadata libre del consumidor — la lib nunca la lee ni la interpreta, solo la reenvía en el contexto del template proyectado. */
  metadata?: Record<string, unknown>;
}

/** Tipo de condición de una conexión — agnóstico igual que `kind` del nodo (el consumidor decide el significado exacto). */
export type SolFlowCanvasEdgeKind = 'condition' | 'intent' | 'always';

/** Conexión entre dos nodos del lienzo. */
export interface SolFlowCanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  kind: SolFlowCanvasEdgeKind;
  priority?: number;
}

/** Payload de `nodeMoved` — se emite al soltar un arrastre (mouse) o al confirmar un ajuste por teclado (paridad a11y). */
export interface SolFlowCanvasNodeMovedEvent {
  id: string;
  position: SolFlowCanvasPosition;
}

/** Payload de `nodeSelected` — click o activación por teclado (Enter/Espacio sobre el nodo enfocado). */
export interface SolFlowCanvasNodeSelectedEvent {
  id: string;
}

/** Payload de `connectionCreated` — mecánica de la API (arma origen → activa destino); el GESTO concreto lo decide cada motor. */
export interface SolFlowCanvasConnectionCreatedEvent {
  sourceId: string;
  targetId: string;
}

/** Payload de `connectionRemoved`. */
export interface SolFlowCanvasConnectionRemovedEvent {
  id: string;
}

/** Contexto del `ng-template` de nodo proyectado: `let-node` (`$implicit`) o `let-node="node"` — mismo patrón que `KanbanCardTemplateContext`/`SolCalendarEventTemplateContext`. */
export interface SolFlowCanvasNodeTemplateContext {
  /** Alias posicional (`let-x`) — el mismo nodo que {@link node}. */
  $implicit: SolFlowCanvasNode;
  /** Alias nombrado (`let-x="node"`) — el mismo nodo que {@link $implicit}. */
  node: SolFlowCanvasNode;
  /** Espejo de `selectedId() === node.id` (input del componente) — evita que el template proyectado compare el id a mano. */
  selected: boolean;
  /** Espejo de `highlightedNodeId() === node.id` (input del componente) — mismo motivo que {@link selected}. */
  highlighted: boolean;
}

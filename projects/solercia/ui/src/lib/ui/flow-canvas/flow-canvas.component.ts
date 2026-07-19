import {
  Component,
  ChangeDetectionStrategy,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { computeAutoLayoutPositions, countEdgeIds, countNodeIds, safeTrackKey } from './flow-canvas-layout';
import type {
  SolFlowCanvasConnectionCreatedEvent,
  SolFlowCanvasConnectionRemovedEvent,
  SolFlowCanvasEdge,
  SolFlowCanvasNode,
  SolFlowCanvasNodeMovedEvent,
  SolFlowCanvasNodeSelectedEvent,
  SolFlowCanvasNodeTemplateContext,
  SolFlowCanvasPosition,
} from './flow-canvas.model';

/** Tamaño supuesto de un nodo para calcular el punto medio de las aristas (el shell no mide el DOM real — motor mínimo, ver docstring de la clase). */
const NODE_WIDTH_PX = 180;
const NODE_HEIGHT_PX = 56;

/** Un gesto de pointerdown→pointerup con menos desplazamiento que esto se trata como click, no como arrastre. */
const DRAG_THRESHOLD_PX = 4;

/** Paso de cada nudge por teclado (paridad a11y del arrastre). */
const KEYBOARD_NUDGE_STEP_PX = 10;

const ARROW_KEY_DELTA: Record<string, SolFlowCanvasPosition> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

let uniqueMarkerCounter = 0;

interface DragState {
  nodeId: string;
  /** Puntero DUEÑO de este drag (C1, 4R Ola 5) — un segundo puntero concurrente jamás debe leer/mutar este estado. */
  pointerId: number;
  startPointer: SolFlowCanvasPosition;
  startPosition: SolFlowCanvasPosition;
  currentPosition: SolFlowCanvasPosition;
}

/** El origen (0,0) del lienzo es un límite real — un contenedor `overflow: auto` no tiene scroll negativo, así que ningún nodo debe commitear ni mostrarse en coordenadas negativas (W4, 4R Ola 5). */
function clampPosition(position: SolFlowCanvasPosition): SolFlowCanvasPosition {
  return { x: Math.max(0, position.x), y: Math.max(0, position.y) };
}

/**
 * `sol-flow-canvas` — contrato AGNÓSTICO del motor de un lienzo tipo n8n
 * (Ola 5, `openspec/GOAL-ola5-flow-canvas-y-cutover.md` §4, PR-C1).
 *
 * API PÚBLICA ESTABLE (inputs/outputs/`autoLayout()`/proyección de
 * template): PR-C2A (`@foblex/flow`) y PR-C2B (nativo SVG+CDK) REEMPLAZAN
 * SOLO el interior de esta clase — la API de acá NUNCA cambia entre ambos
 * bake-offs. La implementación de ESTE PR es un shell MÍNIMO adrede: render
 * estático posicionado absoluto + SVG de líneas rectas, sin pan/zoom, sin
 * bezier, sin minimapa — la {@link autoLayout} real (dagre/ELK) y el motor
 * de render sofisticado llegan en PR-C2A, PR-C2B y PR-C3 (GOAL §4).
 *
 * Interacciones del shell (documentadas porque C2A/C2B pueden legítimamente
 * cambiar el GESTO concreto sin romper el contrato — la suite de aceptación
 * compartida prueba la API, no el gesto):
 *  - **Selección**: cada nodo es un `<button>` real — click nativo, y
 *    Enter/Espacio manejados de forma EXPLÍCITA en `onNodeKeydown` (W6, 4R
 *    Ola 5: NO se delega en la activación nativa del navegador sobre el
 *    botón — el contrato debe exigir Enter/Espacio incluso si un motor
 *    C2A/C2B no usa `<button>` nativo). Ambos caminos emiten `nodeSelected`
 *    de la MISMA forma.
 *  - **Mover un nodo (mouse)**: `pointerdown`→`pointermove`→`pointerup`
 *    sobre el nodo. Si el desplazamiento total supera {@link DRAG_THRESHOLD_PX}
 *    emite `nodeMoved`; si NO (un click esencialmente estático), el
 *    `pointerup` no hace nada y el `click` nativo que sigue resuelve
 *    selección/conexión — evita un `nodeMoved` espurio en cada click. Tras
 *    un arrastre REAL, el click sintético que el navegador dispara después
 *    se descarta explícitamente (`lastGestureWasDrag`) para no
 *    además-seleccionar el nodo que se acaba de soltar.
 *  - **Mover un nodo (teclado)**: flechas sobre el nodo enfocado — nudge de
 *    {@link KEYBOARD_NUDGE_STEP_PX}px y emite `nodeMoved`. Paridad a11y
 *    real del arrastre (el CDK no la trae gratis — mismo criterio que
 *    `sol-kanban-board`, que resuelve la paridad con un `<select>` en vez de
 *    reimplementar el drag de CDK por teclado).
 *  - **Crear conexión**: cada nodo tiene un botón "conectar desde" — al
 *    activarlo arma el origen; activar OTRO nodo completa la conexión
 *    (`connectionCreated`). Activar el MISMO nodo, o `Escape`, cancela el
 *    modo. Deliberado: "mecánica de la API, no del gesto" (GOAL §4) — el
 *    gesto real de C2A/C2B (arrastrar una línea vs. tap-tap) puede diferir
 *    por completo sin tocar el contrato de eventos.
 *  - **Quitar conexión**: botón "×" sobre la etiqueta de cada arista.
 *  - **`readonly`**: oculta/deshabilita TODA mutación (arrastre, nudge,
 *    conectar, quitar) — la selección sigue activa (no es una mutación del
 *    grafo).
 *
 * Espejo interno (`mirroredNodes`, mismo patrón que `sol-kanban-board`):
 * mantiene una copia propia de `nodes()`, re-sembrada en cada cambio del
 * input, mutada LOCALMENTE en cada interacción (feedback visual inmediato)
 * y SIEMPRE acompañada del output correspondiente para que el consumidor
 * persista. A diferencia de `sol-kanban-board`, este shell NO necesita
 * posponer el re-seed durante un gesto activo: el arrastre no usa CDK ni
 * `@for`-reconciliation de listas — el nodo arrastrado nunca se
 * destruye/recrea a mitad de gesto, así que no hay condición de carrera que
 * blindar.
 */
@Component({
  selector: 'sol-flow-canvas',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="sol-flow-canvas"
      role="application"
      [attr.aria-label]="regionLabel()"
      (keydown.escape)="cancelConnect()"
    >
      <svg class="sol-flow-canvas__edges" aria-hidden="true">
        <defs>
          <marker
            [attr.id]="markerId"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 Z" class="sol-flow-canvas__edge-arrow" />
          </marker>
        </defs>
        @for (edge of visibleEdges(); track trackEdge(edge, $index)) {
          <line
            class="sol-flow-canvas__edge-line"
            [attr.x1]="edgeLine(edge).x1"
            [attr.y1]="edgeLine(edge).y1"
            [attr.x2]="edgeLine(edge).x2"
            [attr.y2]="edgeLine(edge).y2"
            [attr.marker-end]="'url(#' + markerId + ')'"
          />
        }
      </svg>

      @for (edge of visibleEdges(); track trackEdge(edge, $index)) {
        <div class="sol-flow-canvas__edge-label" [style.left.px]="edgeMidpoint(edge).x" [style.top.px]="edgeMidpoint(edge).y">
          <span class="sol-flow-canvas__edge-label-text">{{ edge.label ?? edge.kind }}</span>
          @if (!isReadonly()) {
            <button
              type="button"
              class="sol-flow-canvas__edge-remove"
              [attr.aria-label]="removeConnectionLabel()"
              (click)="onRemoveConnection(edge)"
            >
              ×
            </button>
          }
        </div>
      }

      @for (node of mirroredNodes(); track trackNode(node, $index)) {
        <div
          class="sol-flow-canvas__node"
          [class.sol-flow-canvas__node--selected]="isSelected(node)"
          [class.sol-flow-canvas__node--highlighted]="isHighlighted(node)"
          [class.sol-flow-canvas__node--connect-source]="connectSourceId() === node.id"
          [attr.data-visual-state]="node.visualState ?? 'idle'"
          [attr.data-testid]="'flow-canvas-node-' + node.id"
          [style.left.px]="resolvedPosition(node).x"
          [style.top.px]="resolvedPosition(node).y"
        >
          <button
            type="button"
            class="sol-flow-canvas__node-surface"
            [attr.aria-pressed]="isSelected(node)"
            [attr.aria-label]="nodeAriaLabel(node)"
            (pointerdown)="onNodePointerDown(node, $event)"
            (pointermove)="onNodePointerMove(node, $event)"
            (pointerup)="onNodePointerUp(node, $event)"
            (pointercancel)="onNodePointerCancel(node, $event)"
            (lostpointercapture)="onNodePointerCancel(node, $event)"
            (click)="onNodeActivate(node)"
            (keydown)="onNodeKeydown(node, $event)"
          >
            @if (nodeTemplate(); as tpl) {
              <ng-container *ngTemplateOutlet="tpl; context: nodeTemplateContext(node)" />
            } @else {
              <span class="sol-flow-canvas__node-label">{{ node.label }}</span>
            }
          </button>

          @if (!isReadonly()) {
            <button
              type="button"
              class="sol-flow-canvas__node-connect-handle"
              [attr.aria-label]="connectFromLabel(node)"
              (click)="onStartConnect(node, $event)"
            >
              ⇢
            </button>
          }
        </div>
      }

      <div class="sol-flow-canvas__announce" aria-live="polite" role="status">{{ announcement() }}</div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
    }

    .sol-flow-canvas {
      position: relative;
      width: 100%;
      min-height: 320px;
      overflow: auto;
      background: var(--sol-bg-sunken, var(--sol-bg-page, #f8fafc));
      border-radius: var(--sol-border-radius-lg, 12px);
    }

    .sol-flow-canvas__edges {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    }

    .sol-flow-canvas__edge-line {
      stroke: var(--sol-border-color-default, #94a3b8);
      stroke-width: 2;
      fill: none;
    }

    .sol-flow-canvas__edge-arrow {
      fill: var(--sol-border-color-default, #94a3b8);
    }

    .sol-flow-canvas__edge-label {
      position: absolute;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--sol-bg-surface, #fff);
      border: 1px solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-full, 999px);
      padding: 2px 8px;
      font-size: var(--sol-font-size-xs, 11px);
      color: var(--sol-color-text-secondary, #475569);
      z-index: 2;
    }

    .sol-flow-canvas__edge-remove {
      border: none;
      background: transparent;
      color: var(--sol-color-danger, #ef4444);
      cursor: pointer;
      font-size: var(--sol-font-size-sm, 13px);
      line-height: 1;
      padding: 0 2px;
    }

    .sol-flow-canvas__node {
      position: absolute;
      width: 180px;
      display: flex;
      align-items: stretch;
      gap: 4px;
      z-index: 3;
      touch-action: none;
    }

    .sol-flow-canvas__node-surface {
      flex: 1;
      text-align: left;
      padding: 10px 12px;
      background: var(--sol-bg-surface, #fff);
      border: 2px solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-lg, 10px);
      box-shadow: var(--sol-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.06));
      cursor: grab;
      font-family: var(--sol-font-family);
      color: var(--sol-color-text-primary);
    }

    .sol-flow-canvas__node-surface:focus-visible {
      outline: 2px solid var(--sol-color-primary, #2563eb);
      outline-offset: 2px;
    }

    .sol-flow-canvas__node--selected .sol-flow-canvas__node-surface {
      border-color: var(--sol-color-primary, #2563eb);
    }

    .sol-flow-canvas__node--highlighted .sol-flow-canvas__node-surface {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #2563eb) 30%, transparent);
    }

    .sol-flow-canvas__node--connect-source .sol-flow-canvas__node-surface {
      border-style: dashed;
      border-color: var(--sol-color-info, #3b82f6);
    }

    .sol-flow-canvas__node[data-visual-state='running'] .sol-flow-canvas__node-surface {
      border-color: var(--sol-color-info, #3b82f6);
    }

    .sol-flow-canvas__node[data-visual-state='ok'] .sol-flow-canvas__node-surface {
      border-color: var(--sol-color-success, #10b981);
    }

    .sol-flow-canvas__node[data-visual-state='error'] .sol-flow-canvas__node-surface {
      border-color: var(--sol-color-danger, #ef4444);
    }

    .sol-flow-canvas__node-label {
      font-size: var(--sol-font-size-sm, 13px);
      font-weight: 600;
    }

    .sol-flow-canvas__node-connect-handle {
      flex: none;
      width: 28px;
      border: 1px solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-md, 8px);
      background: var(--sol-bg-surface, #fff);
      color: var(--sol-color-text-secondary, #475569);
      cursor: pointer;
    }

    .sol-flow-canvas__announce {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class SolFlowCanvasComponent {
  private readonly i18n = inject(SOL_I18N);

  /** Tolera `null`/`undefined` (lección PR3/PR4 del resto de la lib): un input no garantiza un valor no-nulo en runtime. */
  readonly nodes = input<SolFlowCanvasNode[] | null | undefined>([]);
  readonly edges = input<SolFlowCanvasEdge[] | null | undefined>([]);

  /**
   * Alias `readonly` (nombre público exacto que pide el contrato) — la
   * propiedad TS se llama `isReadonly` a propósito: `readonly` es palabra
   * reservada como MODIFICADOR de miembro de clase; nombrar el campo TS
   * igual (`readonly readonly = input(...)`) es sintácticamente ambiguo y
   * mejor evitado. `alias` de `input()` desacopla el nombre del binding
   * público del nombre de la propiedad interna, sin cambiar la API.
   */
  readonly isReadonly = input<boolean>(false, { alias: 'readonly' });

  readonly selectedId = input<string | null>(null);
  readonly highlightedNodeId = input<string | null>(null);

  /** Sin este, cada nodo cae a mostrar solo `label` (mismo patrón que `eventTemplate` de `sol-calendar-grid`). */
  readonly nodeTemplate = input<TemplateRef<SolFlowCanvasNodeTemplateContext> | null>(null);

  readonly nodeMoved = output<SolFlowCanvasNodeMovedEvent>();
  readonly nodeSelected = output<SolFlowCanvasNodeSelectedEvent>();
  readonly connectionCreated = output<SolFlowCanvasConnectionCreatedEvent>();
  readonly connectionRemoved = output<SolFlowCanvasConnectionRemovedEvent>();

  protected readonly mirroredNodes = signal<SolFlowCanvasNode[]>([]);
  protected readonly connectSourceId = signal<string | null>(null);
  protected readonly announcement = signal('');
  protected readonly markerId = `sol-flow-canvas-arrow-${uniqueMarkerCounter++}`;

  private dragState: DragState | null = null;
  private lastGestureWasDrag = false;

  private readonly nodesById = computed(() => new Map(this.mirroredNodes().map((node) => [node.id, node])));

  protected readonly visibleEdges = computed(() => {
    const byId = this.nodesById();
    return (this.edges() ?? []).filter(
      (edge): edge is SolFlowCanvasEdge => !!edge && byId.has(edge.sourceId) && byId.has(edge.targetId),
    );
  });

  private readonly nodeIdFrequency = computed(() => countNodeIds(this.mirroredNodes()));
  private readonly edgeIdFrequency = computed(() => countEdgeIds(this.visibleEdges()));

  constructor() {
    effect(() => {
      const incoming = (this.nodes() ?? []).filter((node): node is SolFlowCanvasNode => !!node);
      this.mirroredNodes.set(incoming);
    });

    // W1+W2 (4R Ola 5): un flip de `readonly` a mitad de gesto cancela CUALQUIER mutación en curso —
    // revierte el drag SIN emitir (la posición visual vuelve a resolvedPosition()/nodes()) y desarma
    // "conectar". Los guards puntuales en onNodePointerMove/onNodePointerUp/onNodeActivate cubren la
    // ventana síncrona entre el flip y que este effect corra.
    effect(() => {
      if (!this.isReadonly()) return;
      this.dragState = null;
      this.connectSourceId.set(null);
    });
  }

  trackNode(node: SolFlowCanvasNode, index: number): unknown {
    return safeTrackKey(node?.id, index, this.nodeIdFrequency());
  }

  /** Fallback anti-NG0955 para edges — mismo patrón que {@link trackNode} (C2, 4R Ola 5): un `id` de edge duplicado ya no rompe el `track` del `@for`. */
  trackEdge(edge: SolFlowCanvasEdge, index: number): unknown {
    return safeTrackKey(edge?.id, index, this.edgeIdFrequency());
  }

  protected isSelected(node: SolFlowCanvasNode): boolean {
    return this.selectedId() === node.id;
  }

  protected isHighlighted(node: SolFlowCanvasNode): boolean {
    return this.highlightedNodeId() === node.id;
  }

  private hasValidPosition(node: SolFlowCanvasNode): boolean {
    const position = node?.position;
    return !!position && Number.isFinite(position.x) && Number.isFinite(position.y);
  }

  protected resolvedPosition(node: SolFlowCanvasNode): SolFlowCanvasPosition {
    // W4 (4R Ola 5): clamp en el PUNTO DE LECTURA — mantiene `dragState.currentPosition` sin transformar
    // (la distancia de arrastre en onNodePointerUp sigue comparando contra el delta real, sin distorsión).
    if (this.dragState && this.dragState.nodeId === node.id) return clampPosition(this.dragState.currentPosition);
    if (this.hasValidPosition(node)) return node.position;
    return { x: 0, y: 0 };
  }

  private nodeCenter(node: SolFlowCanvasNode): SolFlowCanvasPosition {
    const position = this.resolvedPosition(node);
    return { x: position.x + NODE_WIDTH_PX / 2, y: position.y + NODE_HEIGHT_PX / 2 };
  }

  protected edgeLine(edge: SolFlowCanvasEdge): { x1: number; y1: number; x2: number; y2: number } {
    const byId = this.nodesById();
    const source = byId.get(edge.sourceId);
    const target = byId.get(edge.targetId);
    if (!source || !target) return { x1: 0, y1: 0, x2: 0, y2: 0 };
    const from = this.nodeCenter(source);
    const to = this.nodeCenter(target);
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
  }

  protected edgeMidpoint(edge: SolFlowCanvasEdge): SolFlowCanvasPosition {
    const line = this.edgeLine(edge);
    return { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 };
  }

  protected nodeTemplateContext(node: SolFlowCanvasNode): SolFlowCanvasNodeTemplateContext {
    return { $implicit: node, node, selected: this.isSelected(node), highlighted: this.isHighlighted(node) };
  }

  // --- i18n (claves reales en boki-front/src/assets/i18n/es-CO.json bajo shared.flowCanvas.*) ---

  protected regionLabel(): string {
    this.i18n.activeLang();
    return this.i18n.translate('shared.flowCanvas.regionLabel');
  }

  protected nodeAriaLabel(node: SolFlowCanvasNode): string {
    this.i18n.activeLang();
    return this.i18n.translate('shared.flowCanvas.nodeAriaLabel', { label: node.label });
  }

  protected connectFromLabel(node: SolFlowCanvasNode): string {
    this.i18n.activeLang();
    return this.i18n.translate('shared.flowCanvas.connectFromLabel', { label: node.label });
  }

  protected removeConnectionLabel(): string {
    this.i18n.activeLang();
    return this.i18n.translate('shared.flowCanvas.removeConnectionLabel');
  }

  // --- selección / conectar ---

  protected onNodeActivate(node: SolFlowCanvasNode): void {
    if (this.lastGestureWasDrag) {
      // El click sintético que sigue a un arrastre REAL no debe además seleccionar/conectar.
      this.lastGestureWasDrag = false;
      return;
    }

    const source = this.connectSourceId();
    if (source !== null) {
      this.connectSourceId.set(null);
      // W1+W2 (4R Ola 5): guard extra de isReadonly() — el effect del constructor ya desarma
      // connectSourceId al flipear a readonly, este guard cubre la ventana síncrona previa a que corra.
      if (source !== node.id && !this.isReadonly()) {
        this.connectionCreated.emit({ sourceId: source, targetId: node.id });
        this.announce('shared.flowCanvas.connectionCreatedAnnouncement', { source, target: node.id });
        return;
      }
      // Activar el MISMO nodo que armó "conectar" (o un flip a readonly a mitad de gesto) cancela el modo y cae a selección normal.
    }

    this.nodeSelected.emit({ id: node.id });
  }

  protected onStartConnect(node: SolFlowCanvasNode, event: Event): void {
    event.stopPropagation();
    if (this.isReadonly()) return;
    this.connectSourceId.set(node.id);
    this.announce('shared.flowCanvas.connectArmedAnnouncement', { label: node.label });
  }

  protected cancelConnect(): void {
    this.connectSourceId.set(null);
  }

  protected onRemoveConnection(edge: SolFlowCanvasEdge): void {
    if (this.isReadonly()) return;
    this.connectionRemoved.emit({ id: edge.id });
    this.announce('shared.flowCanvas.connectionRemovedAnnouncement');
  }

  // --- arrastre por mouse (pointer events nativos — CDK está reservado a ui/kanban/) ---

  protected onNodePointerDown(node: SolFlowCanvasNode, event: PointerEvent): void {
    if (this.isReadonly()) return;
    // C1 (4R Ola 5): un drag YA activo (de OTRO puntero, sobre el mismo nodo o uno distinto) ignora por
    // completo un segundo pointerdown — el primer puntero en arrancar gana, nunca se corrompe/reasigna.
    if (this.dragState) return;
    const target = event.currentTarget as HTMLElement;
    target.focus();
    target.setPointerCapture?.(event.pointerId);
    const start = this.resolvedPosition(node);
    this.dragState = {
      nodeId: node.id,
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition: start,
      currentPosition: start,
    };
  }

  protected onNodePointerMove(node: SolFlowCanvasNode, event: PointerEvent): void {
    const state = this.dragState;
    // C1: solo el puntero DUEÑO del drag, sobre SU nodo, puede mutar dragState — un puntero/nodo ajeno no hace nada.
    if (!state || state.pointerId !== event.pointerId || state.nodeId !== node.id) return;
    if (this.isReadonly()) return; // W1+W2: ventana síncrona previa a que el effect del constructor revierta

    const dx = event.clientX - state.startPointer.x;
    const dy = event.clientY - state.startPointer.y;
    this.dragState = {
      ...state,
      currentPosition: { x: state.startPosition.x + dx, y: state.startPosition.y + dy },
    };
  }

  protected onNodePointerUp(node: SolFlowCanvasNode, event: PointerEvent): void {
    const state = this.dragState;
    // C1: el up de un puntero/nodo AJENO nunca toca el drag activo (ni lo limpia ni lo commitea).
    if (!state || state.pointerId !== event.pointerId || state.nodeId !== node.id) return;
    this.dragState = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (this.isReadonly()) return; // W1+W2: ventana síncrona previa a que el effect del constructor revierta — no commitea

    const distance = Math.hypot(
      state.currentPosition.x - state.startPosition.x,
      state.currentPosition.y - state.startPosition.y,
    );
    if (distance < DRAG_THRESHOLD_PX) return; // sin desplazamiento real: el click nativo que sigue resuelve selección/conexión

    this.lastGestureWasDrag = true;
    this.commitNodePosition(node, state.currentPosition); // commitNodePosition clampea a coordenadas no negativas (W4)
  }

  /**
   * `pointercancel`/`lostpointercapture` (W3+W5, 4R Ola 5) — SIEMPRE revierte, NUNCA commitea: el
   * navegador interrumpió o reasignó el gesto (p. ej. un `pointercancel` real, o el UA reasignando la
   * captura del puntero) y la única respuesta segura es abandonar el drag tal cual estaba ANTES de
   * arrancar. La posición visual vuelve sola a la fuente (`resolvedPosition()` cae a `nodes()` en
   * cuanto `dragState` es `null`) — no hace falta restaurar nada a mano.
   */
  protected onNodePointerCancel(node: SolFlowCanvasNode, event: PointerEvent): void {
    const state = this.dragState;
    if (!state || state.pointerId !== event.pointerId || state.nodeId !== node.id) return; // C1: puntero/nodo ajeno, no toca el drag activo
    this.dragState = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  // --- nudge por teclado (paridad a11y) ---

  protected onNodeKeydown(node: SolFlowCanvasNode, event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      // W6 (4R Ola 5): activación EXPLÍCITA por teclado — NO se delega en el `click` sintético que el
      // navegador dispara para un `<button>` enfocado (un motor C2A/C2B podría no usar `<button>`
      // nativo, y el contrato debe exigir Enter/Espacio de forma explícita). `preventDefault()` evita
      // que el navegador dispare ADEMÁS su propio `click` nativo (doble activación).
      event.preventDefault();
      this.onNodeActivate(node);
      return;
    }
    if (this.isReadonly()) return;
    const delta = ARROW_KEY_DELTA[event.key];
    if (!delta) return;
    event.preventDefault();
    const current = this.resolvedPosition(node);
    this.commitNodePosition(node, {
      x: current.x + delta.x * KEYBOARD_NUDGE_STEP_PX,
      y: current.y + delta.y * KEYBOARD_NUDGE_STEP_PX,
    });
  }

  private commitNodePosition(node: SolFlowCanvasNode, position: SolFlowCanvasPosition): void {
    const clamped = clampPosition(position); // W4: ningún commit (arrastre o nudge) puede dejar coordenadas negativas
    this.mirroredNodes.update((nodes) => nodes.map((n) => (n.id === node.id ? { ...n, position: clamped } : n)));
    this.nodeMoved.emit({ id: node.id, position: clamped });
    this.announce('shared.flowCanvas.movedAnnouncement', { label: node.label });
  }

  private announce(key: string, params?: Record<string, unknown>): void {
    this.i18n.activeLang();
    this.announcement.set(this.i18n.translate(key, params));
  }

  /**
   * Calcula y aplica una posición a TODO nodo actual sin `position` válido
   * (ver {@link hasValidPosition}) usando {@link computeAutoLayoutPositions}
   * (placeholder simple — dagre/ELK real llega en PR-C3). Los nodos YA
   * posicionados NO se tocan. Emite `nodeMoved` por cada nodo repositionado
   * — el consumidor decide si persiste esa posición.
   *
   * No-op si `isReadonly()` es `true` (S1, 4R Ola 5) — mismo criterio que el
   * resto de mutaciones del lienzo (arrastre, nudge, conectar, quitar): TODA
   * mutación queda bloqueada en modo lectura, sin excepción para este método.
   */
  autoLayout(): void {
    if (this.isReadonly()) return;
    const current = this.mirroredNodes();
    const pending = current.filter((node) => !this.hasValidPosition(node));
    if (pending.length === 0) return;

    const computed = computeAutoLayoutPositions(current, this.edges() ?? []);
    const updates: SolFlowCanvasNodeMovedEvent[] = [];
    this.mirroredNodes.update((nodes) =>
      nodes.map((node) => {
        if (this.hasValidPosition(node)) return node;
        const position = computed.get(node.id);
        if (!position) return node;
        updates.push({ id: node.id, position });
        return { ...node, position };
      }),
    );
    for (const update of updates) this.nodeMoved.emit(update);
  }
}

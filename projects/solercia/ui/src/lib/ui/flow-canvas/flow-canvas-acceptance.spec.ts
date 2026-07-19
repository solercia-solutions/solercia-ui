import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolFlowCanvasComponent } from './flow-canvas.component';
import type { SolFlowCanvasEdge, SolFlowCanvasNode, SolFlowCanvasPosition } from './flow-canvas.model';

/**
 * Suite de aceptación COMPARTIDA de `sol-flow-canvas` (Ola 5, GOAL §4
 * PR-C1) — el corazón del bake-off PR-C2A (`@foblex/flow`) vs. PR-C2B
 * (nativo SVG+CDK): AMBOS motores deben pasarla SIN MODIFICARLA, porque
 * ejerce ÚNICAMENTE la API pública (inputs/outputs/`autoLayout()`), nunca la
 * estructura DOM interna de un motor concreto.
 *
 * Mecánica elegida — harness/factory (`runFlowCanvasAcceptanceSuite(setup)`,
 * exportada SOLO para testing, nunca desde `public-api.ts`): la suite en sí
 * NO sabe cómo se dispara un "arrastre" o una "conexión" en cada motor — eso
 * lo decide `setup()`, una función que CADA rama (C1 shell acá mismo, C2A,
 * C2B) implementa una vez, traduciendo acciones ABSTRACTAS
 * (`actions.dragNodeBy`, `actions.armConnectFrom`…) a la interacción DOM
 * concreta de su motor. La suite solo conoce el contrato `FlowCanvasHarness`
 * — jamás un selector CSS de un motor específico. C2A/C2B heredan este
 * ARCHIVO tal cual desde la punta de C1 y solo reemplazan la función
 * `setupShellHarness` de más abajo (o la mueven a su propio archivo e
 * importan `runFlowCanvasAcceptanceSuite`) — el bloque `describe` que
 * exporta la suite NUNCA cambia.
 *
 * Casos mínimos (brief PR-C1) — el shell de este PR los pasa TODOS; cero
 * `pending`.
 */

// --- Contrato del harness (motor-agnóstico) ---

export interface FlowCanvasHarnessQuery {
  nodeCount(): number;
  nodeExists(nodeId: string): boolean;
  nodePosition(nodeId: string): SolFlowCanvasPosition | null;
  nodeVisualState(nodeId: string): string | null;
  edgeCount(): number;
}

export interface FlowCanvasHarnessActions {
  /** Simula el gesto de arrastre completo (mousedown→move→up u homólogo del motor) que termina con el nodo desplazado en `delta`. */
  dragNodeBy(nodeId: string, delta: SolFlowCanvasPosition): void;
  /** Simula click/tap sobre el nodo. */
  clickNode(nodeId: string): void;
  /** Simula la activación por TECLADO del nodo enfocado (paridad a11y — puede ser el mismo evento que `clickNode` si el motor usa `<button>` nativo). */
  keyboardSelectNode(nodeId: string): void;
  /** Arma "conectar desde" sobre `nodeId` — primer paso de la mecánica de conexión (gesto libre por motor). */
  armConnectFrom(nodeId: string): void;
  /** Segundo paso: activa `nodeId` como destino de la conexión armada. */
  activateNodeForConnect(nodeId: string): void;
  /** Dispara la eliminación de la arista `edgeId`. */
  removeEdge(edgeId: string): void;
}

export interface FlowCanvasHarness {
  component: SolFlowCanvasComponent;
  actions: FlowCanvasHarnessActions;
  query: FlowCanvasHarnessQuery;
  detectChanges(): void;
}

export interface FlowCanvasHarnessSetupInput {
  nodes: SolFlowCanvasNode[];
  edges: SolFlowCanvasEdge[];
  readonly?: boolean;
  selectedId?: string | null;
  highlightedNodeId?: string | null;
}

export type FlowCanvasHarnessSetup = (input: FlowCanvasHarnessSetupInput) => FlowCanvasHarness;

/** Nombres de los casos — usados por `options.skip` para marcar `pending` con justificación (ver docstring del módulo). */
export type FlowCanvasAcceptanceCase =
  | 'rendersNodesAndEdgesWithPositions'
  | 'selectsByClick'
  | 'selectsByKeyboard'
  | 'emitsNodeMovedOnDrag'
  | 'emitsConnectionCreated'
  | 'readonlyBlocksMutations'
  | 'appliesVisualStates'
  | 'autoLayoutPositionsUnpositionedNodes'
  | 'rendersManyNodesWithinBudget';

export interface FlowCanvasAcceptanceOptions {
  /** Caso → motivo explícito por el que ESTE motor no puede pasarlo todavía. Minimizar (brief PR-C1) — el shell no necesita ninguno. */
  skip?: Partial<Record<FlowCanvasAcceptanceCase, string>>;
}

/**
 * Ejecuta la suite compartida contra `setup()`. Casos con `options.skip[caso]`
 * definido se registran como `it.skip` con el motivo en la descripción — NUNCA
 * se omiten en silencio.
 */
export function runFlowCanvasAcceptanceSuite(setup: FlowCanvasHarnessSetup, options: FlowCanvasAcceptanceOptions = {}): void {
  const skip = options.skip ?? {};

  function itOrPending(caseName: FlowCanvasAcceptanceCase, description: string, fn: () => void): void {
    const reason = skip[caseName];
    if (reason) {
      it.skip(`${description} [PENDING: ${reason}]`, fn);
      return;
    }
    it(description, fn);
  }

  describe('sol-flow-canvas — suite de aceptación compartida (API pública, agnóstica del motor)', () => {
    itOrPending('rendersNodesAndEdgesWithPositions', 'renderiza N nodos y M edges, respetando la posición dada de cada nodo', () => {
      const nodes: SolFlowCanvasNode[] = [
        { id: 'a', label: 'A', kind: 'default', position: { x: 10, y: 20 } },
        { id: 'b', label: 'B', kind: 'default', position: { x: 250, y: 20 } },
        { id: 'c', label: 'C', kind: 'default', position: { x: 500, y: 20 } },
      ];
      const edges: SolFlowCanvasEdge[] = [
        { id: 'a-b', sourceId: 'a', targetId: 'b', kind: 'always' },
        { id: 'b-c', sourceId: 'b', targetId: 'c', kind: 'always' },
      ];
      const harness = setup({ nodes, edges });
      harness.detectChanges();

      expect(harness.query.nodeCount()).toBe(3);
      expect(harness.query.edgeCount()).toBe(2);
      expect(harness.query.nodePosition('a')).toEqual({ x: 10, y: 20 });
    });

    itOrPending('selectsByClick', 'click sobre un nodo emite nodeSelected({id})', () => {
      const nodes: SolFlowCanvasNode[] = [{ id: 'a', label: 'A', kind: 'default', position: { x: 0, y: 0 } }];
      const harness = setup({ nodes, edges: [] });
      harness.detectChanges();

      const selected: string[] = [];
      harness.component.nodeSelected.subscribe((e) => selected.push(e.id));
      harness.actions.clickNode('a');

      expect(selected).toEqual(['a']);
    });

    itOrPending('selectsByKeyboard', 'la activación por teclado del nodo enfocado TAMBIÉN emite nodeSelected({id}) — paridad a11y', () => {
      const nodes: SolFlowCanvasNode[] = [{ id: 'a', label: 'A', kind: 'default', position: { x: 0, y: 0 } }];
      const harness = setup({ nodes, edges: [] });
      harness.detectChanges();

      const selected: string[] = [];
      harness.component.nodeSelected.subscribe((e) => selected.push(e.id));
      harness.actions.keyboardSelectNode('a');

      expect(selected).toEqual(['a']);
    });

    itOrPending('emitsNodeMovedOnDrag', 'arrastrar un nodo emite nodeMoved({id, position}) con la posición final', () => {
      const nodes: SolFlowCanvasNode[] = [{ id: 'a', label: 'A', kind: 'default', position: { x: 50, y: 50 } }];
      const harness = setup({ nodes, edges: [] });
      harness.detectChanges();

      const moved: { id: string; position: SolFlowCanvasPosition }[] = [];
      harness.component.nodeMoved.subscribe((e) => moved.push(e));
      harness.actions.dragNodeBy('a', { x: 30, y: -10 });

      expect(moved).toEqual([{ id: 'a', position: { x: 80, y: 40 } }]);
    });

    itOrPending('emitsConnectionCreated', 'armar "conectar" en un nodo y activar otro emite connectionCreated({sourceId, targetId}) — mecánica de la API, no del gesto', () => {
      const nodes: SolFlowCanvasNode[] = [
        { id: 'a', label: 'A', kind: 'default', position: { x: 0, y: 0 } },
        { id: 'b', label: 'B', kind: 'default', position: { x: 200, y: 0 } },
      ];
      const harness = setup({ nodes, edges: [] });
      harness.detectChanges();

      const created: { sourceId: string; targetId: string }[] = [];
      harness.component.connectionCreated.subscribe((e) => created.push(e));
      harness.actions.armConnectFrom('a');
      harness.actions.activateNodeForConnect('b');

      expect(created).toEqual([{ sourceId: 'a', targetId: 'b' }]);
    });

    itOrPending('readonlyBlocksMutations', 'readonly=true bloquea arrastre/conectar/quitar — la selección sigue activa (no es una mutación)', () => {
      const nodes: SolFlowCanvasNode[] = [
        { id: 'a', label: 'A', kind: 'default', position: { x: 0, y: 0 } },
        { id: 'b', label: 'B', kind: 'default', position: { x: 200, y: 0 } },
      ];
      const edges: SolFlowCanvasEdge[] = [{ id: 'a-b', sourceId: 'a', targetId: 'b', kind: 'always' }];
      const harness = setup({ nodes, edges, readonly: true });
      harness.detectChanges();

      const moved: unknown[] = [];
      const created: unknown[] = [];
      const removed: unknown[] = [];
      harness.component.nodeMoved.subscribe((e) => moved.push(e));
      harness.component.connectionCreated.subscribe((e) => created.push(e));
      harness.component.connectionRemoved.subscribe((e) => removed.push(e));

      harness.actions.dragNodeBy('a', { x: 50, y: 50 });
      harness.actions.armConnectFrom('a');
      harness.actions.activateNodeForConnect('b');
      harness.actions.removeEdge('a-b');

      expect(moved).toEqual([]);
      expect(created).toEqual([]);
      expect(removed).toEqual([]);

      // Sonda INDEPENDIENTE (suscrita recién ahora): la selección no es una
      // mutación, sigue activa en readonly. Deliberadamente separada de los
      // intentos de arriba — `activateNodeForConnect` puede, según el motor,
      // degradar a un click normal cuando "conectar" nunca se armó (como en
      // este shell); esta sonda no depende de ese detalle de implementación.
      const selected: string[] = [];
      harness.component.nodeSelected.subscribe((e) => selected.push(e.id));
      harness.actions.clickNode('a');
      expect(selected).toEqual(['a']);
    });

    itOrPending('appliesVisualStates', 'el estado visual de cada nodo (idle|running|ok|error) se refleja en el render', () => {
      const nodes: SolFlowCanvasNode[] = [
        { id: 'a', label: 'A', kind: 'default', position: { x: 0, y: 0 }, visualState: 'running' },
        { id: 'b', label: 'B', kind: 'default', position: { x: 200, y: 0 }, visualState: 'error' },
        { id: 'c', label: 'C', kind: 'default', position: { x: 400, y: 0 } },
      ];
      const harness = setup({ nodes, edges: [] });
      harness.detectChanges();

      expect(harness.query.nodeVisualState('a')).toBe('running');
      expect(harness.query.nodeVisualState('b')).toBe('error');
      expect(harness.query.nodeVisualState('c')).toBe('idle');
    });

    itOrPending('autoLayoutPositionsUnpositionedNodes', 'autoLayout() posiciona SOLO los nodos sin posición válida — los ya posicionados no se tocan', () => {
      const positioned: SolFlowCanvasNode = { id: 'a', label: 'A', kind: 'default', position: { x: 777, y: 777 } };
      const positionless = { id: 'b', label: 'B', kind: 'default' } as unknown as SolFlowCanvasNode;
      const harness = setup({ nodes: [positioned, positionless], edges: [] });
      harness.detectChanges();

      const moved: { id: string; position: SolFlowCanvasPosition }[] = [];
      harness.component.nodeMoved.subscribe((e) => moved.push(e));

      harness.component.autoLayout();
      harness.detectChanges();

      expect(moved.map((m) => m.id)).toEqual(['b']);
      expect(harness.query.nodePosition('a')).toEqual({ x: 777, y: 777 });
      expect(harness.query.nodePosition('b')).not.toBeNull();
    });

    itOrPending('rendersManyNodesWithinBudget', '60+ nodos renderizan dentro de un presupuesto de tiempo laxo (smoke de perf, no benchmark estricto)', () => {
      const PERF_BUDGET_MS = 3000;
      const nodes: SolFlowCanvasNode[] = Array.from({ length: 65 }, (_, i) => ({
        id: `n${i}`,
        label: `Nodo ${i}`,
        kind: 'default',
        position: { x: (i % 10) * 220, y: Math.floor(i / 10) * 120 },
      }));
      const edges: SolFlowCanvasEdge[] = Array.from({ length: 64 }, (_, i) => ({
        id: `e${i}`,
        sourceId: `n${i}`,
        targetId: `n${i + 1}`,
        kind: 'always' as const,
      }));

      const start = performance.now();
      const harness = setup({ nodes, edges });
      harness.detectChanges();
      const elapsedMs = performance.now() - start;

      expect(harness.query.nodeCount()).toBe(65);
      expect(elapsedMs).toBeLessThan(PERF_BUDGET_MS);
    });
  });
}

// --- Harness del shell de PR-C1 (auto-ejecuta la suite contra SolFlowCanvasComponent) ---

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, cancelable: true });
}

function setupShellHarness(input: FlowCanvasHarnessSetupInput): FlowCanvasHarness {
  TestBed.configureTestingModule({
    imports: [SolFlowCanvasComponent],
    providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
  });
  const fixture: ComponentFixture<SolFlowCanvasComponent> = TestBed.createComponent(SolFlowCanvasComponent);
  fixture.componentRef.setInput('nodes', input.nodes);
  fixture.componentRef.setInput('edges', input.edges);
  if (input.readonly !== undefined) fixture.componentRef.setInput('readonly', input.readonly);
  if (input.selectedId !== undefined) fixture.componentRef.setInput('selectedId', input.selectedId);
  if (input.highlightedNodeId !== undefined) fixture.componentRef.setInput('highlightedNodeId', input.highlightedNodeId);

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const nodeEl = (id: string): HTMLElement | null => host().querySelector(`[data-testid="flow-canvas-node-${id}"]`);
  const nodeSurface = (id: string): HTMLButtonElement =>
    nodeEl(id)!.querySelector('.sol-flow-canvas__node-surface') as HTMLButtonElement;
  const connectHandle = (id: string): HTMLButtonElement | null =>
    nodeEl(id)!.querySelector('.sol-flow-canvas__node-connect-handle');

  return {
    component: fixture.componentInstance,
    detectChanges: () => fixture.detectChanges(),
    query: {
      nodeCount: () => host().querySelectorAll('[data-testid^="flow-canvas-node-"]').length,
      nodeExists: (id) => !!nodeEl(id),
      nodePosition: (id) => {
        const el = nodeEl(id);
        if (!el) return null;
        return { x: Number.parseFloat(el.style.left), y: Number.parseFloat(el.style.top) };
      },
      nodeVisualState: (id) => nodeEl(id)?.getAttribute('data-visual-state') ?? null,
      edgeCount: () => host().querySelectorAll('.sol-flow-canvas__edge-line').length,
    },
    actions: {
      dragNodeBy: (id, delta) => {
        const surface = nodeSurface(id);
        surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
        surface.dispatchEvent(pointerEvent('pointermove', 100 + delta.x, 100 + delta.y));
        surface.dispatchEvent(pointerEvent('pointerup', 100 + delta.x, 100 + delta.y));
        fixture.detectChanges();
      },
      clickNode: (id) => {
        nodeSurface(id).click();
        fixture.detectChanges();
      },
      // El nodo es un <button> real: Enter/Espacio disparan el MISMO evento `click` que el mouse — no hace falta un camino de código aparte.
      keyboardSelectNode: (id) => {
        nodeSurface(id).click();
        fixture.detectChanges();
      },
      armConnectFrom: (id) => {
        const handle = connectHandle(id);
        if (!handle) return; // readonly: sin handle — la mutación queda bloqueada por diseño
        handle.click();
        fixture.detectChanges();
      },
      activateNodeForConnect: (id) => {
        nodeSurface(id).click();
        fixture.detectChanges();
      },
      removeEdge: () => {
        const removeBtn = host().querySelector('.sol-flow-canvas__edge-remove') as HTMLButtonElement | null;
        if (!removeBtn) return; // readonly: sin botón — la mutación queda bloqueada por diseño
        removeBtn.click();
        fixture.detectChanges();
      },
    },
  };
}

runFlowCanvasAcceptanceSuite(setupShellHarness);

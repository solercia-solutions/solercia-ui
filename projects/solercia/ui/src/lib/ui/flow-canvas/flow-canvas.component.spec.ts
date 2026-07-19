import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolFlowCanvasComponent } from './flow-canvas.component';
import type {
  SolFlowCanvasConnectionCreatedEvent,
  SolFlowCanvasConnectionRemovedEvent,
  SolFlowCanvasEdge,
  SolFlowCanvasNode,
  SolFlowCanvasNodeMovedEvent,
  SolFlowCanvasNodeSelectedEvent,
  SolFlowCanvasNodeTemplateContext,
} from './flow-canvas.model';

function n(overrides: Partial<SolFlowCanvasNode> & { id: string }): SolFlowCanvasNode {
  return { label: overrides.id, kind: 'default', position: { x: 0, y: 0 }, ...overrides };
}

function e(overrides: Partial<SolFlowCanvasEdge> & { id: string; sourceId: string; targetId: string }): SolFlowCanvasEdge {
  return { kind: 'always', ...overrides };
}

@Component({
  standalone: true,
  template: `<ng-template #node let-node let-selected="selected" let-highlighted="highlighted">
    <span class="demo-node-label">{{ node.label }}</span>
    <span class="demo-node-selected">{{ selected }}</span>
    <span class="demo-node-highlighted">{{ highlighted }}</span>
  </ng-template>`,
})
class TemplateHostComponent {
  readonly nodeTpl = viewChild.required<TemplateRef<SolFlowCanvasNodeTemplateContext>>('node');
}

describe('SolFlowCanvasComponent', () => {
  let fixture: ComponentFixture<SolFlowCanvasComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function nodeEl(id: string): HTMLElement {
    return host().querySelector(`[data-testid="flow-canvas-node-${id}"]`) as HTMLElement;
  }

  function nodeSurface(id: string): HTMLButtonElement {
    return nodeEl(id).querySelector('.sol-flow-canvas__node-surface') as HTMLButtonElement;
  }

  function pointerEvent(type: string, x: number, y: number): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, cancelable: true });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolFlowCanvasComponent],
      providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
    });
    fixture = TestBed.createComponent(SolFlowCanvasComponent);
  });

  const twoNodes: SolFlowCanvasNode[] = [
    n({ id: 'a', label: 'Nodo A', position: { x: 10, y: 20 } }),
    n({ id: 'b', label: 'Nodo B', position: { x: 300, y: 20 } }),
  ];
  const oneEdge: SolFlowCanvasEdge[] = [e({ id: 'a->b', sourceId: 'a', targetId: 'b' })];

  it('[spec] renderiza un nodo por elemento de `nodes`, posicionado de forma absoluta según `position`', () => {
    fixture.componentRef.setInput('nodes', twoNodes);
    fixture.detectChanges();

    expect(nodeEl('a')).toBeTruthy();
    expect(nodeEl('b')).toBeTruthy();
    expect(nodeEl('a').style.left).toBe('10px');
    expect(nodeEl('a').style.top).toBe('20px');
  });

  it('[spec] renderiza una línea SVG por cada edge cuyos extremos existen entre `nodes`', () => {
    fixture.componentRef.setInput('nodes', twoNodes);
    fixture.componentRef.setInput('edges', oneEdge);
    fixture.detectChanges();

    expect(host().querySelectorAll('.sol-flow-canvas__edge-line').length).toBe(1);
  });

  it('un edge que referencia un nodo inexistente NO se renderiza (robustez)', () => {
    fixture.componentRef.setInput('nodes', twoNodes);
    fixture.componentRef.setInput('edges', [e({ id: 'a->fantasma', sourceId: 'a', targetId: 'fantasma' })]);
    fixture.detectChanges();

    expect(host().querySelectorAll('.sol-flow-canvas__edge-line').length).toBe(0);
  });

  it('[robustez] nodes/edges null/undefined no lanza — lienzo vacío', () => {
    expect(() => {
      fixture.componentRef.setInput('nodes', null);
      fixture.componentRef.setInput('edges', undefined);
      fixture.detectChanges();
    }).not.toThrow();
    expect(host().querySelectorAll('[data-testid^="flow-canvas-node-"]').length).toBe(0);
  });

  describe('selección — click y teclado (mismo <button> nativo, paridad a11y gratuita)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();
    });

    it('click en un nodo emite nodeSelected({id})', () => {
      const selected: SolFlowCanvasNodeSelectedEvent[] = [];
      fixture.componentInstance.nodeSelected.subscribe((e) => selected.push(e));

      nodeSurface('a').click();

      expect(selected).toEqual([{ id: 'a' }]);
    });

    it('el nodo se renderiza como <button> real — Enter/Espacio disparan el MISMO evento click del navegador, sin lógica adicional', () => {
      expect(nodeSurface('a').tagName).toBe('BUTTON');
      expect(nodeSurface('a').getAttribute('type')).toBe('button');
    });

    it('[selectedId] aplica la clase de selección al nodo correspondiente', () => {
      fixture.componentRef.setInput('selectedId', 'b');
      fixture.detectChanges();

      expect(nodeEl('a').classList.contains('sol-flow-canvas__node--selected')).toBe(false);
      expect(nodeEl('b').classList.contains('sol-flow-canvas__node--selected')).toBe(true);
    });

    it('[highlightedNodeId] aplica la clase de resaltado al nodo correspondiente', () => {
      fixture.componentRef.setInput('highlightedNodeId', 'a');
      fixture.detectChanges();

      expect(nodeEl('a').classList.contains('sol-flow-canvas__node--highlighted')).toBe(true);
    });
  });

  describe('nodeMoved — arrastre por mouse (pointerdown/move/up) simulado por eventos', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();
    });

    it('arrastrar más allá del umbral emite nodeMoved con la posición final', () => {
      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 140, 130));
      surface.dispatchEvent(pointerEvent('pointerup', 140, 130));

      expect(moved).toEqual([{ id: 'a', position: { x: 10 + 40, y: 20 + 30 } }]);
    });

    it('un gesto SIN desplazamiento real (por debajo del umbral) NO emite nodeMoved', () => {
      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointerup', 101, 100));

      expect(moved).toEqual([]);
    });

    it('un click NORMAL tras un gesto sin desplazamiento SÍ selecciona (el pointerup por debajo del umbral no interfiere)', () => {
      const selected: SolFlowCanvasNodeSelectedEvent[] = [];
      fixture.componentInstance.nodeSelected.subscribe((e) => selected.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointerup', 100, 100));
      surface.click();

      expect(selected).toEqual([{ id: 'a' }]);
    });

    it('el click sintético que sigue a un drag REAL no vuelve a seleccionar (se consume una sola vez)', () => {
      const selected: SolFlowCanvasNodeSelectedEvent[] = [];
      fixture.componentInstance.nodeSelected.subscribe((e) => selected.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 140, 130));
      surface.dispatchEvent(pointerEvent('pointerup', 140, 130));
      surface.click();

      expect(selected).toEqual([]);
    });

    it('[readonly] no emite nodeMoved al arrastrar', () => {
      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 140, 130));
      surface.dispatchEvent(pointerEvent('pointerup', 140, 130));

      expect(moved).toEqual([]);
    });

    it('[readonly] la selección por click SIGUE activa (readonly bloquea mutaciones, no selección)', () => {
      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();

      const selected: SolFlowCanvasNodeSelectedEvent[] = [];
      fixture.componentInstance.nodeSelected.subscribe((e) => selected.push(e));
      nodeSurface('a').click();

      expect(selected).toEqual([{ id: 'a' }]);
    });
  });

  describe('nodeMoved — nudge por teclado (paridad a11y del arrastre — el CDK no la trae gratis)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();
    });

    it('ArrowRight mueve el nodo enfocado y emite nodeMoved', () => {
      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      nodeSurface('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      expect(moved.length).toBe(1);
      expect(moved[0].id).toBe('a');
      expect(moved[0].position.x).toBeGreaterThan(10);
      expect(moved[0].position.y).toBe(20);
    });

    it('[readonly] ArrowRight no mueve nada', () => {
      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));
      nodeSurface('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      expect(moved).toEqual([]);
    });

    it('una tecla ajena (p. ej. "a") no mueve nada', () => {
      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));
      nodeSurface('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

      expect(moved).toEqual([]);
    });
  });

  describe('connectionCreated / connectionRemoved — mecánica de la API (arma origen → activa destino)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.componentRef.setInput('edges', oneEdge);
      fixture.detectChanges();
    });

    function connectHandle(id: string): HTMLButtonElement {
      return nodeEl(id).querySelector('.sol-flow-canvas__node-connect-handle') as HTMLButtonElement;
    }

    it('activar el handle de conectar en "a" y luego click en "b" emite connectionCreated({sourceId:a, targetId:b})', () => {
      const created: SolFlowCanvasConnectionCreatedEvent[] = [];
      fixture.componentInstance.connectionCreated.subscribe((e) => created.push(e));

      connectHandle('a').click();
      nodeSurface('b').click();

      expect(created).toEqual([{ sourceId: 'a', targetId: 'b' }]);
    });

    it('armar conectar y luego click en el MISMO nodo cancela el modo (no emite connectionCreated, cae a selección normal)', () => {
      const created: SolFlowCanvasConnectionCreatedEvent[] = [];
      const selected: SolFlowCanvasNodeSelectedEvent[] = [];
      fixture.componentInstance.connectionCreated.subscribe((e) => created.push(e));
      fixture.componentInstance.nodeSelected.subscribe((e) => selected.push(e));

      connectHandle('a').click();
      nodeSurface('a').click();

      expect(created).toEqual([]);
      expect(selected).toEqual([{ id: 'a' }]);
    });

    it('Escape cancela el modo conectar armado', () => {
      const created: SolFlowCanvasConnectionCreatedEvent[] = [];
      fixture.componentInstance.connectionCreated.subscribe((e) => created.push(e));

      connectHandle('a').click();
      // El binding `(keydown.escape)` vive en el `.sol-flow-canvas` interno (no en el host del componente) —
      // en uso real, el evento se origina en un elemento DENTRO del lienzo (p. ej. un nodo enfocado) y burbujea hasta acá.
      host().querySelector('.sol-flow-canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      nodeSurface('b').click();

      expect(created).toEqual([]);
    });

    it('[readonly] no renderiza el handle de conectar', () => {
      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();
      expect(connectHandle('a')).toBeNull();
    });

    it('click en "quitar" de una conexión emite connectionRemoved({id})', () => {
      const removed: SolFlowCanvasConnectionRemovedEvent[] = [];
      fixture.componentInstance.connectionRemoved.subscribe((e) => removed.push(e));

      const removeBtn = host().querySelector('.sol-flow-canvas__edge-remove') as HTMLButtonElement;
      removeBtn.click();

      expect(removed).toEqual([{ id: 'a->b' }]);
    });

    it('[readonly] no renderiza el botón de quitar conexión', () => {
      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();
      expect(host().querySelector('.sol-flow-canvas__edge-remove')).toBeNull();
    });
  });

  describe('estados visuales por nodo', () => {
    it('aplica data-visual-state según SolFlowCanvasNode.visualState (default "idle")', () => {
      fixture.componentRef.setInput('nodes', [
        n({ id: 'a', visualState: 'error' }),
        n({ id: 'b' }),
      ]);
      fixture.detectChanges();

      expect(nodeEl('a').getAttribute('data-visual-state')).toBe('error');
      expect(nodeEl('b').getAttribute('data-visual-state')).toBe('idle');
    });
  });

  describe('template proyectado por nodo', () => {
    it('con nodeTemplate, renderiza el contenido proyectado con contexto tipado ($implicit + selected + highlighted)', () => {
      const templateHost = TestBed.createComponent(TemplateHostComponent);
      templateHost.detectChanges();

      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.componentRef.setInput('selectedId', 'a');
      fixture.componentRef.setInput('nodeTemplate', templateHost.componentInstance.nodeTpl());
      fixture.detectChanges();

      const labels = Array.from(host().querySelectorAll('.demo-node-label')).map((el) => el.textContent);
      expect(labels).toEqual(['Nodo A', 'Nodo B']);

      const selectedFlags = Array.from(host().querySelectorAll('.demo-node-selected')).map((el) => el.textContent);
      expect(selectedFlags).toEqual(['true', 'false']);
    });

    it('sin nodeTemplate, cae a mostrar solo `label`', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();
      expect(nodeEl('a').textContent).toContain('Nodo A');
    });
  });

  describe('autoLayout() — posiciona SOLO los nodos sin posición válida', () => {
    it('un nodo sin position válido recibe una posición calculada y emite nodeMoved; el nodo YA posicionado no se toca', () => {
      const positionless = { ...n({ id: 'b', label: 'Sin posición' }) };
      // @ts-expect-error — runtime deliberadamente sin position (defensivo: un input no garantiza un valor válido en runtime)
      delete positionless.position;

      fixture.componentRef.setInput('nodes', [n({ id: 'a', position: { x: 999, y: 999 } }), positionless]);
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      fixture.componentInstance.autoLayout();
      fixture.detectChanges();

      expect(moved.length).toBe(1);
      expect(moved[0].id).toBe('b');
      expect(nodeEl('a').style.left).toBe('999px'); // sin tocar
      expect(nodeEl('b').style.left).not.toBe(''); // recibió una posición
    });

    it('si todos los nodos ya tienen posición, autoLayout() no emite nada', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));
      fixture.componentInstance.autoLayout();

      expect(moved).toEqual([]);
    });
  });

  describe('perf — smoke con 60+ nodos', () => {
    it('renderiza 60 nodos y 59 edges en un presupuesto de tiempo laxo', () => {
      const manyNodes: SolFlowCanvasNode[] = Array.from({ length: 60 }, (_, i) =>
        n({ id: `n${i}`, label: `Nodo ${i}`, position: { x: (i % 10) * 220, y: Math.floor(i / 10) * 120 } }),
      );
      const manyEdges: SolFlowCanvasEdge[] = Array.from({ length: 59 }, (_, i) =>
        e({ id: `e${i}`, sourceId: `n${i}`, targetId: `n${i + 1}` }),
      );

      const start = performance.now();
      fixture.componentRef.setInput('nodes', manyNodes);
      fixture.componentRef.setInput('edges', manyEdges);
      fixture.detectChanges();
      const elapsedMs = performance.now() - start;

      expect(host().querySelectorAll('[data-testid^="flow-canvas-node-"]').length).toBe(60);
      expect(host().querySelectorAll('.sol-flow-canvas__edge-line').length).toBe(59);
      expect(elapsedMs).toBeLessThan(2000); // presupuesto LAXO (smoke, no benchmark estricto) — ver reporte de la fase
    });
  });
});

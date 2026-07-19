import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { computeEdgeMidpoint } from './flow-canvas-edge-geometry';
import { computeAutoLayoutPositions } from './flow-canvas-layout';
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

  function pointerEvent(type: string, x: number, y: number, pointerId = 1): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, pointerId, bubbles: true, cancelable: true });
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

  describe('anti-NG0955 — edges con id duplicado (C2, 4R Ola 5)', () => {
    it('dos edges con el MISMO id renderizan igual (2 líneas + 2 etiquetas) — el fallback por índice conserva el conteo, solo cambia la llave interna de reconciliación', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.componentRef.setInput('edges', [
        e({ id: 'dup', sourceId: 'a', targetId: 'b' }),
        e({ id: 'dup', sourceId: 'b', targetId: 'a' }),
      ]);
      fixture.detectChanges();

      expect(host().querySelectorAll('.sol-flow-canvas__edge-line').length).toBe(2);
      expect(host().querySelectorAll('.sol-flow-canvas__edge-label').length).toBe(2);
    });

    it('trackEdge produce llaves DISTINTAS para dos edges con el MISMO id — mismo contrato que trackNode/safeTrackKey (evita el `track` duplicado que Angular documenta como NG0955)', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      const dup1 = e({ id: 'dup', sourceId: 'a', targetId: 'b' });
      const dup2 = e({ id: 'dup', sourceId: 'b', targetId: 'a' });
      fixture.componentRef.setInput('edges', [dup1, dup2]);
      fixture.detectChanges();

      const key1 = fixture.componentInstance.trackEdge(dup1, 0);
      const key2 = fixture.componentInstance.trackEdge(dup2, 1);
      expect(key1).not.toBe(key2);
    });
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

    it('el nodo se renderiza como <button> real (semántica base); Enter/Espacio se manejan además de forma EXPLÍCITA en onNodeKeydown (W6)', () => {
      expect(nodeSurface('a').tagName).toBe('BUTTON');
      expect(nodeSurface('a').getAttribute('type')).toBe('button');
    });

    it('Enter sobre el nodo enfocado emite nodeSelected — activación EXPLÍCITA (W6: no se delega en el click nativo del navegador)', () => {
      const selected: SolFlowCanvasNodeSelectedEvent[] = [];
      fixture.componentInstance.nodeSelected.subscribe((e) => selected.push(e));

      nodeSurface('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

      expect(selected).toEqual([{ id: 'a' }]);
    });

    it('Espacio sobre el nodo enfocado también emite nodeSelected (misma activación explícita que Enter)', () => {
      const selected: SolFlowCanvasNodeSelectedEvent[] = [];
      fixture.componentInstance.nodeSelected.subscribe((e) => selected.push(e));

      nodeSurface('a').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));

      expect(selected).toEqual([{ id: 'a' }]);
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

    it('[borde] distance === DRAG_THRESHOLD_PX (4px exactos) SÍ cuenta como arrastre y commitea (S3)', () => {
      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 100, 104)); // desplazamiento acumulado = 4px exactos
      surface.dispatchEvent(pointerEvent('pointerup', 100, 104));

      expect(moved).toEqual([{ id: 'a', position: { x: 10, y: 24 } }]);
    });

    it('[borde] distance apenas por debajo de 4px NO emite nodeMoved — cae a click (S3)', () => {
      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 100, 103.9));
      surface.dispatchEvent(pointerEvent('pointerup', 100, 103.9));

      expect(moved).toEqual([]);
    });
  });

  describe('aislamiento de puntero — multi-touch no corrompe el drag (C1, 4R Ola 5)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();
    });

    it('dos punteros concurrentes sobre nodos distintos: el primero en iniciar GANA y completa con su nodeMoved correcto; el segundo (ignorado desde el pointerdown) no interfiere', () => {
      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surfaceA = nodeSurface('a');
      const surfaceB = nodeSurface('b');

      surfaceA.dispatchEvent(pointerEvent('pointerdown', 100, 100, 1));
      // Un segundo puntero arranca un drag en OTRO nodo mientras el primero sigue activo — debe IGNORARSE por completo.
      surfaceB.dispatchEvent(pointerEvent('pointerdown', 500, 100, 2));

      surfaceA.dispatchEvent(pointerEvent('pointermove', 140, 130, 1));
      // El move del puntero ajeno (2) sobre B tampoco debe mover nada (B nunca entró en drag).
      surfaceB.dispatchEvent(pointerEvent('pointermove', 540, 130, 2));

      // El up del puntero ajeno (2) llega PRIMERO — no debe limpiar el drag activo de A.
      surfaceB.dispatchEvent(pointerEvent('pointerup', 540, 130, 2));
      surfaceA.dispatchEvent(pointerEvent('pointerup', 140, 130, 1));
      fixture.detectChanges();

      expect(moved).toEqual([{ id: 'a', position: { x: 10 + 40, y: 20 + 30 } }]);
      expect(nodeEl('a').style.left).toBe('50px');
      expect(nodeEl('b').style.left).toBe('300px'); // sin tocar — el segundo puntero nunca tuvo efecto
    });
  });

  describe('pointercancel — revierte, NUNCA commitea (W3, 4R Ola 5)', () => {
    it('un pointercancel a mitad de arrastre revierte la posición visual sin emitir nodeMoved', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 140, 130));
      fixture.detectChanges();
      expect(nodeEl('a').style.left).toBe('50px');

      surface.dispatchEvent(new PointerEvent('pointercancel', { clientX: 140, clientY: 130, pointerId: 1, bubbles: true, cancelable: true }));
      fixture.detectChanges();

      expect(moved).toEqual([]);
      expect(nodeEl('a').style.left).toBe('10px'); // revierte a la fuente (nodes()), no a la última posición arrastrada
    });

    it('un pointercancel a mitad de arrastre anuncia la cancelación por aria-live (re-check 4R SUGGESTION: las 4 mutaciones exitosas ya anunciaban, esta reversión quedaba muda)', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 140, 130));
      surface.dispatchEvent(new PointerEvent('pointercancel', { clientX: 140, clientY: 130, pointerId: 1, bubbles: true, cancelable: true }));
      fixture.detectChanges();

      expect(host().querySelector('.sol-flow-canvas__announce')?.textContent).toBe('Se canceló el movimiento del nodo.');
    });
  });

  describe('lostpointercapture — defensa contra reasignación de captura por el navegador (W5, 4R Ola 5)', () => {
    it('un lostpointercapture a mitad de arrastre revierte sin commitear (mismo criterio que pointercancel)', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 140, 130));
      fixture.detectChanges();
      expect(nodeEl('a').style.left).toBe('50px');

      surface.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true, cancelable: true }));
      fixture.detectChanges();

      expect(moved).toEqual([]);
      expect(nodeEl('a').style.left).toBe('10px');
    });
  });

  describe('clamp a coordenadas no negativas (W4, 4R Ola 5)', () => {
    it('arrastrar hacia una posición negativa clampea a (0,0) — tanto en el arrastre visual como en el commit', () => {
      fixture.componentRef.setInput('nodes', twoNodes); // 'a' arranca en (10,20)
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 50, 50)); // dx=-50,dy=-50 → (10-50,20-50)=(-40,-30) sin clamp
      fixture.detectChanges();
      expect(nodeEl('a').style.left).toBe('0px'); // clamp YA durante el arrastre visual
      expect(nodeEl('a').style.top).toBe('0px');

      surface.dispatchEvent(pointerEvent('pointerup', 50, 50));

      expect(moved).toEqual([{ id: 'a', position: { x: 0, y: 0 } }]);
    });

    it('el nudge por teclado también clampea — no cruza (0,0)', () => {
      fixture.componentRef.setInput('nodes', [n({ id: 'a', position: { x: 5, y: 5 } }), n({ id: 'b', position: { x: 300, y: 20 } })]);
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      fixture.detectChanges(); // refresca el `node` capturado por el binding de plantilla antes del SIGUIENTE keydown
      surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      fixture.detectChanges();

      expect(moved[moved.length - 1].position).toEqual({ x: 0, y: 0 });
    });

    it('un nodo con `position` NEGATIVA directo del input (sin arrastre) también clampea a (0,0) al renderizar — el clamp vale en CUALQUIER rama de resolvedPosition(), no solo durante un drag (re-check 4R: hoy la única fuente es autoLayout, siempre ≥0, pero un input externo como `canvas_position` del backend podría traer negativos)', () => {
      fixture.componentRef.setInput('nodes', [n({ id: 'a', position: { x: -25, y: -10 } }), n({ id: 'b', position: { x: 300, y: 20 } })]);
      fixture.detectChanges();

      expect(nodeEl('a').style.left).toBe('0px');
      expect(nodeEl('a').style.top).toBe('0px');
    });
  });

  describe('readonly a mitad de gesto — el flip cancela mutaciones en curso (W1+W2, 4R Ola 5)', () => {
    it('un drag iniciado ANTES del flip a readonly no commitea al soltar — la posición visual revierte a la fuente', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 140, 130));
      fixture.detectChanges();
      expect(nodeEl('a').style.left).toBe('50px'); // arrastre visual en curso, aún sin commitear

      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();
      expect(nodeEl('a').style.left).toBe('10px'); // el effect revierte a nodes() — SIN emitir

      surface.dispatchEvent(pointerEvent('pointerup', 140, 130));

      expect(moved).toEqual([]);
      expect(nodeEl('a').style.left).toBe('10px');
    });

    it('una conexión armada ANTES del flip a readonly no completa connectionCreated al activar el destino después', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.componentRef.setInput('edges', oneEdge);
      fixture.detectChanges();

      const created: SolFlowCanvasConnectionCreatedEvent[] = [];
      fixture.componentInstance.connectionCreated.subscribe((e) => created.push(e));

      const connectHandleA = nodeEl('a').querySelector('.sol-flow-canvas__node-connect-handle') as HTMLButtonElement;
      connectHandleA.click();

      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();

      nodeSurface('b').click();

      expect(created).toEqual([]);
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

    it('con VARIOS nodos sin posición, emite un nodeMoved por cada uno con la posición EXACTA de computeAutoLayoutPositions (W8 — no un chequeo laxo tipo not.toBeNull())', () => {
      const positionless: SolFlowCanvasNode[] = [
        { id: 'x', label: 'Nodo X', kind: 'default' } as unknown as SolFlowCanvasNode,
        { id: 'y', label: 'Nodo Y', kind: 'default' } as unknown as SolFlowCanvasNode,
        { id: 'z', label: 'Nodo Z', kind: 'default' } as unknown as SolFlowCanvasNode,
      ];

      fixture.componentRef.setInput('nodes', positionless);
      fixture.detectChanges();

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      fixture.componentInstance.autoLayout();
      fixture.detectChanges();

      const expected = computeAutoLayoutPositions(positionless, []);
      expect(moved).toEqual([
        { id: 'x', position: expected.get('x') },
        { id: 'y', position: expected.get('y') },
        { id: 'z', position: expected.get('z') },
      ]);
      const distinctPositions = new Set(moved.map((m) => `${m.position.x},${m.position.y}`));
      expect(distinctPositions.size).toBe(3); // tres posiciones DISTINTAS — cada nodo cae en su propia fila del layout
    });

    it('[readonly] autoLayout() no hace nada — TODA mutación queda bloqueada en modo lectura (S1)', () => {
      const positionless = { ...n({ id: 'b', label: 'Sin posición' }) };
      // @ts-expect-error — runtime deliberadamente sin position (defensivo: un input no garantiza un valor válido en runtime)
      delete positionless.position;

      fixture.componentRef.setInput('nodes', [n({ id: 'a', position: { x: 999, y: 999 } }), positionless]);
      fixture.componentRef.setInput('readonly', true);
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

    it('[PR-C2B] renderiza 120 nodos y 119 edges bezier en un presupuesto de tiempo laxo (medición explícita del bake-off, además de los 65 nodos de la suite de aceptación)', () => {
      const manyNodes: SolFlowCanvasNode[] = Array.from({ length: 120 }, (_, i) =>
        n({ id: `n${i}`, label: `Nodo ${i}`, position: { x: (i % 12) * 220, y: Math.floor(i / 12) * 120 } }),
      );
      const manyEdges: SolFlowCanvasEdge[] = Array.from({ length: 119 }, (_, i) =>
        e({ id: `e${i}`, sourceId: `n${i}`, targetId: `n${i + 1}` }),
      );

      const start = performance.now();
      fixture.componentRef.setInput('nodes', manyNodes);
      fixture.componentRef.setInput('edges', manyEdges);
      fixture.detectChanges();
      const elapsedMs = performance.now() - start;

      expect(host().querySelectorAll('[data-testid^="flow-canvas-node-"]').length).toBe(120);
      expect(host().querySelectorAll('.sol-flow-canvas__edge-line').length).toBe(119);
      // presupuesto LAXO (smoke sobre jsdom, NO un benchmark de paint/compositing real de navegador — ver
      // "Perf" del reporte de fase para la advertencia completa sobre el alcance de esta medición).
      expect(elapsedMs).toBeLessThan(4000);
    });
  });

  describe('pan/zoom del lienzo (PR-C2B — motor nativo SVG+Pointer Events)', () => {
    function worldEl(): HTMLElement {
      return host().querySelector('.sol-flow-canvas__world') as HTMLElement;
    }

    function worldTransformValues(): { panX: number; panY: number; zoom: number } {
      const transform = worldEl().style.transform;
      const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/.exec(transform);
      if (!match) throw new Error(`transform inesperado: "${transform}"`);
      return { panX: Number.parseFloat(match[1]), panY: Number.parseFloat(match[2]), zoom: Number.parseFloat(match[3]) };
    }

    function canvasRoot(): HTMLElement {
      return host().querySelector('.sol-flow-canvas') as HTMLElement;
    }

    beforeEach(() => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();
    });

    it('el viewport arranca en pan=(0,0) y zoom=1 (mismo criterio que el shell — coordenadas world=screen por defecto)', () => {
      expect(worldTransformValues()).toEqual({ panX: 0, panY: 0, zoom: 1 });
    });

    it('arrastrar el FONDO (no un nodo) panea el lienzo — el transform del grupo interno refleja el delta de pantalla', () => {
      const root = canvasRoot();
      root.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      root.dispatchEvent(pointerEvent('pointermove', 130, 115));
      fixture.detectChanges();

      expect(worldTransformValues()).toEqual({ panX: 30, panY: 15, zoom: 1 });
    });

    it('soltar el fondo NO emite nodeMoved (panear es una vista, no una mutación del grafo)', () => {
      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

      const root = canvasRoot();
      root.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      root.dispatchEvent(pointerEvent('pointermove', 160, 160));
      root.dispatchEvent(pointerEvent('pointerup', 160, 160));

      expect(moved).toEqual([]);
    });

    it('arrastrar un NODO no arranca ADEMÁS un pan de fondo (el pointerdown del nodo no burbujea — stopPropagation)', () => {
      const surface = nodeSurface('a');
      surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      surface.dispatchEvent(pointerEvent('pointermove', 140, 130));
      fixture.detectChanges();

      expect(worldTransformValues()).toEqual({ panX: 0, panY: 0, zoom: 1 });
    });

    it('el pan funciona igual en modo readonly — NO es una mutación del grafo (a diferencia de arrastrar un nodo)', () => {
      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();

      const root = canvasRoot();
      root.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      root.dispatchEvent(pointerEvent('pointermove', 120, 90));
      fixture.detectChanges();

      expect(worldTransformValues()).toEqual({ panX: 20, panY: -10, zoom: 1 });
    });

    it('la rueda del mouse hace zoom (deltaY negativo acerca) y se clampea en el extremo', () => {
      const root = canvasRoot();
      root.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 50, clientY: 50, bubbles: true, cancelable: true }));
      fixture.detectChanges();
      expect(worldTransformValues().zoom).toBeGreaterThan(1);

      root.dispatchEvent(new WheelEvent('wheel', { deltaY: -100000, clientX: 50, clientY: 50, bubbles: true, cancelable: true }));
      fixture.detectChanges();
      expect(worldTransformValues().zoom).toBe(2.5); // MAX_ZOOM (flow-canvas-viewport.ts)
    });

    it('pinch de dos punteros hace zoom — separar los dedos acerca (2x total, compuesto en dos pasos incrementales)', () => {
      const root = canvasRoot();
      root.dispatchEvent(pointerEvent('pointerdown', 100, 100, 1));
      root.dispatchEvent(pointerEvent('pointerdown', 200, 100, 2));
      // distancia 100 -> 200 (2x), movida en dos pasos (uno por puntero) — ver applyPinchMove en el componente
      root.dispatchEvent(pointerEvent('pointermove', 50, 100, 1));
      root.dispatchEvent(pointerEvent('pointermove', 250, 100, 2));
      fixture.detectChanges();

      expect(worldTransformValues().zoom).toBeCloseTo(2, 5);
    });

    describe('conversión de coordenadas pantalla→canvas al arrastrar un nodo bajo zoom', () => {
      it('con zoom clampeado a 2.5x, un delta de PANTALLA de 40px mueve el nodo 16px en espacio canvas (40/2.5)', () => {
        canvasRoot().dispatchEvent(new WheelEvent('wheel', { deltaY: -100000, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
        fixture.detectChanges();
        expect(worldTransformValues()).toEqual({ panX: 0, panY: 0, zoom: 2.5 }); // ancla en (0,0): sin deriva de pan

        const moved: SolFlowCanvasNodeMovedEvent[] = [];
        fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

        const surface = nodeSurface('a');
        surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
        surface.dispatchEvent(pointerEvent('pointermove', 140, 100));
        surface.dispatchEvent(pointerEvent('pointerup', 140, 100));

        expect(moved).toEqual([{ id: 'a', position: { x: 10 + 16, y: 20 } }]);
      });

      it('el umbral clic-vs-arrastre se mide en PANTALLA, no en canvas: con zoom=2.5x, 4px de pantalla (=1.6px de canvas) YA cuentan como arrastre', () => {
        canvasRoot().dispatchEvent(new WheelEvent('wheel', { deltaY: -100000, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
        fixture.detectChanges();

        const moved: SolFlowCanvasNodeMovedEvent[] = [];
        fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));

        const surface = nodeSurface('a');
        surface.dispatchEvent(pointerEvent('pointerdown', 100, 100));
        surface.dispatchEvent(pointerEvent('pointermove', 104, 100)); // 4px EXACTOS de pantalla
        surface.dispatchEvent(pointerEvent('pointerup', 104, 100));

        expect(moved.length).toBe(1); // si el umbral se midiera en canvas (1.6px < 4px), esto NO emitiría nada
      });
    });

    it('el nudge por teclado sigue moviendo el nodo en pasos FIJOS de canvas, sin importar el zoom (a11y: el zoom no rompe la navegación por teclado)', () => {
      canvasRoot().dispatchEvent(new WheelEvent('wheel', { deltaY: -100000, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
      fixture.detectChanges();
      expect(worldTransformValues().zoom).toBe(2.5);

      const moved: SolFlowCanvasNodeMovedEvent[] = [];
      fixture.componentInstance.nodeMoved.subscribe((e) => moved.push(e));
      nodeSurface('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      expect(moved).toEqual([{ id: 'a', position: { x: 20, y: 20 } }]); // 10 + 10 (paso fijo) — IGUAL que sin zoom (ver test equivalente sin zoom más arriba)
    });
  });

  describe('el foco de teclado panea el lienzo para mantenerse visible (PR-C2B — W-fix de a11y: overflow:hidden reemplaza el scroll nativo del navegador que el shell de PR-C1 obtenía gratis con overflow:auto)', () => {
    function mockHostRect(width: number, height: number): void {
      const hostEl = host().querySelector('.sol-flow-canvas') as HTMLElement;
      vi.spyOn(hostEl, 'getBoundingClientRect').mockReturnValue({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
    }

    function worldTransformValues(): { panX: number; panY: number; zoom: number } {
      const transform = (host().querySelector('.sol-flow-canvas__world') as HTMLElement).style.transform;
      const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/.exec(transform);
      if (!match) throw new Error(`transform inesperado: "${transform}"`);
      return { panX: Number.parseFloat(match[1]), panY: Number.parseFloat(match[2]), zoom: Number.parseFloat(match[3]) };
    }

    it('enfocar un nodo FUERA del viewport visible panea para revelarlo, sin tocar el zoom', () => {
      fixture.componentRef.setInput('nodes', [n({ id: 'a', position: { x: 0, y: 0 } }), n({ id: 'lejos', position: { x: 3000, y: 0 } })]);
      fixture.detectChanges();
      mockHostRect(400, 320);

      nodeSurface('lejos').dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      fixture.detectChanges();

      const values = worldTransformValues();
      expect(values.zoom).toBe(1);
      expect(values.panX).toBeLessThan(0); // paneó hacia la izquierda para traer x=3000 a la vista
    });

    it('enfocar un nodo YA visible (con margen de sobra a los 4 bordes) no cambia el pan', () => {
      // (100,100), NO (10,20) de twoNodes — a esa posición cae DENTRO del margen de 24px del borde
      // superior/izquierdo (ver el caso de límite ya cubierto en flow-canvas-viewport.spec.ts) y SÍ
      // dispararía un pequeño ajuste; acá se aísla el caso "sin ningún ajuste necesario".
      fixture.componentRef.setInput('nodes', [n({ id: 'a', position: { x: 100, y: 100 } })]);
      fixture.detectChanges();
      mockHostRect(800, 320);

      nodeSurface('a').dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      fixture.detectChanges();

      expect(worldTransformValues()).toEqual({ panX: 0, panY: 0, zoom: 1 });
    });

    it('el pointerdown sobre un nodo también dispara focus() (ya lo hacía el shell de PR-C1) — panea igual si el nodo arrancaba fuera de vista', () => {
      fixture.componentRef.setInput('nodes', [n({ id: 'a', position: { x: 0, y: 0 } }), n({ id: 'lejos', position: { x: 3000, y: 0 } })]);
      fixture.detectChanges();
      mockHostRect(400, 320);

      nodeSurface('lejos').dispatchEvent(pointerEvent('pointerdown', 100, 100));
      fixture.detectChanges();

      expect(worldTransformValues().panX).toBeLessThan(0);
    });

    it('[robustez] sin un tamaño medible del host (rect 0×0, p. ej. antes del primer layout real) no lanza y no cambia el pan', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();
      // sin mockHostRect(): jsdom devuelve un DOMRect 0×0 por defecto — mismo caso que "sin layout real todavía".

      expect(() => {
        nodeSurface('a').dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        fixture.detectChanges();
      }).not.toThrow();
      expect(worldTransformValues()).toEqual({ panX: 0, panY: 0, zoom: 1 });
    });
  });

  describe('aristas — curvas bezier (PR-C2B, reemplazan las líneas rectas del shell de PR-C1)', () => {
    it('cada edge visible se renderiza como <path> con un atributo `d` que empieza en el centro del nodo origen y termina en el centro del destino', () => {
      fixture.componentRef.setInput('nodes', twoNodes); // a:(10,20) b:(300,20) — tamaño asumido 180x56 -> centros (100,48) y (390,48)
      fixture.componentRef.setInput('edges', oneEdge);
      fixture.detectChanges();

      const path = host().querySelector('.sol-flow-canvas__edge-line') as SVGPathElement;
      expect(path.tagName.toLowerCase()).toBe('path');
      const d = path.getAttribute('d') ?? '';
      expect(d.startsWith('M 100,48 C ')).toBe(true);
      expect(d.trim().endsWith('390,48')).toBe(true);
    });

    it('el label de la arista se posiciona en el punto SOBRE la curva bezier (computeEdgeMidpoint), no en un punto medio arbitrario', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.componentRef.setInput('edges', oneEdge);
      fixture.detectChanges();

      const label = host().querySelector('.sol-flow-canvas__edge-label') as HTMLElement;
      const expected = computeEdgeMidpoint({ x: 100, y: 48 }, { x: 390, y: 48 });
      expect(Number.parseFloat(label.style.left)).toBeCloseTo(expected.x, 5);
      expect(Number.parseFloat(label.style.top)).toBeCloseTo(expected.y, 5);
    });
  });

  describe('resaltado de destinos válidos al conectar (PR-C2B — refinamiento visual del tap-para-conectar de PR-C1)', () => {
    const three: SolFlowCanvasNode[] = [
      n({ id: 'a', position: { x: 0, y: 0 } }),
      n({ id: 'b', position: { x: 200, y: 0 } }),
      n({ id: 'c', position: { x: 400, y: 0 } }),
    ];

    function connectHandle(id: string): HTMLButtonElement {
      return nodeEl(id).querySelector('.sol-flow-canvas__node-connect-handle') as HTMLButtonElement;
    }

    function hasValidClass(id: string): boolean {
      return nodeEl(id).classList.contains('sol-flow-canvas__node--connect-valid-target');
    }

    function hasInvalidClass(id: string): boolean {
      return nodeEl(id).classList.contains('sol-flow-canvas__node--connect-invalid-target');
    }

    it('al armar conectar desde "a" sin aristas previas, "b" y "c" quedan marcados como destino válido — "a" nunca es su propio destino', () => {
      fixture.componentRef.setInput('nodes', three);
      fixture.detectChanges();

      connectHandle('a').click();
      fixture.detectChanges();

      expect(hasValidClass('b')).toBe(true);
      expect(hasValidClass('c')).toBe(true);
      expect(hasValidClass('a')).toBe(false);
      expect(hasInvalidClass('a')).toBe(false); // el origen tiene su propio estilo (--connect-source), no el de "inválido"
    });

    it('un destino ya conectado (a->b existente) NO queda marcado como válido al re-armar desde "a" — evita duplicar la conexión', () => {
      fixture.componentRef.setInput('nodes', three);
      fixture.componentRef.setInput('edges', [e({ id: 'a->b', sourceId: 'a', targetId: 'b' })]);
      fixture.detectChanges();

      connectHandle('a').click();
      fixture.detectChanges();

      expect(hasValidClass('b')).toBe(false);
      expect(hasInvalidClass('b')).toBe(true);
      expect(hasValidClass('c')).toBe(true);
    });

    it('un destino que cerraría un ciclo (a->b->c, armar desde "c") NO queda marcado como válido', () => {
      fixture.componentRef.setInput('nodes', three);
      fixture.componentRef.setInput('edges', [
        e({ id: 'a->b', sourceId: 'a', targetId: 'b' }),
        e({ id: 'b->c', sourceId: 'b', targetId: 'c' }),
      ]);
      fixture.detectChanges();

      connectHandle('c').click();
      fixture.detectChanges();

      expect(hasValidClass('a')).toBe(false);
      expect(hasValidClass('b')).toBe(false);
      expect(hasInvalidClass('a')).toBe(true);
      expect(hasInvalidClass('b')).toBe(true);
    });

    it('el resaltado es un HINT visual — clickear un destino "inválido" (cerraría ciclo) SIGUE completando la conexión, la mecánica de la API no cambia', () => {
      fixture.componentRef.setInput('nodes', three);
      fixture.componentRef.setInput('edges', [e({ id: 'a->b', sourceId: 'a', targetId: 'b' })]);
      fixture.detectChanges();

      const created: SolFlowCanvasConnectionCreatedEvent[] = [];
      fixture.componentInstance.connectionCreated.subscribe((ev) => created.push(ev));

      connectHandle('c').click(); // arma desde 'c'; 'a' cerraría un ciclo (a->b->c->a) y por tanto NO es "válido"
      nodeSurface('a').click();

      expect(created).toEqual([{ sourceId: 'c', targetId: 'a' }]); // el validador real (entities/flow) decide la legalidad final, no este hint
    });

    it('el resaltado se retira al cancelar con Escape', () => {
      fixture.componentRef.setInput('nodes', three);
      fixture.detectChanges();

      connectHandle('a').click();
      fixture.detectChanges();
      expect(hasValidClass('b')).toBe(true);

      host().querySelector('.sol-flow-canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(hasValidClass('b')).toBe(false);
      expect(hasInvalidClass('b')).toBe(false);
    });
  });

  describe('curva fantasma al conectar (PR-C2B)', () => {
    it('al armar conectar y mover el puntero sobre el fondo, aparece un <path> fantasma que parte del centro del origen', () => {
      fixture.componentRef.setInput('nodes', twoNodes); // 'a' en (10,20) -> centro (100,48)
      fixture.detectChanges();

      const connectHandleA = nodeEl('a').querySelector('.sol-flow-canvas__node-connect-handle') as HTMLButtonElement;
      connectHandleA.click();
      fixture.detectChanges();
      expect(host().querySelector('.sol-flow-canvas__edge-ghost')).toBeNull(); // sin movimiento del puntero todavía

      (host().querySelector('.sol-flow-canvas') as HTMLElement).dispatchEvent(pointerEvent('pointermove', 500, 500));
      fixture.detectChanges();

      const ghost = host().querySelector('.sol-flow-canvas__edge-ghost') as SVGPathElement;
      expect(ghost).toBeTruthy();
      expect(ghost.getAttribute('d')?.startsWith('M 100,48 C ')).toBe(true);
    });

    it('la curva fantasma desaparece al completar la conexión', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();

      nodeEl('a').querySelector<HTMLButtonElement>('.sol-flow-canvas__node-connect-handle')!.click();
      (host().querySelector('.sol-flow-canvas') as HTMLElement).dispatchEvent(pointerEvent('pointermove', 500, 500));
      fixture.detectChanges();
      expect(host().querySelector('.sol-flow-canvas__edge-ghost')).toBeTruthy();

      nodeSurface('b').click();
      fixture.detectChanges();

      expect(host().querySelector('.sol-flow-canvas__edge-ghost')).toBeNull();
    });

    it('la curva fantasma desaparece al cancelar con Escape', () => {
      fixture.componentRef.setInput('nodes', twoNodes);
      fixture.detectChanges();

      nodeEl('a').querySelector<HTMLButtonElement>('.sol-flow-canvas__node-connect-handle')!.click();
      (host().querySelector('.sol-flow-canvas') as HTMLElement).dispatchEvent(pointerEvent('pointermove', 500, 500));
      fixture.detectChanges();
      expect(host().querySelector('.sol-flow-canvas__edge-ghost')).toBeTruthy();

      host().querySelector('.sol-flow-canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(host().querySelector('.sol-flow-canvas__edge-ghost')).toBeNull();
    });
  });
});

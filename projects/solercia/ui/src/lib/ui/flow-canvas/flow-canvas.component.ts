import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { computeValidConnectionTargets } from './flow-canvas-connect';
import { computeEdgeMidpoint, computeEdgePathD } from './flow-canvas-edge-geometry';
import { computeAutoLayoutPositions, countEdgeIds, countNodeIds, safeTrackKey } from './flow-canvas-layout';
import {
  DEFAULT_VIEWPORT,
  computePinchZoom,
  computeWheelZoom,
  distanceBetween,
  midpoint,
  panBy,
  panToRevealWorldRect,
  screenToWorld,
  type SolFlowCanvasViewport,
} from './flow-canvas-viewport';
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

/** Tamaño supuesto de un nodo para calcular el punto medio de las aristas (el motor no mide el DOM real). */
const NODE_WIDTH_PX = 180;
const NODE_HEIGHT_PX = 56;

/** Un gesto de pointerdown→pointerup con menos desplazamiento de PANTALLA que esto se trata como click, no como arrastre (mouse/pen: precisión motora alta). */
const DRAG_THRESHOLD_PX = 4;

/**
 * PR-C4 (GOAL §4, móvil) — hallazgo real del e2e móvil (`e2e/flows/
 * flows-mobile.spec.ts`): un TAP real de dedo (`pointerType: 'touch'`)
 * reporta varios px de "temblor" incluso inmóvil — el umbral de 4px
 * (afinado para mouse) clasificaba un tap normal como arrastre, y
 * `onNodeActivate` descartaba el click siguiente (`lastGestureWasDrag`),
 * dejando el nodo SIN abrir su editor. Slop más generoso, mismo orden de
 * magnitud que el "touch slop" estándar de las plataformas (Android
 * `ViewConfiguration.getScaledTouchSlop()` ~8dp, iOS ~10pt) — ver
 * {@link dragThresholdFor}.
 */
const DRAG_THRESHOLD_PX_TOUCH = 10;

/** Umbral clic-vs-arrastre según el tipo de puntero del evento — ver {@link DRAG_THRESHOLD_PX}/{@link DRAG_THRESHOLD_PX_TOUCH}. */
function dragThresholdFor(event: PointerEvent): number {
  return event.pointerType === 'touch' ? DRAG_THRESHOLD_PX_TOUCH : DRAG_THRESHOLD_PX;
}

/** Paso de cada nudge por teclado (paridad a11y del arrastre) — fijo en espacio CANVAS, independiente del zoom (ver docstring de {@link onNodeKeydown}). */
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
  /** Posición de PANTALLA (`event.clientX/Y` crudos) al arrancar — sirve EXCLUSIVAMENTE para el umbral clic-vs-arrastre (ver {@link onNodePointerUp}), SIEMPRE en pantalla, nunca en canvas. NUNCA se actualiza durante el drag (a diferencia de {@link lastPointer}) — el umbral mide el desplazamiento TOTAL desde el inicio. */
  startPointer: SolFlowCanvasPosition;
  /**
   * Posición de PANTALLA del `pointermove` MÁS RECIENTE — arranca igual a {@link startPointer} y se
   * actualiza en CADA `pointermove` (C1, 4R Ola 5 — fix del bug "zoom a mitad de drag corrompe la
   * posición"). Cada segmento consume el delta desde ESTE punto, nunca desde `startPointer`, así un
   * cambio de zoom a mitad de gesto (rueda/pinch de fondo concurrente) solo re-escala el segmento
   * SIGUIENTE, jamás el tramo ya recorrido — ver {@link onNodePointerMove}.
   */
  lastPointer: SolFlowCanvasPosition;
  /** Posición inicial del nodo en espacio CANVAS (world). */
  startPosition: SolFlowCanvasPosition;
  /** Posición vigente del nodo en espacio CANVAS (world) — acumulada SEGMENTO a SEGMENTO en cada `pointermove`, cada uno convertido con el zoom VIGENTE al momento de ESE segmento (nunca con el zoom final) — ver {@link onNodePointerMove}. */
  currentPosition: SolFlowCanvasPosition;
}

/** El origen (0,0) del lienzo es un límite real — un contenedor `overflow: auto` no tiene scroll negativo, así que ningún nodo debe commitear ni mostrarse en coordenadas negativas (W4, 4R Ola 5). */
function clampPosition(position: SolFlowCanvasPosition): SolFlowCanvasPosition {
  return { x: Math.max(0, position.x), y: Math.max(0, position.y) };
}

/**
 * `sol-flow-canvas` — contrato AGNÓSTICO del motor de un lienzo tipo n8n
 * (Ola 5, `openspec/GOAL-ola5-flow-canvas-y-cutover.md` §4).
 *
 * API PÚBLICA ESTABLE (inputs/outputs/`autoLayout()`/proyección de
 * template): esta clase NUNCA cambia su contrato público entre bake-offs —
 * solo el INTERIOR de la implementación difiere.
 *
 * **Esta es la implementación de PR-C2B** (motor nativo SVG + Pointer Events,
 * CDK evaluado y descartado — ver `Learned` del reporte de fase: ni
 * `DragDropModule` ni `ScrollingModule` aportan algo que Pointer Events +
 * `transform` no resuelvan mejor para un lienzo 2D con pan/zoom propio, y el
 * arrastre de nodos YA usaba Pointer Events nativos desde PR-C1 — "CDK
 * reservado a `ui/kanban/`"). Reemplaza el interior MÍNIMO del shell de
 * PR-C1 (render absoluto estático + líneas rectas, sin pan/zoom) por:
 *  - **Pan/zoom del lienzo**: arrastrar el FONDO panea; rueda/pinch de dos
 *    punteros hace zoom anclado al cursor/punto medio. Un único `transform:
 *    translate(pan) scale(zoom)` sobre `.sol-flow-canvas__world` (grupo
 *    interno que envuelve edges+nodos) — ver {@link worldTransform} y
 *    `flow-canvas-viewport.ts` (puro, sin Angular). El pan/zoom es una
 *    cuestión de VISTA, no de dominio — sigue activo en `readonly` (a
 *    diferencia de arrastrar/conectar/quitar, que sí quedan bloqueados).
 *    `overflow: hidden` (necesario para que rueda/pinch no peleen con el
 *    scroll nativo) reemplaza el "scroll into view" gratis que traía
 *    `overflow: auto` del shell de PR-C1 — {@link onNodeFocus} lo restituye
 *    paneando (nunca zoom) hacia cualquier nodo que reciba foco (Tab) fuera
 *    del área visible. La rueda/el pinch corren de forma INDEPENDIENTE de un
 *    arrastre de nodo en curso — a propósito (C1, 4R Ola 5): ver el JSDoc de
 *    {@link onNodePointerMove} para el porqué y el fix del bug asociado.
 *  - **Aristas bezier**: curvas cúbicas con dirección horizontal (favorecen
 *    el layout BFS-por-columnas de `flow-canvas-layout.ts`) en vez de líneas
 *    rectas — ver `flow-canvas-edge-geometry.ts` (puro). El label de cada
 *    arista se posiciona sobre el punto real de la curva (t=0.5), no sobre
 *    el punto medio de una recta.
 *  - **Tap-para-conectar refinado**: la MECÁNICA sigue siendo la de PR-C1
 *    (arma origen → activa destino, API de eventos sin cambios) — el
 *    refinamiento es puramente VISUAL: mientras está armado, los destinos
 *    VÁLIDOS (sin auto-loop, sin duplicar una conexión existente, sin cerrar
 *    un ciclo — ver `flow-canvas-connect.ts`, puro) se resaltan y una curva
 *    FANTASMA sigue al cursor desde el nodo origen. Es un HINT visual, NUNCA
 *    bloquea la conexión — el validador real de dominio (`entities/flow`,
 *    fuera de esta librería agnóstica) sigue siendo la fuente de verdad.
 *
 * **PR-C4 (GOAL §4, móvil) — 3 hallazgos de auditoría + 2 adiciones**:
 *  1. **Pointer Events unificados**: auditado — CERO `mouse*`/`touch*` en
 *     este componente (ni en `flow-canvas-viewport.ts`/`-connect.ts`/
 *     `-edge-geometry.ts`/`-layout.ts`, ni en los widgets/página consumidores
 *     de PR-C3) — el motor YA es 100% Pointer Events desde el bake-off
 *     (C2B). Nada que unificar.
 *  2. **Targets ≥44px con hit-area invisible**: `.sol-flow-canvas__node-
 *     connect-handle` (28px→44×44 real, `align-self:center` para no
 *     estirarse con node-surface), `.sol-flow-canvas__node-surface`
 *     (min-height:44px) y `.sol-flow-canvas__edge-remove` (padding real +
 *     margin negativo IGUAL Y OPUESTO — el hijo sigue "pesando" lo mismo
 *     dentro del flex de la píldora, así que ésta no se agranda visualmente)
 *     — los 3 alcanzan ≥44px reales (verificable con `getBoundingClientRect`/
 *     Playwright `boundingBox()`, ver `e2e/flows/flows-mobile.spec.ts`).
 *  3. **Resaltado "solo válidos"**: auditado — el hint YA distingue
 *     `--connect-valid-target` (resalta, borde+glow verde) de
 *     `--connect-invalid-target` (SOLO atenúa, `opacity:0.45`, sin color
 *     propio) desde PR-C2B/C3 — ya cumple el texto literal del GOAL
 *     ("resaltan SOLO destinos válidos"). Sin cambio de CSS/lógica; el
 *     aria-live del conteo (PR-C3) se conserva sin tocar.
 *  4. **Auto-layout siempre visible en móvil**: botón flotante nuevo
 *     (`.sol-flow-canvas__auto-layout`, oculto en desktop vía
 *     `@media (max-width:767px)`) que invoca `autoLayout()` — ver
 *     {@link onAutoLayoutClick}.
 *  5. **Bottom sheet móvil**: vive en `sol-drawer` (variant `sheet`, nueva),
 *     NO en este componente — `flow-node-editor-drawer` (boki-front) es
 *     quien la activa.
 *
 * Interacciones (documentadas porque el GESTO concreto es decisión de cada
 * motor del bake-off — la suite de aceptación compartida prueba la API, no
 * el gesto):
 *  - **Selección**: cada nodo es un `<button>` real — click nativo, y
 *    Enter/Espacio manejados de forma EXPLÍCITA en `onNodeKeydown` (W6, 4R
 *    Ola 5: NO se delega en la activación nativa del navegador sobre el
 *    botón). Ambos caminos emiten `nodeSelected` de la MISMA forma.
 *  - **Mover un nodo (mouse)**: `pointerdown`→`pointermove`→`pointerup`
 *    sobre el nodo. El umbral clic-vs-arrastre ({@link DRAG_THRESHOLD_PX}) se
 *    mide en PANTALLA (PR-C2B: precisión motora humana, zoom-invariante — NO
 *    en espacio canvas, que sería más permisivo alejado y más estricto
 *    acercado). Un `pointerdown` sobre un nodo NUNCA burbujea a convertirse
 *    además en un pan de fondo (`stopPropagation` explícito). El delta de
 *    pantalla→canvas se acumula por SEGMENTO con el zoom vigente de cada
 *    `pointermove` (C1, 4R Ola 5) — un cambio de zoom a mitad de gesto (rueda
 *    del mouse sostenido, o pinch de fondo concurrente) nunca corrompe el
 *    tramo ya recorrido, ver {@link onNodePointerMove}.
 *  - **Mover un nodo (teclado)**: flechas sobre el nodo enfocado — nudge de
 *    {@link KEYBOARD_NUDGE_STEP_PX}px FIJOS en espacio canvas (el zoom NUNCA
 *    afecta el paso — a11y: la navegación por teclado es predecible sin
 *    importar cuánto esté acercado el lienzo).
 *  - **Crear conexión**: cada nodo tiene un botón "conectar desde" — al
 *    activarlo arma el origen; activar OTRO nodo completa la conexión
 *    (`connectionCreated`). Activar el MISMO nodo, o `Escape`, cancela el
 *    modo.
 *  - **Quitar conexión**: botón "×" sobre la etiqueta de cada arista.
 *  - **`readonly`**: oculta/deshabilita TODA mutación del GRAFO (arrastre,
 *    nudge, conectar, quitar) — la selección y el pan/zoom siguen activos
 *    (no son mutaciones del grafo).
 *
 * Espejo interno (`mirroredNodes`, mismo patrón que `sol-kanban-board`):
 * mantiene una copia propia de `nodes()`, re-sembrada en cada cambio del
 * input, mutada LOCALMENTE en cada interacción (feedback visual inmediato)
 * y SIEMPRE acompañada del output correspondiente para que el consumidor
 * persista.
 */
@Component({
  selector: 'sol-flow-canvas',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #canvasHost
      class="sol-flow-canvas"
      role="application"
      [attr.aria-label]="regionLabel()"
      (keydown.escape)="cancelConnect()"
      (pointerdown)="onCanvasPointerDown($event)"
      (pointermove)="onCanvasPointerMove($event)"
      (pointerup)="onCanvasPointerUp($event)"
      (pointercancel)="onCanvasPointerCancel($event)"
      (lostpointercapture)="onCanvasPointerCancel($event)"
      (wheel)="onCanvasWheel($event)"
    >
      <div class="sol-flow-canvas__world" [style.transform]="worldTransform()">
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
            <path
              class="sol-flow-canvas__edge-line"
              [attr.d]="edgePathD(edge)"
              [attr.marker-end]="'url(#' + markerId + ')'"
            />
          }
          @if (ghostEdgePathD(); as ghostD) {
            <path class="sol-flow-canvas__edge-ghost" [attr.d]="ghostD" [attr.marker-end]="'url(#' + markerId + ')'" />
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
            [class.sol-flow-canvas__node--connect-valid-target]="isValidConnectTarget(node)"
            [class.sol-flow-canvas__node--connect-invalid-target]="isInvalidConnectTarget(node)"
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
              (focus)="onNodeFocus(node)"
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
      </div>

      @if (!isReadonly()) {
        <button
          type="button"
          class="sol-flow-canvas__auto-layout"
          data-testid="flow-canvas-auto-layout"
          [attr.aria-label]="autoLayoutButtonAriaLabel()"
          (click)="onAutoLayoutClick()"
        >
          {{ autoLayoutButtonLabel() }}
        </button>
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
      overflow: hidden;
      background: var(--sol-bg-sunken, var(--sol-bg-page, #f8fafc));
      border-radius: var(--sol-border-radius-lg, 12px);
      /* PR-C2B: pan (arrastre) y pinch-zoom propios vía Pointer Events — el navegador NUNCA debe
         interceptarlos como scroll/zoom nativo de la página. */
      touch-action: none;
    }

    .sol-flow-canvas__world {
      position: absolute;
      inset: 0;
      transform-origin: 0 0;
      will-change: transform;
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

    .sol-flow-canvas__edge-ghost {
      stroke: var(--sol-color-info, #3b82f6);
      stroke-width: 2;
      stroke-dasharray: 6 4;
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
      /* PR-C4 (GOAL §4, hit-area invisible ≥44px): padding real agranda el
         botón a 44x44 (medible con getBoundingClientRect) — un margin
         negativo IGUAL Y OPUESTO en cada lado devuelve el tamaño que la
         píldora edge-label (flex) ve de este hijo a los 13x13px de siempre
         (2+9+2 ancho, 0+13+0 alto), así que la píldora NO se agranda
         visualmente. Sesgado a propósito: el padding izquierdo NO crece
         (margin-left: 0) para no comerse el gap de 4px hacia el texto
         vecino — casi todo el crecimiento va arriba/abajo/derecha (espacio
         libre del lienzo). Evidencia e2e en flows-mobile.spec.ts
         (boundingBox mayor o igual a 44x44) — jsdom no calcula layout real,
         este cálculo no es verificable en Vitest. */
      /* Márgen de seguridad sobre el mínimo de 44px — medido real (evidencia
         e2e, boundingBox): el glyph "×" a font-size 13px mide ~7px de ancho
         x ~12px de alto (no ~9x13 como se estimó al calcular por primera
         vez) — padding ajustado con +2-3px de colchón en cada dimensión. */
      padding: 18px 37px 18px 2px;
      margin: -18px -35px -18px 0;
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
      /* PR-C4 (GOAL §4, ≥44px hit-area): un nodo con solo el label por
         defecto (sin nodeTemplate) medía ~33-40px de alto — min-height
         garantiza el piso real de 44px (medible con getBoundingClientRect);
         display:flex centra el contenido (una línea o el template completo
         de varias líneas del consumidor) dentro del alto garantizado, sin
         inflar el diseño visual (mismo padding/borde/tipografía de siempre). */
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 44px;
      text-align: left;
      padding: 10px 12px;
      background: var(--sol-bg-surface, #fff);
      border: 2px solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-lg, 10px);
      box-shadow: var(--sol-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.06));
      cursor: grab;
      font-family: var(--sol-font-family);
      color: var(--sol-color-text-primary);
      transition: opacity 0.15s ease;
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

    .sol-flow-canvas__node--connect-valid-target .sol-flow-canvas__node-surface {
      border-style: dashed;
      border-color: var(--sol-color-success, #10b981);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sol-color-success, #10b981) 25%, transparent);
    }

    .sol-flow-canvas__node--connect-invalid-target .sol-flow-canvas__node-surface {
      opacity: 0.45;
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
      /* PR-C4 (GOAL §4, ≥44px hit-area): ya NO se estira a la altura de
         node-surface (align-self:center en vez del stretch heredado del
         row) — reserva su PROPIO piso de ≥44×44px real (medible con
         getBoundingClientRect), independiente del alto del nodo. El glyph
         "⇢" queda centrado dentro. */
      align-self: center;
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
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

    /* PR-C4 (GOAL §4 punto 5, auto-layout siempre visible en móvil): toolbar
       flotante de una sola acción, fija sobre el lienzo (fuera del grupo
       .sol-flow-canvas__world, así que NUNCA panea/zoomea con el contenido).
       Oculto en desktop a propósito — el mandato lo pide en móvil; en
       escritorio el drag con mouse ya es preciso y no faltaba una acción
       equivalente antes de PR-C4. Tamaño real (min 44px), nunca un
       pseudo-elemento — visible mientras el lienzo sea editable (oculto solo
       en modo readonly, ver el condicional del template). */
    .sol-flow-canvas__auto-layout {
      display: none;
      position: absolute;
      right: 12px;
      bottom: 12px;
      z-index: 4;
      min-width: 44px;
      min-height: 44px;
      padding: 0 16px;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-full, 999px);
      background: var(--sol-bg-surface, #fff);
      color: var(--sol-color-text-primary);
      font-family: var(--sol-font-family);
      font-size: var(--sol-font-size-sm, 13px);
      font-weight: 600;
      box-shadow: var(--sol-shadow-md, 0 4px 12px rgba(0, 0, 0, 0.12));
      cursor: pointer;
    }

    .sol-flow-canvas__auto-layout:focus-visible {
      outline: 2px solid var(--sol-color-primary, #2563eb);
      outline-offset: 2px;
    }

    @media (max-width: 767px) {
      .sol-flow-canvas__auto-layout {
        display: inline-flex;
      }
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
   * reservada como MODIFICADOR de miembro de clase.
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

  /** Estado del viewport (pan/zoom) — PR-C2B. Es una cuestión de VISTA: nunca se bloquea en `readonly` ni se resetea cuando cambian `nodes()`/`edges()`. */
  protected readonly viewport = signal<SolFlowCanvasViewport>(DEFAULT_VIEWPORT);
  /** Posición (espacio world) del puntero mientras hay una conexión armada — alimenta la curva fantasma. `null` = sin curva que dibujar. */
  protected readonly ghostPointerWorld = signal<SolFlowCanvasPosition | null>(null);

  /** Referencia al host `.sol-flow-canvas` — solo para medir su tamaño real (`getBoundingClientRect()`) en {@link onNodeFocus}/{@link canvasRelativePoint}, nunca para mutar el DOM a mano. */
  private readonly canvasHostRef = viewChild.required<ElementRef<HTMLElement>>('canvasHost');

  private dragState: DragState | null = null;
  private lastGestureWasDrag = false;
  /** Punteros activos que arrancaron sobre el FONDO (nunca sobre un nodo — ver `stopPropagation` en {@link onNodePointerDown}) — 1 puntero = pan, 2 = pinch. */
  private readonly backgroundPointers = new Map<number, SolFlowCanvasPosition>();

  private readonly nodesById = computed(() => new Map(this.mirroredNodes().map((node) => [node.id, node])));

  protected readonly visibleEdges = computed(() => {
    const byId = this.nodesById();
    return (this.edges() ?? []).filter(
      (edge): edge is SolFlowCanvasEdge => !!edge && byId.has(edge.sourceId) && byId.has(edge.targetId),
    );
  });

  /** Destinos válidos del origen armado (sin auto-loop, sin duplicar, sin cerrar un ciclo — ver `flow-canvas-connect.ts`). Set vacío sin conexión armada. */
  protected readonly validConnectTargetIds = computed(() => {
    const sourceId = this.connectSourceId();
    if (sourceId === null) return new Set<string>();
    return computeValidConnectionTargets(this.mirroredNodes(), this.visibleEdges(), sourceId);
  });

  /** `translate(pan) scale(zoom)` — mismo criterio que `flow-canvas-viewport.ts::worldToScreen` (world se escala primero, se traslada después). */
  protected readonly worldTransform = computed(() => {
    const vp = this.viewport();
    return `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})`;
  });

  private readonly nodeIdFrequency = computed(() => countNodeIds(this.mirroredNodes()));
  private readonly edgeIdFrequency = computed(() => countEdgeIds(this.visibleEdges()));

  constructor() {
    effect(() => {
      const incoming = (this.nodes() ?? []).filter((node): node is SolFlowCanvasNode => !!node);
      this.mirroredNodes.set(incoming);
    });

    // W1+W2 (4R Ola 5, heredado de PR-C1): un flip de `readonly` a mitad de gesto cancela CUALQUIER
    // mutación en curso — revierte el drag SIN emitir y desarma "conectar" (curva fantasma incluida,
    // PR-C2B). El pan/zoom NUNCA se toca acá — no es una mutación del grafo (ver docstring de la clase).
    effect(() => {
      if (!this.isReadonly()) return;
      const hadActiveGesture = this.dragState !== null || untracked(() => this.connectSourceId()) !== null;
      this.dragState = null;
      this.disarmConnect();
      if (hadActiveGesture) this.announce('shared.flowCanvas.moveCancelledAnnouncement');
    });
  }

  trackNode(node: SolFlowCanvasNode, index: number): unknown {
    return safeTrackKey(node?.id, index, this.nodeIdFrequency());
  }

  /** Fallback anti-NG0955 para edges — mismo patrón que {@link trackNode}. */
  trackEdge(edge: SolFlowCanvasEdge, index: number): unknown {
    return safeTrackKey(edge?.id, index, this.edgeIdFrequency());
  }

  protected isSelected(node: SolFlowCanvasNode): boolean {
    return this.selectedId() === node.id;
  }

  protected isHighlighted(node: SolFlowCanvasNode): boolean {
    return this.highlightedNodeId() === node.id;
  }

  protected isValidConnectTarget(node: SolFlowCanvasNode): boolean {
    return this.connectSourceId() !== null && this.validConnectTargetIds().has(node.id);
  }

  /** El origen armado NUNCA es "inválido" (ya tiene su propio estilo vía `--connect-source`) — solo los DEMÁS nodos no-válidos se atenúan. */
  protected isInvalidConnectTarget(node: SolFlowCanvasNode): boolean {
    const sourceId = this.connectSourceId();
    if (sourceId === null || sourceId === node.id) return false;
    return !this.validConnectTargetIds().has(node.id);
  }

  private hasValidPosition(node: SolFlowCanvasNode): boolean {
    const position = node?.position;
    return !!position && Number.isFinite(position.x) && Number.isFinite(position.y);
  }

  protected resolvedPosition(node: SolFlowCanvasNode): SolFlowCanvasPosition {
    // W4 (4R Ola 5): clamp en el PUNTO DE LECTURA — mantiene `dragState.currentPosition` sin transformar.
    if (this.dragState && this.dragState.nodeId === node.id) return clampPosition(this.dragState.currentPosition);
    if (this.hasValidPosition(node)) return clampPosition(node.position);
    return { x: 0, y: 0 };
  }

  private nodeCenter(node: SolFlowCanvasNode): SolFlowCanvasPosition {
    const position = this.resolvedPosition(node);
    return { x: position.x + NODE_WIDTH_PX / 2, y: position.y + NODE_HEIGHT_PX / 2 };
  }

  /** Atributo `d` de la curva bezier de una arista — ver `flow-canvas-edge-geometry.ts` (puro). Extremos ausentes → sin curva (mismo criterio de robustez que `visibleEdges()`, defensivo aunque `visibleEdges()` ya filtra). */
  protected edgePathD(edge: SolFlowCanvasEdge): string {
    const byId = this.nodesById();
    const source = byId.get(edge.sourceId);
    const target = byId.get(edge.targetId);
    if (!source || !target) return '';
    return computeEdgePathD(this.nodeCenter(source), this.nodeCenter(target));
  }

  /** Punto SOBRE la curva bezier (t=0.5) para el label de la arista — reemplaza el punto medio de la recta del shell de PR-C1. */
  protected edgeMidpoint(edge: SolFlowCanvasEdge): SolFlowCanvasPosition {
    const byId = this.nodesById();
    const source = byId.get(edge.sourceId);
    const target = byId.get(edge.targetId);
    if (!source || !target) return { x: 0, y: 0 };
    return computeEdgeMidpoint(this.nodeCenter(source), this.nodeCenter(target));
  }

  /** Curva fantasma (origen armado → cursor) mientras hay una conexión en curso — `null` esconde el `@if` del template. */
  protected ghostEdgePathD(): string | null {
    const sourceId = this.connectSourceId();
    const pointerWorld = this.ghostPointerWorld();
    if (sourceId === null || pointerWorld === null) return null;
    const source = this.nodesById().get(sourceId);
    if (!source) return null;
    return computeEdgePathD(this.nodeCenter(source), pointerWorld);
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

  protected autoLayoutButtonLabel(): string {
    this.i18n.activeLang();
    return this.i18n.translate('shared.flowCanvas.autoLayoutButton');
  }

  protected autoLayoutButtonAriaLabel(): string {
    this.i18n.activeLang();
    return this.i18n.translate('shared.flowCanvas.autoLayoutButtonAriaLabel');
  }

  // --- selección / conectar ---

  protected onNodeActivate(node: SolFlowCanvasNode): void {
    if (this.lastGestureWasDrag) {
      this.lastGestureWasDrag = false;
      return;
    }

    const source = this.connectSourceId();
    if (source !== null) {
      this.disarmConnect();
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

  /**
   * PR-C3 (GOAL §4, "señal accesible del hint de destinos válidos"): el
   * anuncio `aria-live` incluye la CANTIDAD de destinos válidos junto con el
   * origen — sin esto, el resaltado visual (`--connect-valid-target`/
   * `--connect-invalid-target`) es invisible para un lector de pantalla
   * (deuda documentada en `EVALUACION-MOTORES.md`: "gap de a11y del hint,
   * documentado, no silencioso"). `validConnectTargetIds()` se lee DESPUÉS
   * de fijar `connectSourceId` — los signals de Angular se recalculan de
   * forma síncrona a la lectura, no hace falta esperar un tick.
   */
  protected onStartConnect(node: SolFlowCanvasNode, event: Event): void {
    event.stopPropagation();
    if (this.isReadonly()) return;
    this.connectSourceId.set(node.id);
    const validTargetCount = this.validConnectTargetIds().size;
    this.announce('shared.flowCanvas.connectArmedAnnouncement', { label: node.label, count: validTargetCount });
  }

  protected cancelConnect(): void {
    this.disarmConnect();
  }

  /** Desarma "conectar" (cancelar/completar/flip a readonly) — SIEMPRE limpia también la curva fantasma, mismo criterio en los 3 casos (PR-C2B). */
  private disarmConnect(): void {
    this.connectSourceId.set(null);
    this.ghostPointerWorld.set(null);
  }

  protected onRemoveConnection(edge: SolFlowCanvasEdge): void {
    if (this.isReadonly()) return;
    this.connectionRemoved.emit({ id: edge.id });
    this.announce('shared.flowCanvas.connectionRemovedAnnouncement');
  }

  // --- arrastre por mouse (pointer events nativos — CDK evaluado y descartado, ver docstring de la clase) ---

  protected onNodePointerDown(node: SolFlowCanvasNode, event: PointerEvent): void {
    // PR-C2B: un pointerdown sobre un nodo NUNCA debe además arrancar un pan de fondo — incondicional,
    // incluso si el resto del método corta abajo por readonly/drag-ya-activo (mismo comportamiento sea
    // cual sea el modo, en vez de que readonly "degrade" sorpresivamente el gesto a un pan).
    event.stopPropagation();
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
      lastPointer: { x: event.clientX, y: event.clientY },
      startPosition: start,
      currentPosition: start,
    };
  }

  /**
   * C1 (4R Ola 5) — fix del bug "zoom a mitad de drag corrompe la posición": acumula el delta de
   * PANTALLA por SEGMENTO (desde {@link DragState.lastPointer}, nunca desde `startPointer`) y lo
   * convierte con el zoom VIGENTE en CADA `pointermove` — nunca con el zoom final. Es matemáticamente
   * correcto bajo CUALQUIER secuencia de zooms durante el drag: si el zoom cambia a mitad de gesto
   * (rueda del mouse con el puntero sostenido, o pinch de fondo concurrente — {@link onCanvasWheel} y
   * `applyPinchMove` NUNCA consultan `dragState`, a propósito), el segmento YA acumulado con el zoom
   * viejo queda intacto; solo el segmento SIGUIENTE usa el zoom nuevo.
   *
   * Alternativa descartada — "zoom exclusivo del gesto" (bloquear wheel/pinch mientras `dragState !=
   * null`): más simple de implementar, pero degrada la UX — un usuario que sostiene un nodo y gira la
   * rueda (trackpad, gesto accidental o intencional) esperaría que el zoom siga respondiendo, igual que
   * en Figma/n8n. La solución incremental preserva esa expectativa sin sacrificar corrección, al costo
   * de un campo extra (`lastPointer`) en `DragState`.
   *
   * (Bug pre-fix: `dx = (event.clientX - state.startPointer.x) / zoomVigente` dividía el delta TOTAL de
   * pantalla desde el INICIO del drag por el zoom ACTUAL — si el zoom cambiaba a mitad de gesto, el
   * tramo ya recorrido bajo el zoom viejo se re-escalaba retroactivamente y el nodo "saltaba" visualmente
   * al soltar/commitear. Ver el test "zoom a mitad de drag" en flow-canvas.component.spec.ts, que
   * documenta el valor corrupto exacto que producía el código anterior.)
   */
  protected onNodePointerMove(node: SolFlowCanvasNode, event: PointerEvent): void {
    const state = this.dragState;
    // C1: solo el puntero DUEÑO del drag, sobre SU nodo, puede mutar dragState — un puntero/nodo ajeno no hace nada.
    if (!state || state.pointerId !== event.pointerId || state.nodeId !== node.id) return;
    if (this.isReadonly()) return; // W1+W2: ventana síncrona previa a que el effect del constructor revierta

    // PR-C2B: conversión de coordenadas pantalla→canvas — un delta de PANTALLA (`clientX/Y`) representa
    // menos distancia real en el canvas cuanto más acercado está el zoom (a 2x, 40px de pantalla = 20px
    // de canvas). Dividir por `zoom` es la operación inversa exacta del `scale(zoom)` del transform del
    // mundo — ver `screenToWorld`/`worldToScreen` en flow-canvas-viewport.ts.
    const zoom = this.viewport().zoom;
    const currentPointer: SolFlowCanvasPosition = { x: event.clientX, y: event.clientY };
    const dx = (currentPointer.x - state.lastPointer.x) / zoom;
    const dy = (currentPointer.y - state.lastPointer.y) / zoom;
    this.dragState = {
      ...state,
      lastPointer: currentPointer,
      currentPosition: { x: state.currentPosition.x + dx, y: state.currentPosition.y + dy },
    };
  }

  protected onNodePointerUp(node: SolFlowCanvasNode, event: PointerEvent): void {
    const state = this.dragState;
    // C1: el up de un puntero/nodo AJENO nunca toca el drag activo (ni lo limpia ni lo commitea).
    if (!state || state.pointerId !== event.pointerId || state.nodeId !== node.id) return;
    this.dragState = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (this.isReadonly()) return; // W1+W2: ventana síncrona previa a que el effect del constructor revierta — no commitea

    // PR-C2B: el umbral clic-vs-arrastre se mide en PANTALLA (`event.clientX/Y` crudos contra
    // `state.startPointer`, ambos en espacio pantalla), NUNCA en espacio canvas — es una cuestión de
    // precisión motora HUMANA (cuánto tiembla un dedo/mouse en píxeles de pantalla), zoom-invariante por
    // definición. Medirlo en canvas haría el umbral más permisivo alejado (jitter mínimo ya cruzaría 4px
    // de canvas) y más estricto acercado — ambos efectos indeseados que esta medición evita por completo.
    const screenDistance = Math.hypot(event.clientX - state.startPointer.x, event.clientY - state.startPointer.y);
    if (screenDistance < dragThresholdFor(event)) return; // sin desplazamiento real: el click nativo que sigue resuelve selección/conexión (PR-C4: umbral touch-aware, ver dragThresholdFor)

    this.lastGestureWasDrag = true;
    this.commitNodePosition(node, state.currentPosition); // commitNodePosition clampea a coordenadas no negativas (W4)
  }

  /**
   * `pointercancel`/`lostpointercapture` (W3+W5, 4R Ola 5) — SIEMPRE revierte, NUNCA commitea.
   */
  protected onNodePointerCancel(node: SolFlowCanvasNode, event: PointerEvent): void {
    const state = this.dragState;
    if (!state || state.pointerId !== event.pointerId || state.nodeId !== node.id) return; // C1: puntero/nodo ajeno, no toca el drag activo
    this.dragState = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.announce('shared.flowCanvas.moveCancelledAnnouncement');
  }

  // --- nudge por teclado (paridad a11y) ---

  /**
   * El paso ({@link KEYBOARD_NUDGE_STEP_PX}) es SIEMPRE canvas-space, nunca se escala por zoom (PR-C2B,
   * a11y): la navegación por teclado representa "cuánto se movió el DATO", igual que el nudge del mouse
   * commitea en canvas-space — el zoom es puramente una cuestión de VISTA y no debe alterar cuánto se
   * mueve un nodo por cada pulsación de flecha (impredecible para un usuario de teclado si dependiera del
   * zoom vigente).
   */
  protected onNodeKeydown(node: SolFlowCanvasNode, event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
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

  /**
   * `(focus)` de un nodo (Tab, o `target.focus()` explícito en
   * {@link onNodePointerDown}) — panea el lienzo lo justo para que el nodo
   * recién enfocado quede visible, NUNCA cambia el zoom (ver
   * {@link panToRevealWorldRect}, puro).
   *
   * Motivación (PR-C2B, W-fix de a11y): el shell de PR-C1 usaba
   * `overflow: auto` — el navegador hacía "scroll into view" GRATIS cuando el
   * foco (Tab) llegaba a un nodo fuera del área visible. Este motor reemplaza
   * ese scroll nativo por `overflow: hidden` + `transform` (pan/zoom propio,
   * necesario para que la rueda/pinch funcionen sin pelear con el scroll del
   * navegador) — sin este método, Tab movería el foco LÓGICO sin revelarlo
   * VISUALMENTE, una regresión real de accesibilidad que este PR introduciría
   * en silencio si no se corrigiera acá.
   */
  protected onNodeFocus(node: SolFlowCanvasNode): void {
    const hostEl = this.canvasHostRef().nativeElement;
    const rect = hostEl.getBoundingClientRect();
    const position = this.resolvedPosition(node);
    const worldRect = { x: position.x, y: position.y, width: NODE_WIDTH_PX, height: NODE_HEIGHT_PX };
    this.viewport.update((vp) => panToRevealWorldRect(vp, worldRect, { width: rect.width, height: rect.height }));
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

  // --- pan/zoom del lienzo (PR-C2B — ver flow-canvas-viewport.ts, puro) ---

  /*
   * W1 (4R Ola 5, deuda DOCUMENTADA — NO implementada en este ciclo; el refactor de gestos ya está
   * agendado para PR-C3, cuando este componente (904L, 5 responsabilidades) se divida): los handlers de
   * ESTA sección ({@link onCanvasPointerMove}, {@link onCanvasWheel}, {@link applyPinchMove}) son de alta
   * frecuencia — un `pointermove`/`wheel` de usuario puede disparar decenas por segundo — y cada uno
   * escribe el signal `viewport`/`ghostPointerWorld` SIN agrupar (batch) los eventos del mismo frame.
   * Candidato a coalescing con `requestAnimationFrame` en ese refactor. Línea base medida hoy (smoke
   * sobre jsdom, NO paint/compositing real de navegador): ~5.3ms/100 eventos de pan sostenido sobre 60
   * nodos — ver el test "línea base — 100 pointermove..." en flow-canvas.component.spec.ts.
   */

  /**
   * Arranca el seguimiento de un puntero de FONDO — nunca se dispara para un puntero que arrancó sobre un
   * nodo (`stopPropagation` en {@link onNodePointerDown}) ni sobre el botón "conectar desde"/"×" (sin
   * listener de pointerdown propio, así que si el `pointerup` llega casi de inmediato el pan resultante es
   * ~(0,0), inofensivo — el `click` que resuelve esos botones es un evento aparte, no lo interfiere esto).
   */
  protected onCanvasPointerDown(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    this.backgroundPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  protected onCanvasPointerMove(event: PointerEvent): void {
    const current: SolFlowCanvasPosition = { x: event.clientX, y: event.clientY };

    if (this.backgroundPointers.has(event.pointerId)) {
      if (this.backgroundPointers.size >= 2) {
        this.applyPinchMove(event.pointerId, current, event);
      } else {
        const previous = this.backgroundPointers.get(event.pointerId) as SolFlowCanvasPosition;
        this.backgroundPointers.set(event.pointerId, current);
        const delta = { x: current.x - previous.x, y: current.y - previous.y };
        this.viewport.update((vp) => panBy(vp, delta));
      }
    }

    // Curva fantasma: sigue al puntero mientras haya una conexión armada, sin importar si ESTE puntero
    // también está paneando/pinchando (solapamiento raro en uso real — inofensivo dejarlo actualizar igual).
    if (this.connectSourceId() !== null) {
      this.ghostPointerWorld.set(screenToWorld(this.viewport(), this.canvasRelativePoint(current, event)));
    }
  }

  protected onCanvasPointerUp(event: PointerEvent): void {
    this.backgroundPointers.delete(event.pointerId);
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  protected onCanvasPointerCancel(event: PointerEvent): void {
    this.backgroundPointers.delete(event.pointerId);
  }

  /**
   * Corre de forma INDEPENDIENTE de {@link dragState} — a propósito (C1, 4R Ola 5): el zoom sigue
   * respondiendo aunque haya un nodo siendo arrastrado. {@link onNodePointerMove} acumula su delta POR
   * SEGMENTO con el zoom vigente en cada momento, así que un cambio de zoom a mitad de gesto nunca
   * corrompe la posición ya recorrida — ver su JSDoc para el fix completo.
   */
  protected onCanvasWheel(event: WheelEvent): void {
    event.preventDefault(); // repropone la rueda como zoom del lienzo — nunca debe además hacer scroll de la página
    const anchor = this.canvasRelativePoint({ x: event.clientX, y: event.clientY }, event);
    this.viewport.update((vp) => computeWheelZoom(vp, event.deltaY, anchor));
  }

  /**
   * Segundo puntero de fondo activo → pinch. La distancia PREVIA se lee ANTES de sobrescribir la posición
   * de `pointerId` en el mapa (si no, "previa" y "actual" serían el mismo valor) — la razón entre ambas
   * distancias es el factor de zoom INCREMENTAL de este solo `pointermove` (se compone con el siguiente
   * `pointermove` del otro puntero, no hace falta recordar la distancia "inicial" del pinch completo).
   *
   * Corre de forma INDEPENDIENTE de {@link dragState} — a propósito (C1, 4R Ola 5, mismo criterio que
   * {@link onCanvasWheel}): un pinch de fondo (dos punteros AJENOS al que arrastra un nodo) sigue
   * zoomeando sin corromper el drag activo — ver el JSDoc de {@link onNodePointerMove}.
   */
  private applyPinchMove(pointerId: number, current: SolFlowCanvasPosition, event: Event): void {
    const otherEntry = [...this.backgroundPointers.entries()].find(([id]) => id !== pointerId);
    if (!otherEntry) return; // defensivo — no debería ocurrir con size>=2, pero nunca lanzar por esto
    const [, otherPosition] = otherEntry;
    const previousPosition = this.backgroundPointers.get(pointerId) as SolFlowCanvasPosition;

    const previousDistance = distanceBetween(previousPosition, otherPosition);
    const currentDistance = distanceBetween(current, otherPosition);
    const anchor = this.canvasRelativePoint(midpoint(current, otherPosition), event);

    this.backgroundPointers.set(pointerId, current);
    this.viewport.update((vp) => computePinchZoom(vp, previousDistance, currentDistance, anchor));
  }

  /** `clientX/Y` (pantalla del navegador) → "screen" relativo al host `.sol-flow-canvas` (resta `getBoundingClientRect()`), la convención que espera `flow-canvas-viewport.ts`. */
  private canvasRelativePoint(clientPoint: SolFlowCanvasPosition, event: Event): SolFlowCanvasPosition {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: clientPoint.x - rect.left, y: clientPoint.y - rect.top };
  }

  /**
   * Calcula y aplica una posición a TODO nodo actual sin `position` válido
   * usando {@link computeAutoLayoutPositions} (dagre real, PR-C3 — con
   * fallback BFS síncrono si el chunk lazy falla, ver W2 en
   * `flow-canvas-layout.ts`). Los nodos YA posicionados NO se tocan. Emite
   * `nodeMoved` por cada nodo repositionado. Opera 100% en espacio CANVAS
   * (igual que `node.position` siempre) — el pan/zoom vigente NUNCA entra en
   * este cálculo, no hay conversión de coordenadas que hacer acá (a
   * diferencia del arrastre, que sí consume `clientX/Y` de pantalla).
   *
   * No-op si `isReadonly()` es `true` (S1, 4R Ola 5).
   *
   * **W3 (4R Ola 5 post PR-C3, fuga de bundle) — CAMBIO DE CONTRATO
   * DELIBERADO**: pasa de síncrono a `Promise<void>` porque
   * `computeAutoLayoutPositions` ahora carga `@dagrejs/dagre` vía `import()`
   * dinámico (el módulo entero se saca del chunk eager, no solo la
   * instancia — ver docstring de `flow-canvas-layout.ts`). Consumidores
   * existentes que llamaban `autoLayout()` de forma "fire-and-forget" (el
   * effect de `pages/flows`) siguen funcionando sin `await` — el nodo queda
   * sin posición hasta que la promesa resuelve, que es exactamente el mismo
   * intervalo que antes tomaba el cálculo síncrono, solo que ahora incluye
   * la carga del chunk la PRIMERA vez.
   */
  /**
   * PR-C4 (GOAL §4 punto 5) — dispara `autoLayout()` desde el botón flotante
   * SIEMPRE visible en móvil (`@if (!isReadonly())` en el template ya cubre
   * el guard de solo-lectura; este método solo existe para darle un nombre
   * de evento propio al `(click)`, fire-and-forget igual que el efecto de
   * `pages/flows` que ya invoca `autoLayout()` sin `await`).
   */
  protected onAutoLayoutClick(): void {
    void this.autoLayout();
  }

  async autoLayout(): Promise<void> {
    if (this.isReadonly()) return;
    const current = this.mirroredNodes();
    const pending = current.filter((node) => !this.hasValidPosition(node));
    if (pending.length === 0) return;

    const computed = await computeAutoLayoutPositions(current, this.edges() ?? []);
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

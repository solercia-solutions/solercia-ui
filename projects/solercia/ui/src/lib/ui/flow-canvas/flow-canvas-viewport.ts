import type { SolFlowCanvasPosition } from './flow-canvas.model';

/**
 * Motor de pan/zoom de `sol-flow-canvas` (Ola 5 PR-C2B — motor nativo
 * SVG+CDK del bake-off, `openspec/GOAL-ola5-flow-canvas-y-cutover.md` §4).
 * PURO, sin Angular, sin DOM (mismo criterio que `flow-canvas-layout.ts`):
 * el componente traduce eventos del navegador a estas funciones, nunca al
 * revés.
 *
 * ## Convención de coordenadas (3 sistemas — NO confundirlos)
 *
 *  - **client** (`event.clientX/Y`): px absolutos del viewport del navegador.
 *    Este módulo NUNCA los toca directo — el componente los convierte primero
 *    a "screen" restando `getBoundingClientRect()` del host.
 *  - **screen**: px relativos a la esquina superior-izquierda del host
 *    `.sol-flow-canvas` (el elemento CON el listener). Es lo que produce
 *    `dx`/`dy` de un `pointermove` o la posición de anclaje de un wheel/pinch.
 *  - **world** (o "canvas"): el MISMO sistema de coordenadas que
 *    `SolFlowCanvasNode.position` ya usaba en el shell de PR-C1 (con
 *    zoom=1/pan=(0,0) implícitos) — es donde vive `node.position`, y por
 *    tanto donde debe resolverse cualquier delta de arrastre ANTES de
 *    commitear `nodeMoved`.
 *
 * Fórmula única: `screen = world * zoom + pan` (equivalente al CSS
 * `transform: translate(pan) scale(zoom)` aplicado a `.sol-flow-canvas__world`
 * — `translate` se escribe ANTES de `scale`, o sea que un punto local (world)
 * se escala primero y se traslada después). Inversa: `world = (screen - pan)
 * / zoom`.
 */

export interface SolFlowCanvasViewport {
  panX: number;
  panY: number;
  zoom: number;
}

export const DEFAULT_VIEWPORT: SolFlowCanvasViewport = { panX: 0, panY: 0, zoom: 1 };

/**
 * Rango de zoom — mismo orden de magnitud que herramientas comparables
 * (n8n/Figma rondan 0.2x–2x/4x); 0.25x–2.5x cubre "ver el flujo completo"
 * (decenas de nodos) hasta "leer el detalle de un nodo" sin permitir un zoom
 * tan extremo que el drag/las curvas bezier se vuelvan imprecisos.
 */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;

/** Sensibilidad exponencial de la rueda — un solo "tick" típico (~100 unidades de deltaY) mueve el zoom ~10%. */
const WHEEL_ZOOM_SENSITIVITY = 0.001;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(viewport: SolFlowCanvasViewport, screenPoint: SolFlowCanvasPosition): SolFlowCanvasPosition {
  return {
    x: (screenPoint.x - viewport.panX) / viewport.zoom,
    y: (screenPoint.y - viewport.panY) / viewport.zoom,
  };
}

export function worldToScreen(viewport: SolFlowCanvasViewport, worldPoint: SolFlowCanvasPosition): SolFlowCanvasPosition {
  return {
    x: worldPoint.x * viewport.zoom + viewport.panX,
    y: worldPoint.y * viewport.zoom + viewport.panY,
  };
}

/**
 * Cambia el zoom a `nextZoomRaw` (clampeado) recalculando el pan para que
 * `screenAnchor` (p. ej. la posición del cursor o el punto medio de un pinch)
 * quede EXACTAMENTE en el mismo punto `world` antes y después — "zoom hacia
 * el cursor", el mismo criterio que cualquier editor de canvas (Figma, n8n).
 */
export function zoomAtScreenPoint(
  viewport: SolFlowCanvasViewport,
  screenAnchor: SolFlowCanvasPosition,
  nextZoomRaw: number,
): SolFlowCanvasViewport {
  const nextZoom = clampZoom(nextZoomRaw);
  if (nextZoom === viewport.zoom) return viewport; // sin cambio real: evita objetos nuevos y una división innecesaria
  const worldAnchor = screenToWorld(viewport, screenAnchor);
  return {
    zoom: nextZoom,
    panX: screenAnchor.x - worldAnchor.x * nextZoom,
    panY: screenAnchor.y - worldAnchor.y * nextZoom,
  };
}

/**
 * `deltaY` crudo de un `WheelEvent` — negativo (scroll "hacia adelante"/rueda
 * arriba en la mayoría de mice) ACERCA, mismo sentido que Figma/n8n/Google
 * Maps. Factor exponencial (no lineal): mantiene la sensación de "porcentaje
 * relativo" constante sea cual sea el zoom actual.
 */
export function computeWheelZoom(
  viewport: SolFlowCanvasViewport,
  deltaY: number,
  screenAnchor: SolFlowCanvasPosition,
): SolFlowCanvasViewport {
  const factor = Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
  return zoomAtScreenPoint(viewport, screenAnchor, viewport.zoom * factor);
}

/**
 * Arrastre del FONDO — delta en coordenadas "screen" (pantalla), aplicado
 * DIRECTO al pan sin dividir por zoom: el fondo debe seguir al dedo/cursor 1:1
 * en píxeles de pantalla sin importar el zoom actual (mismo criterio que
 * paneas cualquier mapa/editor — solo el contenido ESCALADO se mueve más o
 * menos "rápido" en unidades world, el pan en sí es puramente de pantalla).
 */
export function panBy(viewport: SolFlowCanvasViewport, screenDelta: SolFlowCanvasPosition): SolFlowCanvasViewport {
  return { ...viewport, panX: viewport.panX + screenDelta.x, panY: viewport.panY + screenDelta.y };
}

export function distanceBetween(a: SolFlowCanvasPosition, b: SolFlowCanvasPosition): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: SolFlowCanvasPosition, b: SolFlowCanvasPosition): SolFlowCanvasPosition {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Pinch de dos punteros (touch): la RAZÓN entre la distancia actual y la
 * anterior entre los dos punteros define el factor de zoom incremental —
 * separar los dedos (distancia crece) acerca, juntarlos aleja. `screenAnchor`
 * es el punto medio ACTUAL de los dos punteros (se recalcula en cada
 * `pointermove` — el componente pasa el punto medio vigente, no el inicial,
 * para que el ancla del zoom siga a los dedos igual que un pinch real).
 */
export function computePinchZoom(
  viewport: SolFlowCanvasViewport,
  previousDistance: number,
  currentDistance: number,
  screenAnchor: SolFlowCanvasPosition,
): SolFlowCanvasViewport {
  if (previousDistance <= 0) return viewport; // defensivo: sin distancia previa válida, no hay razón que calcular
  const ratio = currentDistance / previousDistance;
  return zoomAtScreenPoint(viewport, screenAnchor, viewport.zoom * ratio);
}

/** Margen (px de PANTALLA) que deja `panToRevealWorldRect` entre el borde del rect revelado y el borde del viewport. */
const REVEAL_MARGIN_PX = 24;

/**
 * Ajusta el PAN (nunca el zoom — evita saltos de escala inesperados al tabular) para que `worldRect`
 * quede completamente visible dentro de un viewport de pantalla de `viewportSize`, con
 * {@link REVEAL_MARGIN_PX} de margen. No-op si `worldRect` ya es completamente visible, o si
 * `viewportSize` no tiene un tamaño medible todavía (0×0 — p. ej. antes del primer layout real; nunca
 * lanza ni produce NaN).
 *
 * Motivación (PR-C2B, W-fix): el shell de PR-C1 usaba `overflow: auto` — el navegador hacía
 * "scroll into view" GRATIS cuando el foco de teclado (Tab) llegaba a un nodo fuera del viewport
 * visible. `sol-flow-canvas` reemplaza ese scroll nativo por `overflow: hidden` + pan/zoom propio (`transform`)
 * — sin este ajuste, Tab movería el foco LÓGICO sin revelarlo visualmente, una regresión real de
 * accesibilidad (ver Learned del reporte de fase PR-C2B).
 */
export function panToRevealWorldRect(
  viewport: SolFlowCanvasViewport,
  worldRect: { x: number; y: number; width: number; height: number },
  viewportSize: { width: number; height: number },
  margin = REVEAL_MARGIN_PX,
): SolFlowCanvasViewport {
  if (viewportSize.width <= 0 || viewportSize.height <= 0) return viewport; // sin tamaño medible: no hay decisión segura que tomar

  const topLeft = worldToScreen(viewport, { x: worldRect.x, y: worldRect.y });
  const bottomRight = worldToScreen(viewport, { x: worldRect.x + worldRect.width, y: worldRect.y + worldRect.height });

  const dx = axisRevealDelta(topLeft.x, bottomRight.x, viewportSize.width, margin);
  const dy = axisRevealDelta(topLeft.y, bottomRight.y, viewportSize.height, margin);
  if (dx === 0 && dy === 0) return viewport;
  return panBy(viewport, { x: dx, y: dy });
}

/** Delta de pan de UN eje — prioriza revelar el borde de INICIO (top/left) si el rect no cabe entero entre los dos márgenes (rect más grande que el viewport visible). */
function axisRevealDelta(startScreen: number, endScreen: number, viewportLength: number, margin: number): number {
  if (startScreen < margin) return margin - startScreen;
  if (endScreen > viewportLength - margin) return viewportLength - margin - endScreen;
  return 0;
}

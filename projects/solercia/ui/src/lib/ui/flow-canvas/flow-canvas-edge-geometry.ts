import type { SolFlowCanvasPosition } from './flow-canvas.model';

/**
 * Geometría bezier de las aristas de `sol-flow-canvas` (Ola 5 PR-C2B) — PURA,
 * sin Angular/DOM (mismo criterio que `flow-canvas-layout.ts`). Sustituye las
 * líneas rectas del shell de PR-C1 (`edgeLine()`, `x1/y1/x2/y2`) por curvas
 * cúbicas con "dirección del flujo": control points HORIZONTALES simétricos
 * (`c1` a la derecha del origen, `c2` a la izquierda del destino) — mismo
 * criterio visual que n8n/react-flow, coherente con el layout BFS-por-columnas
 * de `flow-canvas-layout.ts` (`COLUMN_GAP_PX` en el eje x).
 */

/** Piso del offset del handle — evita una curva imperceptible en distancias horizontales cortas. */
const MIN_HANDLE_PX = 40;
/** Fracción de la distancia horizontal usada como offset del handle — más separación horizontal, curva más pronunciada. */
const HANDLE_RATIO = 0.5;

export function computeEdgeControlPoints(
  source: SolFlowCanvasPosition,
  target: SolFlowCanvasPosition,
): { c1: SolFlowCanvasPosition; c2: SolFlowCanvasPosition } {
  const dx = target.x - source.x;
  // Math.abs(dx): el offset SIEMPRE es positivo — incluso con dx=0 (nodos apilados en la misma columna) o
  // dx<0 (destino a la izquierda del origen, p. ej. una conexión "hacia atrás") la curva sigue siendo visible.
  const offset = Math.max(MIN_HANDLE_PX, Math.abs(dx) * HANDLE_RATIO);
  return {
    c1: { x: source.x + offset, y: source.y },
    c2: { x: target.x - offset, y: target.y },
  };
}

/** Atributo `d` de un elemento SVG "path" — curva cúbica `M origen C c1 c2 destino`. */
export function computeEdgePathD(source: SolFlowCanvasPosition, target: SolFlowCanvasPosition): string {
  const { c1, c2 } = computeEdgeControlPoints(source, target);
  return `M ${source.x},${source.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${target.x},${target.y}`;
}

/** Fórmula de Bernstein general de una bezier cúbica — `t` en [0,1]. Genérica a propósito (no asume handles horizontales) para que siga siendo correcta si el criterio de control points cambia en el futuro. */
export function computeCubicBezierPoint(
  p0: SolFlowCanvasPosition,
  p1: SolFlowCanvasPosition,
  p2: SolFlowCanvasPosition,
  p3: SolFlowCanvasPosition,
  t: number,
): SolFlowCanvasPosition {
  const mt = 1 - t;
  const w0 = mt * mt * mt;
  const w1 = 3 * mt * mt * t;
  const w2 = 3 * mt * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x,
    y: w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y,
  };
}

/**
 * Punto SOBRE la curva bezier (t=0.5) para posicionar el label de la arista —
 * reemplaza el punto medio de la RECTA que usaba el shell de PR-C1.
 *
 * Nota de diseño: con los handles horizontales simétricos de
 * {@link computeEdgeControlPoints} (`c1.y=source.y`, `c2.y=target.y`, y
 * `c1.x + c2.x = source.x + target.x` porque el offset se suma de un lado y
 * se resta del otro), el punto en t=0.5 de CUALQUIER bezier cúbica —
 * `B(0.5) = (P0 + 3·P1 + 3·P2 + P3) / 8` — colapsa algebraicamente al
 * promedio exacto `(source + target) / 2` sin importar el offset (los
 * términos del offset se cancelan). Es decir: para ESTA construcción de
 * control points, el punto medio de la curva y el punto medio de la recta
 * coinciden en valor — la diferencia real está en que este helper calcula el
 * punto GENUINO de la curva (válido si el criterio de control points cambia
 * a uno no simétrico más adelante), no en que el número resultante hoy sea
 * distinto.
 */
export function computeEdgeMidpoint(source: SolFlowCanvasPosition, target: SolFlowCanvasPosition): SolFlowCanvasPosition {
  const { c1, c2 } = computeEdgeControlPoints(source, target);
  return computeCubicBezierPoint(source, c1, c2, target, 0.5);
}

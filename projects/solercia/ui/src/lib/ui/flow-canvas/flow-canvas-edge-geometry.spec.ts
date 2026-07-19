import { describe, expect, it } from 'vitest';
import {
  computeCubicBezierPoint,
  computeEdgeControlPoints,
  computeEdgeMidpoint,
  computeEdgePathD,
} from './flow-canvas-edge-geometry';

/**
 * Geometría bezier de las aristas de `sol-flow-canvas` (Ola 5 PR-C2B) — PURA,
 * sin Angular/DOM (mismo criterio que `flow-canvas-layout.ts`/
 * `flow-canvas-viewport.ts`). Construcción elegida: control points
 * HORIZONTALES simétricos (`c1` a la derecha del origen, `c2` a la izquierda
 * del destino, mismo offset) — favorece la "dirección del flujo" horizontal
 * del layout BFS-por-columnas de `flow-canvas-layout.ts` (`COLUMN_GAP_PX` en
 * x), igual que n8n/react-flow.
 */

describe('computeEdgeControlPoints', () => {
  it('c1 se desplaza a la derecha del origen y c2 a la izquierda del destino, ambos en la MISMA y que su ancla', () => {
    const { c1, c2 } = computeEdgeControlPoints({ x: 0, y: 0 }, { x: 300, y: 100 });
    expect(c1.y).toBe(0);
    expect(c2.y).toBe(100);
    expect(c1.x).toBeGreaterThan(0);
    expect(c2.x).toBeLessThan(300);
  });

  it('nunca degenera a offset 0 aunque origen y destino compartan x (apilados verticalmente) — SIEMPRE hay curva visible', () => {
    const { c1, c2 } = computeEdgeControlPoints({ x: 50, y: 0 }, { x: 50, y: 200 });
    expect(c1.x).not.toBe(50);
    expect(c2.x).not.toBe(50);
  });
});

describe('computeEdgePathD — atributo `d` de un <path> SVG', () => {
  it('empieza en el origen (M) y termina en el destino (C ... targetX,targetY)', () => {
    const d = computeEdgePathD({ x: 10, y: 20 }, { x: 310, y: 20 });
    expect(d.startsWith('M 10,20 C ')).toBe(true);
    expect(d.trim().endsWith('310,20')).toBe(true);
  });

  it('usa los MISMOS control points que computeEdgeControlPoints (consistencia entre ambas funciones)', () => {
    const source = { x: 0, y: 0 };
    const target = { x: 400, y: 50 };
    const { c1, c2 } = computeEdgeControlPoints(source, target);
    const d = computeEdgePathD(source, target);
    expect(d).toBe(`M 0,0 C ${c1.x},${c1.y} ${c2.x},${c2.y} 400,50`);
  });
});

describe('computeCubicBezierPoint — fórmula de Bernstein general', () => {
  it('t=0 devuelve el punto de anclaje inicial (P0)', () => {
    const p0 = { x: 1, y: 2 };
    expect(computeCubicBezierPoint(p0, { x: 9, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 9 }, 0)).toEqual(p0);
  });

  it('t=1 devuelve el punto de anclaje final (P3)', () => {
    const p3 = { x: 7, y: 8 };
    expect(computeCubicBezierPoint({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }, p3, 1)).toEqual(p3);
  });

  it('caso degenerado (los 4 puntos iguales) devuelve siempre ese punto, para cualquier t', () => {
    const p = { x: 5, y: 5 };
    expect(computeCubicBezierPoint(p, p, p, p, 0.37)).toEqual(p);
  });
});

describe('computeEdgeMidpoint — punto SOBRE la curva bezier para posicionar el label', () => {
  it('coincide EXACTAMENTE con computeCubicBezierPoint(source, c1, c2, target, 0.5) — es el mismo punto, no una aproximación', () => {
    const source = { x: 0, y: 0 };
    const target = { x: 300, y: 120 };
    const { c1, c2 } = computeEdgeControlPoints(source, target);
    const expected = computeCubicBezierPoint(source, c1, c2, target, 0.5);
    expect(computeEdgeMidpoint(source, target)).toEqual(expected);
  });

  it('con handles horizontales simétricos (c1.y=source.y, c2.y=target.y), el punto en t=0.5 cae en el promedio exacto de ambos anclajes — propiedad conocida de esta construcción (ver docstring del módulo), no una casualidad de estos números', () => {
    const source = { x: 20, y: 0 };
    const target = { x: 320, y: 140 };
    expect(computeEdgeMidpoint(source, target)).toEqual({ x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 });
  });

  it('el punto está en el rango [minY,maxY] de los anclajes incluso con handles que se salen de ese rango en x (la curva SIGUE pasando "entre" origen y destino en y a mitad de camino)', () => {
    const midY = computeEdgeMidpoint({ x: 0, y: 0 }, { x: 5, y: 300 }).y;
    expect(midY).toBeGreaterThanOrEqual(0);
    expect(midY).toBeLessThanOrEqual(300);
  });
});

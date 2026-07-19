import { describe, expect, it } from 'vitest';
import { computeAutoLayoutPositions, countEdgeIds, countNodeIds, safeTrackKey } from './flow-canvas-layout';
import type { SolFlowCanvasEdge, SolFlowCanvasNode } from './flow-canvas.model';

function n(id: string): SolFlowCanvasNode {
  return { id, label: id, kind: 'default', position: { x: 0, y: 0 } };
}

function e(sourceId: string, targetId: string): SolFlowCanvasEdge {
  return { id: `${sourceId}->${targetId}`, sourceId, targetId, kind: 'always' };
}

describe('computeAutoLayoutPositions — motor dagre real (Ola 5 PR-C3; placeholder BFS reemplazado, mismas propiedades exigidas por este contrato)', () => {
  it('cadena lineal a->b->c: cada nodo en su propia columna, en orden creciente de x', () => {
    const positions = computeAutoLayoutPositions([n('a'), n('b'), n('c')], [e('a', 'b'), e('b', 'c')]);
    expect(positions.get('a')!.x).toBeLessThan(positions.get('b')!.x);
    expect(positions.get('b')!.x).toBeLessThan(positions.get('c')!.x);
  });

  it('dos raíces + ramas paralelas: mismos niveles comparten columna (mismo x), filas distintas (y distinto)', () => {
    const positions = computeAutoLayoutPositions([n('a'), n('b'), n('c')], [e('a', 'c'), e('b', 'c')]);
    expect(positions.get('a')!.x).toBe(positions.get('b')!.x);
    expect(positions.get('a')!.y).not.toBe(positions.get('b')!.y);
  });

  it('grafo sin aristas: cada nodo es su propia raíz (todos en la misma columna, filas distintas)', () => {
    const positions = computeAutoLayoutPositions([n('a'), n('b')], []);
    expect(positions.get('a')!.x).toBe(positions.get('b')!.x);
    expect(positions.get('a')).not.toEqual(positions.get('b'));
  });

  it('[robustez — ciclo] a->b->a NUNCA cuelga (BFS de primer-toque, no recalcula profundidad)', () => {
    expect(() => computeAutoLayoutPositions([n('a'), n('b')], [e('a', 'b'), e('b', 'a')])).not.toThrow();
    const positions = computeAutoLayoutPositions([n('a'), n('b')], [e('a', 'b'), e('b', 'a')]);
    expect(positions.size).toBe(2);
  });

  it('arista que referencia un nodo inexistente se ignora sin lanzar', () => {
    expect(() => computeAutoLayoutPositions([n('a')], [e('a', 'fantasma')])).not.toThrow();
  });

  it('[robustez] nodes/edges null no lanza — retorna un mapa vacío', () => {
    expect(computeAutoLayoutPositions(null as unknown as [], null as unknown as []).size).toBe(0);
  });

  it('es determinístico: la MISMA entrada produce SIEMPRE la misma salida (orden por id, sin depender del orden de inserción)', () => {
    const a = computeAutoLayoutPositions([n('z'), n('a')], []);
    const b = computeAutoLayoutPositions([n('a'), n('z')], []);
    expect(a.get('a')).toEqual(b.get('a'));
    expect(a.get('z')).toEqual(b.get('z'));
  });

  it('ninguna coordenada es negativa (el lienzo clampea a >=0 — el layout arranca ya normalizado, sin depender de ese clamp)', () => {
    const positions = computeAutoLayoutPositions([n('a'), n('b'), n('c')], [e('a', 'b'), e('a', 'c')]);
    for (const position of positions.values()) {
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('DIAMANTE de 4 nodos: la rama larga (dos saltos) queda MÁS lejos en x que la corta (mismo camino más largo gana el rango, criterio de red de Sugiyama que dagre implementa)', () => {
    // a -> b -> d (2 saltos) y a -> c -> ... realmente ambos caminos miden 2 acá;
    // se arma un camino de 3 saltos (a->b->c->d) en paralelo a uno de 1 salto
    // (a->d) para que quede inequívoco cuál layout "ranking real" (dagre)
    // separa mejor que un BFS de primer-toque puro.
    const positions = computeAutoLayoutPositions(
      [n('a'), n('b'), n('c'), n('d')],
      [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('a', 'd')],
    );
    expect(positions.get('a')!.x).toBeLessThan(positions.get('b')!.x);
    expect(positions.get('b')!.x).toBeLessThan(positions.get('c')!.x);
    expect(positions.get('c')!.x).toBeLessThan(positions.get('d')!.x);
  });

  it('MINIMIZA cruces de aristas entre 2 columnas (a,b -> x,y con a->y/b->x cruzados): el orden de filas se REACOMODA para evitar el cruce — un BFS con orden alfabético fijo NO lo logra (diferenciador real vs. el placeholder anterior)', () => {
    const positions = computeAutoLayoutPositions([n('a'), n('b'), n('x'), n('y')], [e('a', 'y'), e('b', 'x')]);
    const aAboveB = positions.get('a')!.y < positions.get('b')!.y;
    const yAboveX = positions.get('y')!.y < positions.get('x')!.y;
    // Sin cruce: si "a" queda arriba de "b", su destino "y" también debe quedar
    // arriba de "x" (el destino de "b") — dagre reordena las filas para lograrlo;
    // un BFS con orden alfabético fijo (x antes que y, SIEMPRE) no podía.
    expect(aAboveB).toBe(yAboveX);
  });
});

describe('countNodeIds / safeTrackKey — mismo criterio defensivo que kanban-track.ts (duplicado a propósito, ver docstring)', () => {
  it('un id ausente/duplicado hace que safeTrackKey caiga al índice (evita NG0955)', () => {
    const freq = countNodeIds([n('a'), n('a')]);
    expect(safeTrackKey('a', 0, freq)).toBe(0);
    expect(safeTrackKey('a', 1, freq)).toBe(1);
  });

  it('un id único y presente se usa tal cual', () => {
    const freq = countNodeIds([n('a'), n('b')]);
    expect(safeTrackKey('a', 0, freq)).toBe('a');
  });

  it('id undefined siempre cae al índice', () => {
    const freq = countNodeIds([n('a')]);
    expect(safeTrackKey(undefined, 3, freq)).toBe(3);
  });
});

describe('countEdgeIds — mismo criterio que countNodeIds, aplicado a edges (soporte de C2, fix NG0955 con edges de id duplicado)', () => {
  it('cuenta la frecuencia de cada id de edge', () => {
    const freq = countEdgeIds([e('a', 'b'), e('a', 'b')]); // helper e() genera el mismo id "a->b" en ambas
    expect(freq.get('a->b')).toBe(2);
  });

  it('un id único cuenta 1', () => {
    const freq = countEdgeIds([e('a', 'b'), e('b', 'c')]);
    expect(freq.get('a->b')).toBe(1);
    expect(freq.get('b->c')).toBe(1);
  });
});

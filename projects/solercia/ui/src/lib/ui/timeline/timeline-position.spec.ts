import {
  computeGlobalRange,
  computeMonthAxisTicks,
  collectUndatedNodes,
  defaultStatusToken,
  positionRows,
} from './timeline-position';
import type { TimelineNode } from './timeline.model';

describe('positionRows (pura)', () => {
  it('[spec] barra proporcional al rango: rango día 1-31, nodo start=10/end=20 → ancho (20-10)/(31-1)', () => {
    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() };
    const node: TimelineNode = { id: 1, label: 'Tarea', start: new Date(2024, 0, 10), end: new Date(2024, 0, 20) };

    const [row] = positionRows([node], range);

    expect(row.widthPct).toBeCloseTo(((20 - 10) / (31 - 1)) * 100, 5);
    expect(row.leftPct).toBeCloseTo(((10 - 1) / (31 - 1)) * 100, 5);
  });

  it('[spec] barra envolvente del padre: sin fechas propias, hijos [5,10] y [8,15] → padre cubre [5,15]', () => {
    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() };
    const parent: TimelineNode = {
      id: 'p',
      label: 'Padre',
      children: [
        { id: 'c1', label: 'Hijo 1', start: new Date(2024, 0, 5), end: new Date(2024, 0, 10) },
        { id: 'c2', label: 'Hijo 2', start: new Date(2024, 0, 8), end: new Date(2024, 0, 15) },
      ],
    };

    const rows = positionRows([parent], range);
    const parentRow = rows.find((r) => r.node.id === 'p')!;

    const expectedLeft = ((5 - 1) / (31 - 1)) * 100;
    const expectedWidth = ((15 - 5) / (31 - 1)) * 100;
    expect(parentRow.leftPct).toBeCloseTo(expectedLeft, 5);
    expect(parentRow.widthPct).toBeCloseTo(expectedWidth, 5);
  });

  it('[spec] fila sin fechas (ni propias ni de descendientes): se omite de positionRows', () => {
    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() };
    const undated: TimelineNode = { id: 'u', label: 'Sin fecha' };
    const dated: TimelineNode = { id: 'd', label: 'Con fecha', start: new Date(2024, 0, 10), end: new Date(2024, 0, 20) };

    const rows = positionRows([undated, dated], range);

    expect(rows.map((r) => r.node.id)).toEqual(['d']);
  });

  it('renderiza N niveles con depth creciente y respeta el colapso vía isCollapsed', () => {
    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() };
    const leaf: TimelineNode = { id: 'leaf', start: new Date(2024, 0, 12), end: new Date(2024, 0, 14) };
    const mid: TimelineNode = { id: 'mid', start: new Date(2024, 0, 10), end: new Date(2024, 0, 16), children: [leaf] };
    const root: TimelineNode = { id: 'root', start: new Date(2024, 0, 5), end: new Date(2024, 0, 20), children: [mid] };

    const expanded = positionRows([root], range, { isCollapsed: () => false });
    expect(expanded.map((r) => [r.node.id, r.depth])).toEqual([
      ['root', 0],
      ['mid', 1],
      ['leaf', 2],
    ]);

    const collapsedAtRoot = positionRows([root], range, { isCollapsed: (n) => n.id === 'root' });
    expect(collapsedAtRoot.map((r) => r.node.id)).toEqual(['root']);
  });

  it('[robustez PR3] nodes null/undefined no lanza — devuelve arreglo vacío', () => {
    const range = { start: 0, end: 100 };
    expect(() => positionRows(null, range)).not.toThrow();
    expect(positionRows(null, range)).toEqual([]);
    expect(positionRows(undefined, range)).toEqual([]);
  });

  it('[robustez PR3] fecha inválida (string no parseable) se trata como "sin fecha", no lanza', () => {
    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() };
    const bad: TimelineNode = { id: 'bad', start: 'no-es-una-fecha', end: new Date(2024, 0, 20) };

    expect(() => positionRows([bad], range)).not.toThrow();
    expect(positionRows([bad], range)).toEqual([]);
  });

  it('un elemento nulo dentro del arreglo de nodos se ignora sin lanzar', () => {
    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() };
    const dated: TimelineNode = { id: 'd', start: new Date(2024, 0, 10), end: new Date(2024, 0, 20) };

    expect(() => positionRows([null as unknown as TimelineNode, dated], range)).not.toThrow();
    expect(positionRows([null as unknown as TimelineNode, dated], range).map((r) => r.node.id)).toEqual(['d']);
  });
});

describe('computeGlobalRange (pura)', () => {
  it('rango global = min/max de las HOJAS con fecha (un intermedio con fecha propia no participa por sí solo)', () => {
    const leafA: TimelineNode = { id: 'a', start: new Date(2024, 0, 5), end: new Date(2024, 0, 10) };
    const leafB: TimelineNode = { id: 'b', start: new Date(2024, 0, 20), end: new Date(2024, 0, 25) };
    const parent: TimelineNode = {
      id: 'p',
      start: new Date(2024, 0, 1), // fecha propia de un nodo CON hijos: se ignora para el rango global
      end: new Date(2024, 0, 31),
      children: [leafA, leafB],
    };

    const range = computeGlobalRange([parent]);
    expect(range).toEqual({ start: new Date(2024, 0, 5).getTime(), end: new Date(2024, 0, 25).getTime() });
  });

  it('sin ninguna hoja con fecha resoluble, devuelve null', () => {
    expect(computeGlobalRange([{ id: 'x', label: 'sin fecha' }])).toBeNull();
  });

  it('[robustez PR3] nodes null/undefined no lanza — devuelve null', () => {
    expect(() => computeGlobalRange(null)).not.toThrow();
    expect(computeGlobalRange(null)).toBeNull();
    expect(computeGlobalRange(undefined)).toBeNull();
  });
});

describe('collectUndatedNodes (pura)', () => {
  it('devuelve, en lista plana, los subárboles enteramente sin fecha', () => {
    const datedLeaf: TimelineNode = { id: 'd', start: new Date(2024, 0, 5), end: new Date(2024, 0, 10) };
    const undatedLeaf: TimelineNode = { id: 'u1', label: 'Sin fecha 1' };
    const undatedSubtree: TimelineNode = { id: 'u2', children: [{ id: 'u2a', label: 'nieto sin fecha' }] };
    const mixedParent: TimelineNode = { id: 'mixed', children: [datedLeaf, undatedLeaf] };

    const undated = collectUndatedNodes([mixedParent, undatedSubtree]);
    expect(undated.map((n) => n.id).sort()).toEqual(['u1', 'u2']);
  });
});

describe('computeMonthAxisTicks (pura, i18n-agnóstica)', () => {
  it('genera un tick por mes dentro del rango, más el límite final', () => {
    const range = { start: new Date(2024, 0, 15).getTime(), end: new Date(2024, 2, 10).getTime() }; // 15 ene → 10 mar
    const ticks = computeMonthAxisTicks(range);

    expect(ticks[0]).toEqual(expect.objectContaining({ year: 2024, month: 1 })); // 1 feb (primer 1º de mes dentro del rango)
    expect(ticks[ticks.length - 1]).toEqual(expect.objectContaining({ leftPct: 100, year: 2024, month: 2 }));
  });

  it('rango degenerado (end <= start) devuelve arreglo vacío sin lanzar', () => {
    expect(computeMonthAxisTicks({ start: 100, end: 100 })).toEqual([]);
    expect(computeMonthAxisTicks({ start: 100, end: 50 })).toEqual([]);
  });
});

describe('defaultStatusToken (pura)', () => {
  it('mapea estados comunes conocidos a su tono, normalizando mayúsculas/espacios', () => {
    expect(defaultStatusToken('Done')).toBe(defaultStatusToken('done'));
    expect(defaultStatusToken('at risk')).toBe(defaultStatusToken('atrisk'));
  });

  it('un status desconocido o ausente cae a neutral, sin lanzar', () => {
    expect(() => defaultStatusToken('algo-inventado')).not.toThrow();
    expect(() => defaultStatusToken(undefined)).not.toThrow();
  });
});

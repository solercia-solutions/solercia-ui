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

  it('[CRITICAL-1] threeLevelTree con fechas propias en todos los niveles: TODAS las barras quedan dentro de [0,100]', () => {
    // Reproducción exacta del hallazgo de review: root 1-31 ene, mid 5-20 ene,
    // leaf 8-12 ene. El rango GLOBAL debe derivarse con el MISMO criterio que
    // resuelve la barra de cada nodo (resolveNodeRange) — antes,
    // computeGlobalRange solo miraba las HOJAS (leaf: 8-12 ene) mientras que
    // la barra del root usaba sus fechas propias (1-31 ene) directamente,
    // produciendo leftPct/widthPct muy fuera de [0,100] (p. ej. ≈-175%/750%).
    const range = computeGlobalRange([
      {
        id: 'root',
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 31),
        children: [
          {
            id: 'mid',
            start: new Date(2024, 0, 5),
            end: new Date(2024, 0, 20),
            children: [{ id: 'leaf', start: new Date(2024, 0, 8), end: new Date(2024, 0, 12) }],
          },
        ],
      },
    ])!;

    const rows = positionRows(
      [
        {
          id: 'root',
          start: new Date(2024, 0, 1),
          end: new Date(2024, 0, 31),
          children: [
            {
              id: 'mid',
              start: new Date(2024, 0, 5),
              end: new Date(2024, 0, 20),
              children: [{ id: 'leaf', start: new Date(2024, 0, 8), end: new Date(2024, 0, 12) }],
            },
          ],
        },
      ],
      range,
    );

    expect(rows.length).toBe(3);
    for (const row of rows) {
      expect(row.leftPct).toBeGreaterThanOrEqual(0);
      expect(row.leftPct + row.widthPct).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it('[CRITICAL-3] un ciclo directo (nodo hijo de sí mismo) no lanza RangeError — degrada sin romper', () => {
    const cyclic: TimelineNode & { children: TimelineNode[] } = {
      id: 'cyclic',
      label: 'Ciclo',
      start: new Date(2024, 0, 5),
      end: new Date(2024, 0, 10),
      children: [],
    };
    cyclic.children = [cyclic]; // referencia a sí mismo

    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() };
    expect(() => positionRows([cyclic], range)).not.toThrow();
  });

  it('[CRITICAL-3] un ciclo indirecto (a→b→a) no lanza RangeError', () => {
    const a: TimelineNode & { children: TimelineNode[] } = { id: 'a', start: new Date(2024, 0, 1), end: new Date(2024, 0, 5), children: [] };
    const b: TimelineNode & { children: TimelineNode[] } = { id: 'b', start: new Date(2024, 0, 6), end: new Date(2024, 0, 10), children: [] };
    a.children = [b];
    b.children = [a];

    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() };
    expect(() => positionRows([a], range)).not.toThrow();
    expect(() => computeGlobalRange([a])).not.toThrow();
  });

  it('[WARNING] start > end (fechas invertidas): se trata como "sin fecha", no como barra mal ubicada', () => {
    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() };
    const inverted: TimelineNode = { id: 'inv', label: 'Invertido', start: new Date(2024, 0, 20), end: new Date(2024, 0, 10) };

    expect(positionRows([inverted], range)).toEqual([]);
  });
});

describe('computeGlobalRange (pura)', () => {
  it('[CRITICAL-1] usa el MISMO criterio que la barra de cada nodo: un padre con fecha propia MÁS ANCHA que sus hijos amplía el rango global (unión, no solo hojas)', () => {
    const leafA: TimelineNode = { id: 'a', start: new Date(2024, 0, 5), end: new Date(2024, 0, 10) };
    const leafB: TimelineNode = { id: 'b', start: new Date(2024, 0, 20), end: new Date(2024, 0, 25) };
    const parent: TimelineNode = {
      id: 'p',
      start: new Date(2024, 0, 1), // fecha propia MÁS ANCHA que la envolvente de sus hijos [5,25]
      end: new Date(2024, 0, 31),
      children: [leafA, leafB],
    };

    // Antes del fix, computeGlobalRange ignoraba la fecha propia del padre y
    // devolvía solo [5,25] (envolvente de las hojas) — desalineado con
    // resolveNodeRange (que sí usaba la fecha propia), produciendo barras
    // fuera de [0,100]. Ahora ambas funciones usan el mismo criterio: unión.
    const range = computeGlobalRange([parent]);
    expect(range).toEqual({ start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 0, 31).getTime() });
  });

  it('sin fecha propia en el padre, el rango global es la envolvente de las hojas (comportamiento sin cambios)', () => {
    const leafA: TimelineNode = { id: 'a', start: new Date(2024, 0, 5), end: new Date(2024, 0, 10) };
    const leafB: TimelineNode = { id: 'b', start: new Date(2024, 0, 20), end: new Date(2024, 0, 25) };
    const parent: TimelineNode = { id: 'p', children: [leafA, leafB] };

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

  it('[CRITICAL-2] rango 1-ene → 1-feb (el final cae EXACTO en el 1º de un mes): NO produce ticks duplicados', () => {
    const range = { start: new Date(2024, 0, 1).getTime(), end: new Date(2024, 1, 1).getTime() };
    const ticks = computeMonthAxisTicks(range);

    // Sin el fix: el bucle agrega un tick en 1-feb (leftPct=100) Y LUEGO se
    // agrega SIEMPRE un tick final también en 1-feb/leftPct=100 → duplicado
    // (colisiona con @for track de timeline.component.ts → NG0955 en dev).
    const keys = ticks.map((t) => `${t.leftPct}|${t.year}-${t.month}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ticks[ticks.length - 1]).toEqual(expect.objectContaining({ leftPct: 100, year: 2024, month: 1 }));
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

  it('[WARNING] un status NO-string (dato futuro/malformado) no lanza TypeError — cae a neutral', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => defaultStatusToken(42 as any)).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(defaultStatusToken(42 as any)).toBe(defaultStatusToken(undefined));
  });
});

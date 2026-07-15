import {
  buildOffsets,
  classifyItemsChange,
  computeWindow,
  findIndexAt,
  isAtBottom,
  resolveHeights,
} from './virtual-window';

/**
 * Especificación del CÁLCULO PURO de la ventana visible de
 * `sol-virtual-scroll` (E5). El componente delega toda la matemática en
 * estas funciones: alturas estimadas + medidas, prefix-sums de offsets,
 * búsqueda binaria del primer ítem visible, ventana con buffer, detección
 * de fondo (anclaje tipo chat) y clasificación de cambios de lista
 * (append/prepend/reset) para el anclaje y el chip "mensajes nuevos".
 */
describe('virtual-window (funciones puras)', () => {
  describe('resolveHeights', () => {
    it('usa la altura estimada cuando no hay medición', () => {
      expect(resolveHeights(3, 50, new Map())).toEqual([50, 50, 50]);
    });

    it('prefiere la altura MEDIDA sobre la estimada, por clave', () => {
      const measured = new Map<string | number, number>([
        ['m1', 80],
        ['m3', 20],
      ]);
      const keys = ['m0', 'm1', 'm2', 'm3'];
      expect(resolveHeights(4, 50, measured, i => keys[i])).toEqual([50, 80, 50, 20]);
    });

    it('ignora mediciones no positivas (jsdom u ocultos): cae a la estimada', () => {
      const measured = new Map<string | number, number>([
        [0, 0],
        [1, -5],
      ]);
      expect(resolveHeights(2, 40, measured)).toEqual([40, 40]);
    });

    it('con cero ítems devuelve lista vacía', () => {
      expect(resolveHeights(0, 50, new Map())).toEqual([]);
    });
  });

  describe('buildOffsets', () => {
    it('devuelve prefix-sums con longitud count+1 (el último es la altura total)', () => {
      expect(buildOffsets([10, 20, 30])).toEqual([0, 10, 30, 60]);
    });

    it('lista vacía → [0] (altura total 0)', () => {
      expect(buildOffsets([])).toEqual([0]);
    });
  });

  describe('findIndexAt (búsqueda binaria)', () => {
    const offsets = buildOffsets([10, 20, 30, 40]); // [0,10,30,60,100]

    it('encuentra el ítem que contiene la coordenada y', () => {
      expect(findIndexAt(offsets, 0)).toBe(0);
      expect(findIndexAt(offsets, 9)).toBe(0);
      expect(findIndexAt(offsets, 10)).toBe(1); // borde exacto: inicia el ítem 1
      expect(findIndexAt(offsets, 29)).toBe(1);
      expect(findIndexAt(offsets, 30)).toBe(2);
      expect(findIndexAt(offsets, 99)).toBe(3);
    });

    it('clampa por debajo de 0 y por encima de la altura total', () => {
      expect(findIndexAt(offsets, -50)).toBe(0);
      expect(findIndexAt(offsets, 100)).toBe(3);
      expect(findIndexAt(offsets, 10_000)).toBe(3);
    });

    it('sin ítems devuelve 0', () => {
      expect(findIndexAt([0], 42)).toBe(0);
    });
  });

  describe('computeWindow', () => {
    // 100 ítems de 50 px → total 5000 px.
    const offsets = buildOffsets(Array.from({ length: 100 }, () => 50));

    it('renderiza solo los ítems visibles + buffer, con espaciadores correctos', () => {
      // Viewport 400 px en scrollTop 1000, buffer 100 px:
      // rango visible [1000, 1400], con buffer [900, 1500] → ítems 18..29.
      const w = computeWindow(offsets, 1000, 400, 100);
      expect(w.start).toBe(18);
      expect(w.end).toBe(30); // exclusivo
      expect(w.padTop).toBe(900); // 18 * 50
      expect(w.padBottom).toBe(5000 - 30 * 50);
      expect(w.totalHeight).toBe(5000);
    });

    it('el invariante se mantiene: padTop + alto renderizado + padBottom = total', () => {
      const w = computeWindow(offsets, 3777, 350, 240);
      const rendered = (w.end - w.start) * 50;
      expect(w.padTop + rendered + w.padBottom).toBe(w.totalHeight);
    });

    it('clampa al inicio de la lista (scrollTop 0, buffer no produce índices negativos)', () => {
      const w = computeWindow(offsets, 0, 400, 200);
      expect(w.start).toBe(0);
      expect(w.padTop).toBe(0);
      expect(w.end).toBe(12); // [0, 600] → 12 ítems
    });

    it('clampa al final de la lista', () => {
      const w = computeWindow(offsets, 4900, 400, 200);
      expect(w.end).toBe(100);
      expect(w.padBottom).toBe(0);
    });

    it('con alturas variables usa los offsets reales', () => {
      // Ítems: 100, 20, 300, 40, 500 → offsets [0,100,120,420,460,960].
      const variable = buildOffsets([100, 20, 300, 40, 500]);
      // Viewport 200 px en scrollTop 150 sin buffer → rango [150, 350] → solo ítem 2.
      const w = computeWindow(variable, 150, 200, 0);
      expect(w.start).toBe(2);
      expect(w.end).toBe(3);
      expect(w.padTop).toBe(120);
      // padBottom = total - offset del fin exclusivo (ítem 3 inicia en 420).
      expect(w.padBottom).toBe(960 - 420);
    });

    it('lista vacía → ventana vacía sin espaciadores', () => {
      const w = computeWindow([0], 0, 400, 200);
      expect(w).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0, totalHeight: 0 });
    });

    it('viewport 0 (aún sin medir) renderiza al menos el rango del buffer', () => {
      const w = computeWindow(offsets, 0, 0, 200);
      expect(w.start).toBe(0);
      expect(w.end).toBeGreaterThan(0);
    });
  });

  describe('isAtBottom (anclaje tipo chat)', () => {
    it('true exactamente al fondo', () => {
      expect(isAtBottom(4600, 400, 5000)).toBe(true);
    });

    it('true dentro del umbral de tolerancia', () => {
      expect(isAtBottom(4580, 400, 5000, 32)).toBe(true);
    });

    it('false cuando el usuario scrolleó hacia arriba más allá del umbral', () => {
      expect(isAtBottom(4000, 400, 5000, 32)).toBe(false);
    });

    it('true cuando el contenido es más corto que el viewport (no hay scroll)', () => {
      expect(isAtBottom(0, 400, 300)).toBe(true);
    });
  });

  describe('classifyItemsChange (append/prepend/reset)', () => {
    it('lista previa vacía → reset (carga inicial)', () => {
      expect(classifyItemsChange([], ['a', 'b'])).toEqual({
        reset: true,
        prepended: 0,
        appended: 0,
      });
    });

    it('append puro: mensajes nuevos llegan al final', () => {
      expect(classifyItemsChange(['a', 'b'], ['a', 'b', 'c', 'd'])).toEqual({
        reset: false,
        prepended: 0,
        appended: 2,
      });
    });

    it('prepend puro: paginación hacia atrás agrega mensajes antiguos arriba', () => {
      expect(classifyItemsChange(['c', 'd'], ['a', 'b', 'c', 'd'])).toEqual({
        reset: false,
        prepended: 2,
        appended: 0,
      });
    });

    it('prepend y append simultáneos (paginación + evento SSE en el mismo tick)', () => {
      expect(classifyItemsChange(['c'], ['a', 'b', 'c', 'd'])).toEqual({
        reset: false,
        prepended: 2,
        appended: 1,
      });
    });

    it('sin cambios estructurales (solo estado interno) → none', () => {
      expect(classifyItemsChange(['a', 'b'], ['a', 'b'])).toEqual({
        reset: false,
        prepended: 0,
        appended: 0,
      });
    });

    it('lista reemplazada (cambio de conversación) → reset', () => {
      expect(classifyItemsChange(['a', 'b'], ['x', 'y', 'z'])).toEqual({
        reset: true,
        prepended: 0,
        appended: 0,
      });
    });

    it('mutación en el medio (borrado) → reset conservador', () => {
      // 'a' sigue de primera pero el mapeo contiguo se rompió.
      expect(classifyItemsChange(['a', 'b', 'c'], ['a', 'c'])).toEqual({
        reset: true,
        prepended: 0,
        appended: 0,
      });
    });
  });
});

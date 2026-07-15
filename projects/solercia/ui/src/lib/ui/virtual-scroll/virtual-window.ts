/**
 * Matemática PURA de `sol-virtual-scroll` (E5) — sin DOM, sin Angular.
 *
 * El componente delega aquí todo el cálculo: resolución de alturas
 * (estimada + medida), offsets por prefix-sums, búsqueda binaria del primer
 * ítem visible, ventana renderizada con buffer, detección de "estar al
 * fondo" (anclaje tipo chat) y clasificación de cambios de lista
 * (append/prepend/reset) que gobiernan el anclaje y el chip
 * "mensajes nuevos".
 */

/** Ventana de ítems a renderizar + espaciadores que preservan el scroll. */
export interface VirtualWindow {
  /** Primer índice renderizado (inclusivo). */
  start: number;
  /** Último índice renderizado (exclusivo). */
  end: number;
  /** Alto en px del espaciador superior (ítems no renderizados arriba). */
  padTop: number;
  /** Alto en px del espaciador inferior (ítems no renderizados abajo). */
  padBottom: number;
  /** Alto total del contenido en px. */
  totalHeight: number;
}

/** Resultado de comparar la lista previa con la nueva (por claves). */
export interface ItemsChange {
  /** La lista fue reemplazada (o mutada en el medio): re-anclar desde cero. */
  reset: boolean;
  /** Cuántos ítems se agregaron ARRIBA (paginación hacia atrás). */
  prepended: number;
  /** Cuántos ítems se agregaron ABAJO (mensajes nuevos). */
  appended: number;
}

/**
 * Altura por ítem: la MEDIDA (por clave) manda; si no existe o no es
 * positiva (jsdom, elementos ocultos), cae a la estimada.
 */
export function resolveHeights(
  count: number,
  estimatedHeight: number,
  measured: ReadonlyMap<string | number, number>,
  keyAt: (index: number) => string | number = i => i,
): number[] {
  const heights = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    const m = measured.get(keyAt(i));
    heights[i] = m !== undefined && m > 0 ? m : estimatedHeight;
  }
  return heights;
}

/**
 * Prefix-sums de alturas: `offsets[i]` es el borde superior del ítem `i`
 * y `offsets[count]` es la altura total. Longitud SIEMPRE count+1.
 */
export function buildOffsets(heights: readonly number[]): number[] {
  const offsets = new Array<number>(heights.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < heights.length; i++) {
    offsets[i + 1] = offsets[i] + heights[i];
  }
  return offsets;
}

/**
 * Índice del ítem que contiene la coordenada vertical `y` (búsqueda
 * binaria sobre los offsets). Clampa a [0, count-1]; con lista vacía
 * devuelve 0.
 */
export function findIndexAt(offsets: readonly number[], y: number): number {
  const count = offsets.length - 1;
  if (count <= 0) return 0;
  if (y <= 0) return 0;
  if (y >= offsets[count]) return count - 1;

  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= y) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * Ventana a renderizar: ítems que intersectan `[scrollTop - buffer,
 * scrollTop + viewportHeight + buffer]`, con espaciadores que mantienen el
 * alto total (invariante: padTop + renderizado + padBottom = totalHeight
 * cuando todas las alturas son exactas).
 */
export function computeWindow(
  offsets: readonly number[],
  scrollTop: number,
  viewportHeight: number,
  bufferPx: number,
): VirtualWindow {
  const count = offsets.length - 1;
  const totalHeight = count > 0 ? offsets[count] : 0;
  if (count <= 0) {
    return { start: 0, end: 0, padTop: 0, padBottom: 0, totalHeight: 0 };
  }

  const rangeTop = Math.max(0, scrollTop - bufferPx);
  const rangeBottom = Math.min(totalHeight, scrollTop + viewportHeight + bufferPx);

  const start = findIndexAt(offsets, rangeTop);
  // Último ítem cuyo borde superior queda ANTES del límite inferior.
  const end = Math.min(count, findIndexAt(offsets, Math.max(rangeBottom - 1, 0)) + 1);

  return {
    start,
    end,
    padTop: offsets[start],
    padBottom: totalHeight - offsets[end],
    totalHeight,
  };
}

/**
 * ¿El usuario está (visualmente) al fondo? Regla del anclaje tipo chat:
 * si el contenido no desborda el viewport, siempre está al fondo.
 */
export function isAtBottom(
  scrollTop: number,
  viewportHeight: number,
  totalHeight: number,
  thresholdPx = 32,
): boolean {
  if (totalHeight <= viewportHeight) return true;
  return scrollTop + viewportHeight >= totalHeight - thresholdPx;
}

/**
 * Clasifica el cambio de la lista comparando claves estables:
 * - `reset`: lista previa vacía, reemplazada o mutada en el medio.
 * - `prepended`: ítems agregados arriba (paginación hacia atrás).
 * - `appended`: ítems agregados abajo (mensajes nuevos).
 * Soporta prepend + append simultáneos (paginación + evento en el mismo
 * tick). Ante cualquier ambigüedad clasifica como reset (conservador).
 */
export function classifyItemsChange(
  prev: readonly (string | number)[],
  next: readonly (string | number)[],
): ItemsChange {
  const none: ItemsChange = { reset: false, prepended: 0, appended: 0 };
  const reset: ItemsChange = { reset: true, prepended: 0, appended: 0 };

  if (prev.length === 0) return reset;
  if (prev.length === next.length && prev[0] === next[0] && prev[prev.length - 1] === next[next.length - 1]) {
    return none;
  }

  const k = next.indexOf(prev[0]);
  if (k === -1) return reset;

  const lastIdx = k + prev.length - 1;
  // La lista previa debe seguir contigua dentro de la nueva.
  if (lastIdx >= next.length || next[lastIdx] !== prev[prev.length - 1]) {
    return reset;
  }

  return {
    reset: false,
    prepended: k,
    appended: next.length - 1 - lastIdx,
  };
}

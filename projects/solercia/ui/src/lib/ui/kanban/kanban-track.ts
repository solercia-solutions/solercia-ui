/**
 * `track` seguro para `@for` sobre datos del consumidor (items/columnas) cuyo
 * `id` no está garantizado único ni presente en runtime (dato optimista,
 * API externa malformada, etc.). Sin esta guarda, un `id` duplicado o
 * ausente hace que el reconciliador de Angular lance `NG0955` (clave de
 * `track` duplicada) en vez de degradar — mismo espíritu que las guardas de
 * `null`/`undefined` del resto de `sol-kanban-*` (lecciones PR3/PR4).
 *
 * Estrategia: cae al ÍNDICE de la iteración cuando el `id` está ausente o
 * repetido dentro del mismo arreglo — nunca lanza. El costo es que un item
 * con `id` duplicado pierde la identidad ESTABLE de `track` entre renders
 * (puede "saltar" de posición visualmente si el arreglo se reordena), pero
 * eso es preferible a que el tablero completo reviente.
 */

/** Cuenta cuántas veces aparece cada `id` en `items` (ignora entradas `null`/`undefined`). */
export function countIds<I extends { id?: unknown } | null | undefined>(items: readonly I[]): Map<unknown, number> {
  const frequency = new Map<unknown, number>();
  for (const item of items) {
    if (!item) continue;
    const key = item.id;
    frequency.set(key, (frequency.get(key) ?? 0) + 1);
  }
  return frequency;
}

/** Clave de `track` segura: el índice si `id` está ausente o duplicado; si no, el propio `id`. */
export function safeTrackKey(id: unknown, index: number, frequency: ReadonlyMap<unknown, number>): unknown {
  if (id == null) return index;
  return (frequency.get(id) ?? 0) > 1 ? index : id;
}

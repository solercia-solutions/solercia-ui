import { Injectable } from '@angular/core';
import type { KanbanColumn, KanbanItem, KanbanItemMoved } from './kanban.model';

/**
 * Evento de drop CRUDO — SIN tipos de `@angular/cdk/drag-drop` — que
 * `sol-kanban-column` emite hacia `sol-kanban-board` tras extraer los campos
 * relevantes de un `CdkDragDrop` real (spec: solercia-ui-kanban#Arrastrar y
 * soltar encapsulado — "NO DEBE filtrar tipos de CDK en su API pública"). El
 * único archivo que conoce `CdkDragDrop` es `kanban-column.component.ts`
 * (dentro de `ui/kanban/`, autorizado por el gate T40); este tipo y el
 * servicio de abajo son CDK-free por diseño, testeables sin DOM.
 */
export interface KanbanRawDropEvent {
  fromColumnId: string;
  toColumnId: string;
  previousIndex: number;
  currentIndex: number;
}

/** Resultado de aplicar un `KanbanRawDropEvent`: columnas con NUEVA referencia + el evento público a emitir. */
export interface KanbanReorderResult<T extends KanbanItem = KanbanItem> {
  columns: KanbanColumn<T>[];
  moved: KanbanItemMoved<T>;
}

/**
 * `KanbanReorderService` — transforma `(columns, KanbanRawDropEvent)` en un
 * nuevo arreglo de columnas + el `KanbanItemMoved` a emitir (spec: D4 del
 * design — "la transformación `CdkDragDrop → KanbanItemMoved` se extrae a
 * `KanbanReorderService` PURO, sin DOM, testeable en aislamiento").
 *
 * Cubre los 2 escenarios obligatorios del spec:
 * - mover una tarjeta ENTRE columnas (`fromColumnId !== toColumnId`)
 * - reordenar DENTRO de la misma columna (`fromColumnId === toColumnId`)
 *
 * NO muta los arreglos de entrada: siempre devuelve columnas/arreglos NUEVOS
 * (spread), para que el componente pueda hacer `mirroredColumns.set(...)`
 * con una referencia distinta y disparar la reactividad de signals.
 *
 * Optimista + rollback (D4): este servicio NO persiste nada — el consumidor
 * de `sol-kanban-board` recibe `itemMoved`, hace su PATCH y, si falla,
 * reasigna `[columns]` a la referencia PREVIA; el `effect` del board
 * (D4, siempre re-siembra el espejo) recompone el espejo desde esa
 * referencia anterior = rollback automático. A diferencia de `sol-timeline`
 * (donde re-sembrar en cada cambio era el BUG, PR4), en `sol-kanban` es el
 * comportamiento CORRECTO desde PR5a: es precisamente lo que permite este
 * rollback sin lógica adicional en el board.
 *
 * Robustez (lecciones PR3/PR4/PR5a): columnas ausentes/vacías, columna
 * origen/destino inexistente, índice fuera de rango o item ausente en el
 * índice indicado → devuelve `null` (no-op); el llamador simplemente ignora
 * un resultado `null` sin romper el tablero.
 */
@Injectable({ providedIn: 'root' })
export class KanbanReorderService {
  reorder<T extends KanbanItem>(
    columns: readonly KanbanColumn<T>[] | null | undefined,
    event: KanbanRawDropEvent | null | undefined,
  ): KanbanReorderResult<T> | null {
    if (!event) return null;
    const list = (columns ?? []).filter((column): column is KanbanColumn<T> => !!column);

    const fromIndex = list.findIndex((column) => column.id === event.fromColumnId);
    const toIndex = list.findIndex((column) => column.id === event.toColumnId);
    if (fromIndex === -1 || toIndex === -1) return null;

    const fromItems = [...(list[fromIndex].items ?? [])];
    if (event.previousIndex < 0 || event.previousIndex >= fromItems.length) return null;

    const [item] = fromItems.splice(event.previousIndex, 1);
    if (!item) return null;

    const sameColumn = fromIndex === toIndex;
    const toItems = sameColumn ? fromItems : [...(list[toIndex].items ?? [])];
    const insertAt = Math.max(0, Math.min(event.currentIndex, toItems.length));
    toItems.splice(insertAt, 0, item);

    const nextColumns = list.map((column, index) => {
      if (sameColumn && index === fromIndex) return { ...column, items: toItems };
      if (!sameColumn && index === fromIndex) return { ...column, items: fromItems };
      if (!sameColumn && index === toIndex) return { ...column, items: toItems };
      return column;
    });

    return {
      columns: nextColumns,
      moved: {
        item,
        fromColumnId: event.fromColumnId,
        toColumnId: event.toColumnId,
        previousIndex: event.previousIndex,
        // `insertAt` (CLAMPADO), no `event.currentIndex` crudo: el select
        // accesible de `sol-kanban-column` pide "mover al final" con
        // `Number.MAX_SAFE_INTEGER` (corrección 4R CRITICAL) — reportar ese
        // valor crudo en el `itemMoved` público sería inútil/engañoso para
        // un consumidor que sincroniza su propio estado con el índice real.
        currentIndex: insertAt,
      },
    };
  }
}

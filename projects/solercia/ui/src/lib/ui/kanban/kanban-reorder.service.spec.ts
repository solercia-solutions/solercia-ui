import { KanbanReorderService, type KanbanRawDropEvent } from './kanban-reorder.service';
import type { KanbanColumn } from './kanban.model';

interface DemoItem {
  id: string;
  title: string;
}

function columns(): KanbanColumn<DemoItem>[] {
  return [
    { id: 'A', title: 'Columna A', items: [{ id: '1', title: 'Uno' }, { id: '2', title: 'Dos' }, { id: '3', title: 'Tres' }] },
    { id: 'B', title: 'Columna B', items: [{ id: '4', title: 'Cuatro' }] },
  ];
}

describe('KanbanReorderService (puro, sin CDK ni DOM)', () => {
  let service: KanbanReorderService;

  beforeEach(() => {
    service = new KanbanReorderService();
  });

  it('[spec] mover tarjeta entre columnas: fromColumnId="A" → toColumnId="B" con el índice destino correcto', () => {
    const event: KanbanRawDropEvent = { fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 1 };
    const result = service.reorder(columns(), event);

    expect(result).not.toBeNull();
    expect(result!.moved).toEqual({
      item: { id: '1', title: 'Uno' },
      fromColumnId: 'A',
      toColumnId: 'B',
      previousIndex: 0,
      currentIndex: 1,
    });
    expect(result!.columns.find((c) => c.id === 'A')!.items.map((i) => i.id)).toEqual(['2', '3']);
    expect(result!.columns.find((c) => c.id === 'B')!.items.map((i) => i.id)).toEqual(['4', '1']);
  });

  it('[spec] reordenar dentro de la misma columna: fromColumnId === toColumnId, primera tarjeta a la 3ª posición', () => {
    const original = columns();
    const event: KanbanRawDropEvent = { fromColumnId: 'A', toColumnId: 'A', previousIndex: 0, currentIndex: 2 };
    const result = service.reorder(original, event);

    expect(result).not.toBeNull();
    expect(result!.moved.fromColumnId).toBe(result!.moved.toColumnId);
    expect(result!.moved).toEqual({
      item: { id: '1', title: 'Uno' },
      fromColumnId: 'A',
      toColumnId: 'A',
      previousIndex: 0,
      currentIndex: 2,
    });
    expect(result!.columns.find((c) => c.id === 'A')!.items.map((i) => i.id)).toEqual(['2', '3', '1']);
    // La otra columna no está involucrada: conserva la MISMA referencia de arreglo de items.
    expect(result!.columns.find((c) => c.id === 'B')!.items).toBe(original[1].items);
  });

  it('no muta los arreglos de entrada: `columns` original queda intacto tras un cross-column move', () => {
    const original = columns();
    const originalASnapshot = original[0].items.map((i) => i.id);
    const originalBSnapshot = original[1].items.map((i) => i.id);

    service.reorder(original, { fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 0 });

    expect(original[0].items.map((i) => i.id)).toEqual(originalASnapshot);
    expect(original[1].items.map((i) => i.id)).toEqual(originalBSnapshot);
  });

  it('devuelve columnas con referencia NUEVA (permite `mirroredColumns.set()` reactivo)', () => {
    const original = columns();
    const result = service.reorder(original, { fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 0 });

    expect(result!.columns).not.toBe(original);
    expect(result!.columns.find((c) => c.id === 'A')).not.toBe(original[0]);
  });

  it('[robustez] event null/undefined → devuelve null sin lanzar', () => {
    expect(service.reorder(columns(), null)).toBeNull();
    expect(service.reorder(columns(), undefined)).toBeNull();
  });

  it('[robustez] columns null/undefined → devuelve null sin lanzar', () => {
    const event: KanbanRawDropEvent = { fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 0 };
    expect(() => service.reorder(null, event)).not.toThrow();
    expect(service.reorder(null, event)).toBeNull();
    expect(service.reorder(undefined, event)).toBeNull();
  });

  it('[robustez] un elemento null dentro de `columns` se filtra sin lanzar', () => {
    const withNull = [null as unknown as KanbanColumn<DemoItem>, ...columns()];
    const event: KanbanRawDropEvent = { fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 0 };
    expect(() => service.reorder(withNull, event)).not.toThrow();
    expect(service.reorder(withNull, event)).not.toBeNull();
  });

  it('[robustez] fromColumnId inexistente → devuelve null (no-op)', () => {
    const event: KanbanRawDropEvent = { fromColumnId: 'inexistente', toColumnId: 'B', previousIndex: 0, currentIndex: 0 };
    expect(service.reorder(columns(), event)).toBeNull();
  });

  it('[robustez] toColumnId inexistente → devuelve null (no-op)', () => {
    const event: KanbanRawDropEvent = { fromColumnId: 'A', toColumnId: 'inexistente', previousIndex: 0, currentIndex: 0 };
    expect(service.reorder(columns(), event)).toBeNull();
  });

  it('[robustez] previousIndex fuera de rango (negativo o ≥ length) → devuelve null', () => {
    expect(service.reorder(columns(), { fromColumnId: 'A', toColumnId: 'A', previousIndex: -1, currentIndex: 0 })).toBeNull();
    expect(service.reorder(columns(), { fromColumnId: 'A', toColumnId: 'A', previousIndex: 99, currentIndex: 0 })).toBeNull();
  });

  it('[robustez] columna origen vacía (items=[]) → previousIndex 0 está fuera de rango, devuelve null', () => {
    const withEmpty: KanbanColumn<DemoItem>[] = [{ id: 'A', title: 'Vacía', items: [] }, { id: 'B', title: 'B', items: [] }];
    expect(service.reorder(withEmpty, { fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 0 })).toBeNull();
  });

  it('[robustez] currentIndex negativo o mayor al tamaño destino se clampa (no lanza, inserta en el borde válido)', () => {
    const event: KanbanRawDropEvent = { fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 999 };
    const result = service.reorder(columns(), event);
    expect(result).not.toBeNull();
    expect(result!.columns.find((c) => c.id === 'B')!.items.map((i) => i.id)).toEqual(['4', '1']);
  });

  it('[robustez] column.items ausente (undefined en runtime pese al tipo) no lanza — se trata como vacía', () => {
    const malformed = [
      { id: 'A', title: 'A', items: undefined as unknown as DemoItem[] },
      { id: 'B', title: 'B', items: [{ id: '9', title: 'Nueve' }] },
    ];
    expect(() => service.reorder(malformed, { fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 0 })).not.toThrow();
    expect(service.reorder(malformed, { fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 0 })).toBeNull();
  });

  it('mover al MISMO índice (drop sin cambio real) sigue devolviendo un resultado consistente, sin lanzar', () => {
    const event: KanbanRawDropEvent = { fromColumnId: 'A', toColumnId: 'A', previousIndex: 0, currentIndex: 0 };
    const result = service.reorder(columns(), event);
    expect(result).not.toBeNull();
    expect(result!.columns.find((c) => c.id === 'A')!.items.map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  it('mover la ÚLTIMA tarjeta de una columna a otra dentro de un board de 3+ columnas: solo las 2 involucradas cambian', () => {
    const three: KanbanColumn<DemoItem>[] = [
      { id: 'A', title: 'A', items: [{ id: '1', title: 'Uno' }] },
      { id: 'B', title: 'B', items: [{ id: '2', title: 'Dos' }] },
      { id: 'C', title: 'C', items: [{ id: '3', title: 'Tres' }] },
    ];
    const result = service.reorder(three, { fromColumnId: 'A', toColumnId: 'C', previousIndex: 0, currentIndex: 1 });

    expect(result).not.toBeNull();
    expect(result!.columns.find((c) => c.id === 'A')!.items).toEqual([]);
    expect(result!.columns.find((c) => c.id === 'B')!.items.map((i) => i.id)).toEqual(['2']);
    expect(result!.columns.find((c) => c.id === 'C')!.items.map((i) => i.id)).toEqual(['3', '1']);
    // La columna intermedia (B), no involucrada, conserva la MISMA referencia de arreglo.
    expect(result!.columns.find((c) => c.id === 'B')!.items).toBe(three[1].items);
  });
});

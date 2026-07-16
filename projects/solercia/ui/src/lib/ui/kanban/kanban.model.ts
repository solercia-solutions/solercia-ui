/**
 * Contrato genérico de `sol-kanban-*` (spec: solercia-ui-kanban). Sin
 * conocimiento de dominio: NUNCA referencia `Task`/`Sprint`/`Lead` — el
 * consumidor extiende `KanbanItem` con su propio modelo y proyecta su propio
 * contenido de tarjeta vía `cardTemplate`.
 */

/** Marcador mínimo: cualquier item necesita un `id` estable para `track`. */
export interface KanbanItem {
  id: string | number;
}

/**
 * Columna genérica. `title`/`titleKey` son mutuamente alternativos (mismo
 * patrón que `TimelineNode` del PR4): `title` para texto crudo del
 * consumidor, `titleKey` para una clave i18n cuando el título es texto
 * genérico de UI.
 *
 * `terminalAnchor` marca la columna como ancla terminal (patrón
 * ganada/perdida) SIN que la librería conozca su significado de negocio —
 * el consumidor decide el ícono/etiqueta vía `anchorTemplate` proyectado en
 * `sol-kanban-column`.
 */
export interface KanbanColumn<T extends KanbanItem = KanbanItem> {
  id: string;
  title?: string;
  titleKey?: string;
  items: T[];
  /** Color/token CSS del header y del ancla (p. ej. `var(--sol-color-success)`). Default: tono neutral. */
  accent?: string;
  droppable?: boolean;
  terminalAnchor?: boolean;
}

/**
 * Emitido al soltar una tarjeta arrastrada (cableado real en el PR5b —
 * `@angular/cdk/drag-drop`). Nombres de campo alineados con el spec
 * (`previousIndex`/`currentIndex`, igual que `CdkDragDrop` de CDK).
 */
export interface KanbanItemMoved<T extends KanbanItem = KanbanItem> {
  item: T;
  fromColumnId: string;
  toColumnId: string;
  previousIndex: number;
  currentIndex: number;
}

/** Acción genérica sobre una columna (p. ej. `{columnId, action: 'add'}`) — el string de `action` lo define el consumidor. */
export interface KanbanColumnAction {
  columnId: string;
  action: string;
}

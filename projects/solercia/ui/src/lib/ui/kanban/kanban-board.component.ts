import {
  Component,
  ChangeDetectionStrategy,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import type { KanbanCardTemplateContext } from './kanban-card.component';
import { SolKanbanColumnComponent } from './kanban-column.component';
import {
  KANBAN_ADD_ACTION,
  type KanbanColumn,
  type KanbanColumnAction,
  type KanbanItem,
  type KanbanItemMoved,
} from './kanban.model';
import { KanbanReorderService, type KanbanRawDropEvent } from './kanban-reorder.service';
import { countIds, safeTrackKey } from './kanban-track';

/**
 * `sol-kanban-board` — orquestador de columnas (spec: solercia-ui-kanban).
 * Sin conocimiento de dominio: recibe `columns` genéricas + `cardTemplate`
 * proyectado — nunca referencia `Task`/`Sprint`/`Lead`.
 *
 * Espejo interno (`signal` + `effect`, D4 del design): mantiene una copia
 * propia de `columns()`, re-sembrada en CADA cambio del input — a
 * diferencia de `sol-timeline` (donde re-sembrar en cada cambio era un bug
 * de UX), aquí es el comportamiento CORRECTO: el espejo debe reflejar
 * SIEMPRE la última verdad del input, no un estado "sembrado una vez".
 *
 * DnD (PR5b, D1/D4/T38): `cdkDropListGroup` en el contenedor conecta
 * automáticamente los `cdkDropList` de TODAS las columnas hijas (sin
 * `[cdkDropListConnectedTo]` manual). Cada columna reenvía su drop ya
 * traducido a `KanbanRawDropEvent` (CDK-free) vía `(itemDropped)`; el board
 * delega en `KanbanReorderService` (puro) para calcular el nuevo arreglo de
 * columnas + el `KanbanItemMoved` a emitir, y aplica el resultado SOLO sobre
 * el espejo (`mirroredColumns.set(...)`) — NUNCA sobre `columns()` (el
 * input, que sigue siendo propiedad del consumidor).
 *
 * Optimista + rollback (D4): el board NO persiste nada. El consumidor de
 * `itemMoved` hace su PATCH optimista y, si falla, reasigna `[columns]` a la
 * referencia PREVIA — como el `effect` de abajo SIEMPRE re-siembra el
 * espejo desde `columns()`, esa reasignación deshace automáticamente la
 * actualización optimista del espejo (rollback), sin lógica adicional acá.
 *
 * Robustez de entrada (lecciones PR3/PR4): `columns` tolera `null`/
 * `undefined` (se trata como arreglo vacío); un elemento `null`/`undefined`
 * dentro del arreglo se filtra sin romper el render.
 */
@Component({
  selector: 'sol-kanban-board',
  standalone: true,
  imports: [SolKanbanColumnComponent, CdkDropListGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-kanban-board" cdkDropListGroup>
      @for (column of mirroredColumns(); track trackColumn(column, $index)) {
        <sol-kanban-column
          [column]="column"
          [cardTemplate]="cardTemplate()"
          [headerTemplate]="headerTemplate()"
          [anchorTemplate]="anchorTemplate()"
          [emptyTemplate]="emptyTemplate()"
          (action)="onColumnAction($event)"
          (itemDropped)="onItemDropped($event)"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sol-kanban-board {
      display: flex;
      align-items: flex-start;
      gap: var(--sol-space-md, 12px);
      overflow-x: auto;
      padding-bottom: var(--sol-space-sm, 8px);
    }
  `,
})
export class SolKanbanBoardComponent<T extends KanbanItem = KanbanItem> {
  /** Tolera `null`/`undefined` (lección PR3/PR4): `input.required()` no garantiza no-nulo en runtime. */
  readonly columns = input.required<KanbanColumn<T>[] | null | undefined>();

  readonly cardTemplate = input.required<TemplateRef<KanbanCardTemplateContext<T>>>();

  readonly headerTemplate = input<TemplateRef<{ $implicit: KanbanColumn<T> | null | undefined }> | null>(null);

  /**
   * Template del ancla terminal (ganada/perdida/etc.), reenviado tal cual a
   * `sol-kanban-column`. Sin este reenvío, un consumidor que arme su
   * pipeline vía `sol-kanban-board` (en vez de `sol-kanban-column` directo)
   * no podría usar el ancla terminal sin tocar la librería — violaría el
   * objetivo O ("agregar dominio = pasar templates, sin tocar el
   * componente"). La columna YA soportaba `anchorTemplate`; solo faltaba
   * exponerlo/reenviarlo desde el board.
   */
  readonly anchorTemplate = input<TemplateRef<{ $implicit: KanbanColumn<T> | null | undefined }> | null>(null);

  readonly emptyTemplate = input<TemplateRef<unknown> | null>(null);

  readonly columnAction = output<KanbanColumnAction>();

  /** Atajo de conveniencia: se re-emite cada vez que llega `columnAction` con `action === 'add'`. */
  readonly addRequested = output<string>();

  /**
   * Único output público del arrastre (spec#Arrastrar y soltar encapsulado
   * — "DEBE exponer únicamente un output tipado `itemMoved`"). El board NO
   * persiste: el consumidor hace el PATCH optimista y, ante error, reasigna
   * `[columns]` para el rollback (ver doc de la clase).
   */
  readonly itemMoved = output<KanbanItemMoved<T>>();

  private readonly reorderService = inject(KanbanReorderService);

  /** `protected` (no `private`): el template de este mismo componente necesita leerlo, y Angular exige acceso no-privado para bindings de plantilla. */
  protected readonly mirroredColumns = signal<KanbanColumn<T>[]>([]);

  constructor() {
    effect(() => {
      const incoming = (this.columns() ?? []).filter((c): c is KanbanColumn<T> => !!c);
      this.mirroredColumns.set(incoming);
    });
  }

  /** Frecuencia de `id` entre las columnas actuales — soporte de `trackColumn` (fix NG0955 con id duplicado/ausente). */
  private readonly columnIdFrequency = computed(() => countIds(this.mirroredColumns()));

  /** `track` seguro: cae al índice si el `id` de la columna está ausente o duplicado. */
  trackColumn(column: KanbanColumn<T>, index: number): unknown {
    return safeTrackKey(column?.id, index, this.columnIdFrequency());
  }

  onColumnAction(action: KanbanColumnAction): void {
    this.columnAction.emit(action);
    if (action.action === KANBAN_ADD_ACTION) {
      this.addRequested.emit(action.columnId);
    }
  }

  /**
   * Delega en `KanbanReorderService` (puro): si el evento es válido (columna
   * origen/destino existen, índice dentro de rango), aplica el resultado
   * SOLO sobre el espejo y emite `itemMoved`. Un resultado `null` (evento
   * inconsistente/columna inexistente) se ignora sin lanzar — mismo espíritu
   * de robustez que el resto de `sol-kanban-*` (lecciones PR3/PR4/PR5a).
   */
  onItemDropped(event: KanbanRawDropEvent): void {
    const result = this.reorderService.reorder(this.mirroredColumns(), event);
    if (!result) return;
    this.mirroredColumns.set(result.columns);
    this.itemMoved.emit(result.moved);
  }
}

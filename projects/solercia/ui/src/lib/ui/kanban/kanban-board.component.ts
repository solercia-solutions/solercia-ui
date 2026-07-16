import {
  Component,
  ChangeDetectionStrategy,
  TemplateRef,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import type { KanbanCardTemplateContext } from './kanban-card.component';
import { SolKanbanColumnComponent } from './kanban-column.component';
import type { KanbanColumn, KanbanColumnAction, KanbanItem } from './kanban.model';

/**
 * `sol-kanban-board` — orquestador de columnas (spec: solercia-ui-kanban).
 * PR5a: render ESTÁTICO de columnas (sin `@angular/cdk/drag-drop`; eso lo
 * agrega el PR5b sobre la MISMA base). Sin conocimiento de dominio: recibe
 * `columns` genéricas + `cardTemplate` proyectado — nunca referencia
 * `Task`/`Sprint`/`Lead`.
 *
 * Espejo interno (`signal` + `effect`, D4 del design): mantiene una copia
 * propia de `columns()`, re-sembrada en CADA cambio del input — a
 * diferencia de `sol-timeline` (donde re-sembrar en cada cambio era un bug
 * de UX), aquí es el comportamiento CORRECTO desde ya: el PR5b mutará este
 * mismo espejo con `moveItemInArray`/`transferArrayItem` de CDK para que la
 * animación de arrastre asiente, y el consumidor hace rollback
 * REASIGNANDO `columns` — el espejo debe reflejar SIEMPRE la última verdad
 * del input, no un estado "sembrado una vez".
 *
 * Robustez de entrada (lecciones PR3/PR4): `columns` tolera `null`/
 * `undefined` (se trata como arreglo vacío); un elemento `null`/`undefined`
 * dentro del arreglo se filtra sin romper el render.
 */
@Component({
  selector: 'sol-kanban-board',
  standalone: true,
  imports: [SolKanbanColumnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-kanban-board">
      @for (column of mirroredColumns(); track column.id) {
        <sol-kanban-column
          [column]="column"
          [cardTemplate]="cardTemplate()"
          [headerTemplate]="headerTemplate()"
          [emptyTemplate]="emptyTemplate()"
          (action)="onColumnAction($event)"
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

  readonly emptyTemplate = input<TemplateRef<unknown> | null>(null);

  readonly columnAction = output<KanbanColumnAction>();

  /** Atajo de conveniencia: se re-emite cada vez que llega `columnAction` con `action === 'add'`. */
  readonly addRequested = output<string>();

  /** `protected` (no `private`): el template de este mismo componente necesita leerlo, y Angular exige acceso no-privado para bindings de plantilla. */
  protected readonly mirroredColumns = signal<KanbanColumn<T>[]>([]);

  constructor() {
    effect(() => {
      const incoming = (this.columns() ?? []).filter((c): c is KanbanColumn<T> => !!c);
      this.mirroredColumns.set(incoming);
    });
  }

  onColumnAction(action: KanbanColumnAction): void {
    this.columnAction.emit(action);
    if (action.action === 'add') {
      this.addRequested.emit(action.columnId);
    }
  }
}

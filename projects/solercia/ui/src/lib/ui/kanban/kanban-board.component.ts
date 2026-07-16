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
  untracked,
} from '@angular/core';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { resolveColumnTitle, SolKanbanColumnComponent } from './kanban-column.component';
import type { KanbanCardTemplateContext } from './kanban-card.component';
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
 * `itemMoved` hace su PATCH optimista y, si falla, DEBE llamar `rollback()`
 * para restaurar el espejo desde el `columns()` actual del input.
 *
 * CORRECCIÓN 4R (WARNING): el `effect` de abajo re-siembra el espejo cuando
 * `columns()` CAMBIA — pero los signal inputs comparan por `Object.is`, así
 * que reasignar la MISMA referencia (p. ej. la que el consumidor ya tenía
 * antes del drop) NO dispara nada: el rollback fallaría en silencio. Por
 * eso `rollback()` NO depende del juego de referencias — fuerza el re-seed
 * leyendo `columns()` directamente, sin pasar por la comparación del
 * signal. El consumidor puede además reasignar una referencia NUEVA (un
 * clon) para lograr el mismo efecto vía el `effect` normal, pero `rollback()`
 * es el mecanismo recomendado y documentado.
 *
 * CORRECCIÓN 4R (WARNING — reseed durante un drag activo): si el consumidor
 * reasigna `columns()` (refresh en vivo) MIENTRAS el usuario arrastra una
 * tarjeta, re-sembrar el espejo de inmediato destruiría/recrearía el nodo
 * DOM que CDK tiene tomado (`@for`), corrompiendo el gesto. Por eso el
 * `effect` de abajo POSPONE el re-seed si `isDragging()` es `true`
 * (guardado en `pendingColumnsSeed`, sin tocar `mirroredColumns` todavía) y
 * lo aplica recién cuando el drag TERMINA (`onCardDragActiveChanged`). La
 * lectura de `isDragging()` usa `untracked()` a propósito: el `effect` NO
 * debe reaccionar a que `isDragging` cambie por sí solo (si reaccionara,
 * CADA fin de drag re-sembraría desde el `columns()` viejo del consumidor y
 * pisaría la actualización optimista que `onItemDropped` ya aplicó — el
 * caso normal de cada drag-and-drop sin refresh en vivo). El `effect` solo
 * debe reaccionar cuando `columns()` mismo cambia.
 *
 * Mecanismo alternativo accesible por teclado (corrección 4R CRITICAL):
 * `cdkDrag` de CDK no soporta teclado — `sol-kanban-column` ofrece un
 * `<select>` nativo por tarjeta que emite el MISMO `itemDropped`. El board
 * anuncia cada `itemMoved` (venga del drag o del select) vía una región
 * `aria-live="polite"` — ver `announcement` y la plantilla.
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
          [allColumns]="mirroredColumns()"
          (action)="onColumnAction($event)"
          (itemDropped)="onItemDropped($event)"
          (dragActiveChanged)="onCardDragActiveChanged($event)"
        />
      }
    </div>
    <div class="sol-kanban-board__announce" aria-live="polite" role="status">{{ announcement() }}</div>
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

    /* Región aria-live visualmente oculta (corrección 4R CRITICAL): anuncia
       cada movimiento (drag real o select accesible) sin ocupar espacio. */
    .sol-kanban-board__announce {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
  private readonly i18n = inject(SOL_I18N);

  /** `protected` (no `private`): el template de este mismo componente necesita leerlo, y Angular exige acceso no-privado para bindings de plantilla. */
  protected readonly mirroredColumns = signal<KanbanColumn<T>[]>([]);

  /** `true` mientras CUALQUIER tarjeta del board está siendo arrastrada (corrección 4R WARNING). */
  private readonly isDragging = signal(false);

  /** Seed diferido: `columns()` que llegó mientras `isDragging()` era `true`, pendiente de aplicar al terminar el drag. `null` = nada pendiente. */
  private pendingColumnsSeed: KanbanColumn<T>[] | null = null;

  /** Anuncio `aria-live` del último movimiento (drag real o select accesible) — corrección 4R CRITICAL. */
  protected readonly announcement = signal('');

  constructor() {
    effect(() => {
      const incoming = (this.columns() ?? []).filter((c): c is KanbanColumn<T> => !!c);
      if (untracked(() => this.isDragging())) {
        // Pospone: ver doc de la clase (CORRECCIÓN 4R — reseed durante un drag activo).
        this.pendingColumnsSeed = incoming;
        return;
      }
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
   * Recibe el MISMO `KanbanRawDropEvent` tanto del drag real (CDK) como del
   * `<select>` accesible de `sol-kanban-column` — ambos caminos comparten
   * exactamente esta lógica y el mismo `itemMoved` (corrección 4R CRITICAL).
   */
  onItemDropped(event: KanbanRawDropEvent): void {
    const result = this.reorderService.reorder(this.mirroredColumns(), event);
    if (!result) return;
    this.mirroredColumns.set(result.columns);
    this.itemMoved.emit(result.moved);
    this.announceMove(result.moved);
  }

  /**
   * Fuerza el re-seed del espejo desde el `columns()` ACTUAL (corrección 4R
   * WARNING) — NO depende de que la referencia cambie (a diferencia del
   * `effect`, que compara por `Object.is`). El consumidor la llama tras un
   * PATCH fallido para deshacer la actualización optimista. Respeta el
   * mismo diferido que el `effect` si hay un drag activo en curso.
   */
  rollback(): void {
    const incoming = (this.columns() ?? []).filter((c): c is KanbanColumn<T> => !!c);
    if (this.isDragging()) {
      this.pendingColumnsSeed = incoming;
      return;
    }
    this.mirroredColumns.set(incoming);
  }

  /**
   * Recibe el `dragActiveChanged` bubbleado desde CADA `sol-kanban-column`
   * (que a su vez lo recibe de cada `sol-kanban-card`). Al terminar el
   * drag (`active === false`), aplica cualquier reseed diferido pendiente
   * (corrección 4R WARNING).
   */
  protected onCardDragActiveChanged(active: boolean): void {
    this.isDragging.set(active);
    if (!active && this.pendingColumnsSeed) {
      this.mirroredColumns.set(this.pendingColumnsSeed);
      this.pendingColumnsSeed = null;
    }
  }

  /** Anuncia el movimiento por `aria-live` (corrección 4R CRITICAL) — mismo texto venga del drag o del select accesible. */
  private announceMove(moved: KanbanItemMoved<T>): void {
    this.i18n.activeLang();
    const toColumn = this.mirroredColumns().find((c) => c.id === moved.toColumnId);
    const columnLabel = resolveColumnTitle(toColumn, (key) => this.i18n.translate(key));
    this.announcement.set(
      moved.fromColumnId === moved.toColumnId
        ? this.i18n.translate('shared.kanban.movedWithinColumn')
        : this.i18n.translate('shared.kanban.movedToColumn', { column: columnLabel }),
    );
  }
}

import { Component, ChangeDetectionStrategy, TemplateRef, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import type { KanbanItem } from './kanban.model';
import { countIds, safeTrackKey } from './kanban-track';

/** Contexto proyectado en `[itemTemplate]` — `$implicit` es el item arrastrable. */
export interface KanbanDragSourceItemContext<T extends KanbanItem = KanbanItem> {
  $implicit: T;
}

/**
 * `sol-kanban-drag-source` — origen de arrastre EXTERNO al tablero (11-g-crm-
 * contactos-y-acciones, PR2 de boki-front, T06): un consumidor AJENO a
 * `sol-kanban-board` (p. ej. una lista de contactos) puede declarar sus
 * propios items como arrastrables y soltarlos sobre las columnas de un
 * tablero YA renderizado en otra parte de la página — conectando
 * `[connectedTo]` a los MISMOS ids de columna que `sol-kanban-board` expone
 * (`KanbanColumn.id`, el `cdkDropList` id interno de `sol-kanban-column`).
 *
 * Sin conocimiento de dominio (mismo criterio que el resto de `ui/kanban/`):
 * NUNCA referencia `Client`/`Lead`/etc. — el consumidor proyecta su propio
 * contenido vía `itemTemplate` y decide qué es un `KanbanItem` para él.
 *
 * `@angular/cdk/drag-drop` vive EXCLUSIVAMENTE aquí dentro de `ui/kanban/`
 * (gate ESLint T40, `no-restricted-imports`) — ninguna vista de una app
 * consumidora puede importar CDK directo; este componente es la ÚNICA
 * puerta para un origen de arrastre EXTERNO al board, igual que
 * `sol-kanban-board`/`sol-kanban-column` lo son para el arrastre INTERNO.
 *
 * `cdkDropListSortingDisabled`: esta lista NUNCA reordena sus propios
 * items por drag (no tiene sentido para un origen — solo transfiere HACIA
 * afuera). La recepción del drop la resuelve la columna DESTINO
 * (`sol-kanban-column`/`sol-kanban-board`, que ya distingue un origen
 * ajeno vía `externalItemDropped` — ver `kanban-board.component.ts`); este
 * componente no necesita saber nada sobre qué pasó con el item soltado.
 */
@Component({
  selector: 'sol-kanban-drag-source',
  standalone: true,
  imports: [CdkDropList, CdkDrag, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="sol-kanban-drag-source"
      cdkDropList
      [id]="listId()"
      [cdkDropListData]="normalizedItems()"
      [cdkDropListConnectedTo]="connectedTo()"
      cdkDropListSortingDisabled
    >
      @for (item of normalizedItems(); track trackItem(item, $index)) {
        <div
          class="sol-kanban-drag-source__item"
          cdkDrag
          [cdkDragData]="item"
          [cdkDragDisabled]="isItemDisabled(item)"
        >
          <ng-container *ngTemplateOutlet="itemTemplate(); context: { $implicit: item }" />
        </div>
      }
    </div>
  `,
  styles: `
    .sol-kanban-drag-source {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-sm, 8px);
    }

    .sol-kanban-drag-source__item {
      cursor: grab;
    }

    .sol-kanban-drag-source__item.cdk-drag-disabled {
      cursor: default;
    }
  `,
})
export class SolKanbanDragSourceComponent<T extends KanbanItem = KanbanItem> {
  /** Items arrastrables — tolera `null`/`undefined` (mismo criterio de robustez que `sol-kanban-board`). */
  readonly items = input.required<T[] | null | undefined>();

  /** Ids de las `cdkDropList` destino (las columnas del tablero AJENO al que soltar). */
  readonly connectedTo = input<string[]>([]);

  /** Template del contenido de cada item — el consumidor decide qué renderiza (sin conocimiento de dominio acá). */
  readonly itemTemplate = input.required<TemplateRef<KanbanDragSourceItemContext<T>>>();

  /** Ids de items NO arrastrables (p. ej. "ya en pipeline") — comparados por `KanbanItem.id`. */
  readonly disabledIds = input<ReadonlySet<string | number>>(new Set());

  /** `id` de la `cdkDropList` propia — normalmente irrelevante (nadie se conecta HACIA ella), pero CDK lo exige. */
  readonly listId = input<string>('sol-kanban-drag-source');

  /** `protected` (no `private`): el template propio necesita leerlo — Angular exige acceso no-privado para bindings de plantilla. */
  protected readonly normalizedItems = computed(() => (this.items() ?? []).filter((i): i is T => !!i));

  private readonly itemIdFrequency = computed(() => countIds(this.normalizedItems()));

  trackItem(item: T, index: number): unknown {
    return safeTrackKey(item?.id, index, this.itemIdFrequency());
  }

  protected isItemDisabled(item: T): boolean {
    return this.disabledIds().has(item.id);
  }
}

import {
  Component,
  ChangeDetectionStrategy,
  TemplateRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { TONE_COLOR } from '../tone/sol-tone';
import { SolKanbanCardComponent, type KanbanCardTemplateContext } from './kanban-card.component';
import { KANBAN_ADD_ACTION, type KanbanColumn, type KanbanColumnAction, type KanbanItem } from './kanban.model';
import type { KanbanRawDropEvent } from './kanban-reorder.service';
import { countIds, safeTrackKey } from './kanban-track';

/** Resuelve el título de una columna: `titleKey` (i18n) > `title` (crudo) > `''`. Tolera `column` inválido/no-string. */
function resolveColumnTitle(column: KanbanColumn | null | undefined, translate: (key: string) => string): string {
  if (!column) return '';
  if (typeof column.titleKey === 'string' && column.titleKey) return translate(column.titleKey);
  if (typeof column.title === 'string') return column.title;
  return '';
}

/**
 * `sol-kanban-column` — una columna con su lista de tarjetas, contador,
 * header y empty-state (spec: solercia-ui-kanban).
 *
 * `cdkDropList` (PR5b, D1/T38): el contenedor de items es un drop-list de
 * CDK — `[id]` (= `column.id`, usado por el board para resolver
 * origen/destino sin filtrar tipos de CDK), `[cdkDropListData]` (los items
 * actuales) y `[cdkDropListDisabled]` (respeta `column.droppable === false`).
 * `(cdkDropListDropped)` se traduce a un `KanbanRawDropEvent` CDK-free antes
 * de reenviarse al board vía `itemDropped` — este archivo y
 * `kanban-card.component.ts` son los ÚNICOS autorizados a importar
 * `@angular/cdk/drag-drop` (gate ESLint T40). `(cdkDropListEntered)`/
 * `(cdkDropListExited)` alimentan el anillo de columna-destino activa
 * (spec#UX de arrastre del vocero).
 *
 * `terminalAnchor` + `anchorTemplate` proyectado: la columna NUNCA conoce el
 * significado de negocio de un ancla (ganada/perdida/etc.) — solo renderiza
 * lo que el consumidor proyecta (spec#Anclas terminales por template
 * proyectado).
 *
 * Robustez de entrada (lecciones PR3/PR4): `column` y `column.items` toleran
 * `null`/`undefined` sin lanzar; `title`/`titleKey` se validan con
 * `typeof === 'string'` antes de usarse (nunca `.trim()`/acceso directo
 * sobre un dato que podría no ser string). Sin recursión/anidamiento en
 * este modelo (columnas → items planos) — no aplica guarda de ciclo.
 */
@Component({
  selector: 'sol-kanban-column',
  standalone: true,
  imports: [NgTemplateOutlet, SolKanbanCardComponent, CdkDropList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="sol-kanban-column"
      [class.sol-kanban-column--drop-active]="isDropTargetActive()"
      [style.border-top-color]="accentColor()"
      [attr.aria-label]="columnAria()"
    >
      <header class="sol-kanban-column__header">
        @if (headerTemplate(); as tpl) {
          <ng-container *ngTemplateOutlet="tpl; context: { $implicit: column() }" />
        } @else {
          <h3 class="sol-kanban-column__title">{{ title() }}</h3>
        }

        @if (column()?.terminalAnchor && anchorTemplate(); as anchor) {
          <span class="sol-kanban-column__anchor">
            <ng-container *ngTemplateOutlet="anchor; context: { $implicit: column() }" />
          </span>
        }

        <span class="sol-kanban-column__count" [attr.aria-label]="itemCountAria()">{{ items().length }}</span>
      </header>

      <div
        class="sol-kanban-column__items"
        cdkDropList
        [id]="columnId()"
        [cdkDropListData]="items()"
        [cdkDropListDisabled]="column()?.droppable === false"
        (cdkDropListDropped)="onCdkDropped($event)"
        (cdkDropListEntered)="onCdkEntered()"
        (cdkDropListExited)="onCdkExited()"
      >
        @for (item of items(); track trackItem(item, $index)) {
          <sol-kanban-card [item]="item" [cardTemplate]="cardTemplate()" />
        }
        @if (items().length === 0) {
          @if (emptyTemplate(); as tpl) {
            <ng-container *ngTemplateOutlet="tpl" />
          } @else {
            <p class="sol-kanban-column__empty">{{ emptyLabel() }}</p>
          }
        }
      </div>

      <button type="button" class="sol-kanban-column__add" (click)="requestAdd()">
        + {{ addLabel() }}
      </button>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .sol-kanban-column {
      display: flex;
      flex-direction: column;
      width: 18rem;
      flex-shrink: 0;
      max-height: 100%;
      border: 1px solid var(--sol-border-color-default, #e2e8f0);
      border-top-width: 3px;
      border-radius: var(--sol-border-radius-lg, 12px);
      background: color-mix(in srgb, var(--sol-bg-page, #f8fafc) 60%, transparent);
    }

    .sol-kanban-column__header {
      display: flex;
      align-items: center;
      gap: var(--sol-space-xs, 4px);
      padding: var(--sol-space-sm, 8px) var(--sol-space-md, 12px);
      border-bottom: 1px solid var(--sol-border-color-default, #e2e8f0);
    }

    .sol-kanban-column__title {
      flex: 1;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sol-font-size-sm, 0.875rem);
      font-weight: 600;
      color: var(--sol-color-text-primary, #0f172a);
    }

    .sol-kanban-column__anchor {
      display: inline-flex;
      align-items: center;
    }

    .sol-kanban-column__count {
      display: grid;
      place-items: center;
      min-width: 1.25rem;
      height: 1.25rem;
      padding: 0 0.375rem;
      border-radius: var(--sol-border-radius-full, 9999px);
      background: color-mix(in srgb, var(--sol-color-text-muted, #94a3b8) 15%, transparent);
      font-size: var(--sol-font-size-xs, 0.6875rem);
      font-weight: 500;
      color: var(--sol-color-text-muted, #94a3b8);
    }

    .sol-kanban-column__items {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--sol-space-sm, 8px);
      min-height: 7.5rem;
      padding: var(--sol-space-sm, 8px);
      overflow-y: auto;
    }

    .sol-kanban-column__empty {
      margin: 0;
      padding: var(--sol-space-lg, 24px) var(--sol-space-sm, 8px);
      text-align: center;
      font-size: var(--sol-font-size-xs, 0.75rem);
      color: var(--sol-color-text-muted, #94a3b8);
    }

    .sol-kanban-column__add {
      margin: var(--sol-space-sm, 8px);
      padding: var(--sol-space-sm, 8px) var(--sol-space-md, 12px);
      border: 1px dashed var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-md, 8px);
      background: transparent;
      font-size: var(--sol-font-size-xs, 0.75rem);
      font-weight: 500;
      color: var(--sol-color-text-muted, #94a3b8);
      cursor: pointer;
    }

    .sol-kanban-column__add:hover {
      border-color: var(--sol-color-primary, #6366f1);
      color: var(--sol-color-primary, #6366f1);
    }

    /* Anillo de columna-destino activa (PR5b/T39, spec#UX de arrastre del vocero). */
    .sol-kanban-column--drop-active {
      box-shadow: 0 0 0 2px var(--sol-color-primary, #6366f1);
    }
  `,
})
export class SolKanbanColumnComponent<T extends KanbanItem = KanbanItem> {
  private readonly i18n = inject(SOL_I18N);

  /** Tolera `null`/`undefined` (lección PR3/PR4): `input.required()` no garantiza no-nulo en runtime. */
  readonly column = input.required<KanbanColumn<T> | null | undefined>();

  readonly cardTemplate = input.required<TemplateRef<KanbanCardTemplateContext<T>>>();

  /** Override opcional del header completo. Sin este, se usa el título por defecto. */
  readonly headerTemplate = input<TemplateRef<{ $implicit: KanbanColumn<T> | null | undefined }> | null>(null);

  /** Template del ancla terminal — SOLO se renderiza si `column.terminalAnchor` es `true`. */
  readonly anchorTemplate = input<TemplateRef<{ $implicit: KanbanColumn<T> | null | undefined }> | null>(null);

  /** Override opcional del empty-state. Sin este, se usa el texto por defecto (clave i18n). */
  readonly emptyTemplate = input<TemplateRef<unknown> | null>(null);

  readonly action = output<KanbanColumnAction>();

  /**
   * Reenvío CDK-free del drop (PR5b/T38): el board arma el reorden completo
   * (necesita ver TODAS las columnas para un move cross-columna); esta
   * columna solo conoce la suya, así que traduce el `CdkDragDrop` real a un
   * `KanbanRawDropEvent` plano ANTES de emitir — el tipo de CDK nunca sale
   * de este archivo hacia el board.
   */
  readonly itemDropped = output<KanbanRawDropEvent>();

  readonly items = computed<T[]>(() => this.column()?.items ?? []);

  /** `id` del drop-list — string vacío si la columna es `null`/`undefined` o no trae `id` (degrade, no lanza). */
  readonly columnId = computed(() => this.column()?.id ?? '');

  /** Anillo de columna-destino activa mientras el cursor de arrastre está sobre esta columna (spec#UX de arrastre). */
  protected readonly isDropTargetActive = signal(false);

  /** Frecuencia de `id` entre los items actuales — soporte de `trackItem` (fix NG0955 con id duplicado/ausente). */
  private readonly itemIdFrequency = computed(() => countIds(this.items()));

  /** `track` seguro: cae al índice si el `id` del item está ausente o duplicado, en vez de dejar que Angular lance `NG0955`. */
  trackItem(item: T, index: number): unknown {
    return safeTrackKey(item?.id, index, this.itemIdFrequency());
  }

  readonly title = computed(() => resolveColumnTitle(this.column(), (key) => this.i18n.translate(key)));

  readonly accentColor = computed(() => {
    const accent = this.column()?.accent;
    return typeof accent === 'string' && accent ? accent : TONE_COLOR.neutral;
  });

  readonly columnAria = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.kanban.columnAria', { title: this.title() });
  });

  /**
   * Singular/plural correcto en español ("1 tarjeta" vs. "N tarjetas") — el
   * contrato `SolI18n` no soporta ICU MessageFormat, así que la elección de
   * clave se hace acá en vez de interpolar un plural incorrecto.
   */
  readonly itemCountAria = computed(() => {
    this.i18n.activeLang();
    const count = this.items().length;
    return count === 1
      ? this.i18n.translate('shared.kanban.itemCountAriaSingular')
      : this.i18n.translate('shared.kanban.itemCountAriaPlural', { count });
  });

  readonly emptyLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.kanban.emptyColumn');
  });

  readonly addLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.kanban.addColumn');
  });

  requestAdd(): void {
    const columnId = this.column()?.id;
    if (!columnId) return;
    this.action.emit({ columnId, action: KANBAN_ADD_ACTION });
  }

  /**
   * Traduce el `CdkDragDrop` real a `KanbanRawDropEvent` (sin tipos de CDK) y
   * lo reenvía al board. Descarta el caso trivial (soltar en el MISMO
   * índice, MISMO contenedor) — no hay reorden real que aplicar.
   */
  protected onCdkDropped(event: CdkDragDrop<T[]>): void {
    // El anillo se enciende al ENTRAR (onCdkEntered) pero CDK solo emite
    // `exited` cuando el item se retira SIN soltar — un drop exitoso en esta
    // misma columna nunca dispara `exited`, así que se apaga acá también.
    this.isDropTargetActive.set(false);
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
    this.itemDropped.emit({
      fromColumnId: event.previousContainer.id,
      toColumnId: event.container.id,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
  }

  protected onCdkEntered(): void {
    this.isDropTargetActive.set(true);
  }

  protected onCdkExited(): void {
    this.isDropTargetActive.set(false);
  }
}

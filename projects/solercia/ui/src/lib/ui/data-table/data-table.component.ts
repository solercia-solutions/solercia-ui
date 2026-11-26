import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  Directive,
  ElementRef,
  OnInit,
  TemplateRef,
  computed,
  contentChild,
  effect,
  inject,
  input,
  output,
  signal,
  type Signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SolSearchInputComponent } from '../search-input/search-input.component';
import { SolPaginationComponent } from '../pagination/pagination.component';
import { SolButtonComponent } from '../button/button.component';
import { SolIconComponent } from '../icon/icon.component';
import { SolSkeletonComponent } from '../skeleton/skeleton.component';
import { ThemeService } from '../../tokens';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import type { SolTableVariant } from '../../tokens/theme.model';

/** Fila genérica de la tabla: un objeto plano indexable por clave. */
export type SolDataTableRow = Record<string, unknown>;

/**
 * Directiva interna (se exporta desde este archivo solo porque el
 * compilador de Angular exige que los `imports` de un componente standalone
 * sean símbolos exportados — NO se re-exporta desde `lib/ui/index.ts` ni
 * `public-api.ts`, así que sigue sin ser parte de la API pública de
 * `@solercia/ui`) que anima la entrada
 * de cada fila/tarjeta de `sol-data-table` con el MISMO contrato de tokens
 * y clases globales que `[solReveal]` (`@shared/lib` de la app boki-front):
 * `--sol-reveal-index` (stagger), `.sol-reveal-in`/`.sol-reveal-in--replay`
 * (definidas junto a los keyframes en el `styles.css` del consumidor,
 * dirigidas por `component.motion.*` del tema).
 *
 * La lib NO importa `SolRevealDirective` de la app — eso invertiría la
 * regla de dependencia (una librería no depende de quien la consume). Esta
 * es el punto de extensión OCP que restaura la paridad visual del widget
 * local borrado en PR7a (T51) sin acoplar `sol-data-table` a boki-front:
 * la lib reimplementa el mismo contrato (mismas clases/tokens), agnóstica
 * de qué app lo consume. Ver 4R de PR7 (11-a-solercia-ui), WARNING-1.
 *
 * Nota de mantenimiento: hay duplicación intencional con
 * `src/shared/lib/reveal.directive.ts` (boki-front) — un futuro candidato
 * a extraer sería mover `SolRevealDirective` a `@solercia/ui` para que
 * ambos consuman una única implementación; queda fuera de esta corrección
 * (fuera de alcance de PR7).
 */
@Directive({
  selector: '[solRowReveal]',
  standalone: true,
})
export class RowRevealDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Apaga el efecto por completo (sin observer, sin ocultar el elemento). */
  readonly solRowReveal = input<boolean>(true);
  /** Índice del stagger: retrasa la entrada índice × tokens de duración. */
  readonly solRowRevealIndex = input<number>(0);
  /** Valor arbitrario: cada cambio re-dispara la animación en filas ya reveladas. */
  readonly solRowRevealReplay = input<unknown>(undefined);

  private observer: IntersectionObserver | null = null;
  private revealed = false;
  private altKeyframe = false;

  constructor() {
    effect(() => {
      this.host.nativeElement.style.setProperty(
        '--sol-reveal-index',
        String(this.solRowRevealIndex()),
      );
    });

    let initial = true;
    effect(() => {
      this.solRowRevealReplay();
      if (initial) {
        initial = false;
        return;
      }
      if (this.solRowReveal() && this.revealed) {
        this.replay();
      }
    });
  }

  ngOnInit(): void {
    if (!this.solRowReveal() || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.host.nativeElement.style.opacity = '0';

    this.observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.reveal();
        }
      },
      { threshold: 0.05 },
    );
    this.observer.observe(this.host.nativeElement);

    this.destroyRef.onDestroy(() => this.disconnect());
  }

  private reveal(): void {
    this.disconnect();
    const element = this.host.nativeElement;
    element.style.removeProperty('opacity');
    element.classList.add('sol-reveal-in');
    this.revealed = true;
  }

  private replay(): void {
    const element = this.host.nativeElement;
    this.altKeyframe = !this.altKeyframe;
    if (this.altKeyframe) {
      const name =
        getComputedStyle(element).getPropertyValue('--sol-reveal-name').trim() || 'solRevealFade';
      element.style.setProperty('--sol-reveal-name-b', `${name}B`);
      element.classList.add('sol-reveal-in--replay');
    } else {
      element.classList.remove('sol-reveal-in--replay');
    }
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}

/**
 * Descriptor de columna que dirige el render de `sol-data-table`.
 *
 * - `key`: ruta al valor en la fila (soporta anidamiento con puntos, `a.b.c`).
 * - `label`: encabezado visible de la columna.
 * - `sortable`: habilita el orden por esa columna al hacer clic en el th.
 * - `width`: ancho CSS opcional del th (`'120px'`, `'20%'`…).
 * - `badge`: marca la columna de estado (chip): en el modo móvil colapsado su
 *   valor se muestra como chip junto al título en la cabecera de la fila.
 * - `filter` (0.6.0, opt-in): agrega un control de filtro para esta columna
 *   en una fila propia bajo el header (ver `sol-data-table__filters-row`) —
 *   la fila solo aparece si AL MENOS una columna declara `filter`. `'text'`
 *   filtra por contención (contains, case-insensitive); `'select'` filtra
 *   por igualdad exacta contra las opciones únicas del `data` actual de esa
 *   columna. Ambos se combinan (AND) entre sí y con la búsqueda global de
 *   `filteredData`, client-side. No aplica en el modo colapsado móvil (la
 *   fila de filtros vive solo dentro de `<table>`).
 * - `cellTemplate`: plantilla opcional para renderizar la celda (recibe el
 *   valor resuelto como `$implicit` y la fila completa como `row`).
 */
export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  badge?: boolean;
  filter?: 'text' | 'select';
  cellTemplate?: TemplateRef<{ $implicit: unknown; row: SolDataTableRow }>;
}

/**
 * Tabla de datos genérica dirigida por columnas: búsqueda, orden, paginación,
 * estado de carga (skeleton), estado vacío, filtros por columna (opt-in, ver
 * `DataTableColumn.filter`) y acciones por fila (posición configurable, ver
 * `actionsPosition`). Colapsa cada fila a un resumen expandible (sin scroll
 * horizontal) cuando el tema activo lo prefiere
 * (`component.table.mobile: "collapse"`) y el ancho de su propio HOST — no
 * del viewport del navegador, ver `collapseWidth` — cae por debajo del
 * umbral: una tabla dentro de un layout angosto (sidebar, grid a dos
 * columnas) colapsa aunque la ventana siga en ancho desktop.
 *
 * Componente presentacional: no conoce dominio. Las acciones no genéricas se
 * proyectan por el slot `#rowActions` (TemplateRef que recibe la fila).
 * Tematizado con `var(--sol-*)` — soporta light y dark.
 */
@Component({
  selector: 'sol-data-table',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    SolSearchInputComponent,
    SolPaginationComponent,
    SolButtonComponent,
    SolIconComponent,
    SolSkeletonComponent,
    RowRevealDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Slot para filtros personalizados (fuera de la tarjeta) -->
    <div
      class="sol-data-table__filters"
      [style.justify-content]="filterPosition() === 'right' ? 'flex-end' : 'flex-start'"
    >
      <ng-content select="[tableFilters]" />
    </div>

    <div
      class="sol-data-table"
      [attr.aria-busy]="loadingVisible() || null"
      [attr.data-variant]="effectiveVariant()"
    >
      @if (showToolbar()) {
        <div class="sol-data-table__toolbar">
          <div class="sol-data-table__toolbar-left">
            <ng-content select="[tableActions]" />
          </div>
          <div class="sol-data-table__toolbar-right">
            <sol-search-input
              [placeholder]="searchPlaceholderText()"
              (searchChange)="onSearch($event)"
            />
          </div>
        </div>
      }

      <!-- Acciones por fila compartidas entre el modo tabla y el modo móvil. -->
      <ng-template #rowActionButtons let-row>
        <div class="sol-data-table__action-group">
          @if (rowActionsTemplate(); as tpl) {
            <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row }" />
          } @else {
            @if (showEditAction()) {
              <sol-button variant="ghost" size="sm" (clicked)="editClicked.emit(row)">
                <sol-icon name="edit" size="sm" />
              </sol-button>
            }
            @if (showDeleteAction()) {
              <sol-button variant="ghost" size="sm" (clicked)="deleteClicked.emit(row)">
                <sol-icon name="trash" size="sm" class="text-red-500" />
              </sol-button>
            }
          }
        </div>
      </ng-template>

      <!-- Celda(s) de acciones del modo tabla, reutilizadas en ambas
           posiciones ('start'/'end', ver input actionsPosition) para no
           duplicar el mismo th/td dos veces en el template. -->
      <ng-template #actionsHeaderCell>
        <th class="sol-data-table__th sol-data-table__th--actions">{{ actionsText() }}</th>
      </ng-template>

      <ng-template #actionsFilterCell>
        <th class="sol-data-table__filter-cell"></th>
      </ng-template>

      <ng-template #actionsBodyCell let-row>
        <td class="sol-data-table__td sol-data-table__td--actions">
          <ng-container *ngTemplateOutlet="rowActionButtons; context: { $implicit: row }" />
        </td>
      </ng-template>

      @if (mobileCollapse()) {
        <!-- Modo móvil colapsado: cada fila es [▶] título + subdato · chip de
             estado; el detalle despliega las columnas ocultas como pares
             clave/valor. -->
        @if (loadingVisible()) {
          <ul class="sol-data-table__cards">
            @for (i of skeletonRows; track i) {
              <li>
                <sol-skeleton variant="row" height="56px" />
              </li>
            }
          </ul>
        } @else {
          <ul class="sol-data-table__cards">
            @for (row of pagedData(); track trackId($index, row)) {
              <li
                class="sol-data-table__card"
                [solRowReveal]="rowReveal()"
                [solRowRevealIndex]="$index"
                [solRowRevealReplay]="revealReplayKey()"
              >
                <button
                  type="button"
                  class="sol-data-table__card-head"
                  [attr.aria-expanded]="isRowExpanded(trackId($index, row))"
                  [attr.aria-label]="toggleDetailsText()"
                  (click)="toggleRow(trackId($index, row))"
                  data-testid="fila-colapsada"
                >
                  <sol-icon
                    name="chevron-right"
                    size="sm"
                    class="sol-data-table__card-chevron"
                    [class.sol-data-table__card-chevron--open]="isRowExpanded(trackId($index, row))"
                  />
                  <span class="sol-data-table__card-main">
                    @if (mobileTitleCol(); as col) {
                      <span class="sol-data-table__card-title">
                        @if (col.cellTemplate) {
                          <ng-container *ngTemplateOutlet="col.cellTemplate; context: { $implicit: resolveValue(row, col.key), row: row }" />
                        } @else {
                          {{ resolveValue(row, col.key) }}
                        }
                      </span>
                    }
                    @if (mobileSubtitleCol(); as col) {
                      <span class="sol-data-table__card-sub">
                        @if (col.cellTemplate) {
                          <ng-container *ngTemplateOutlet="col.cellTemplate; context: { $implicit: resolveValue(row, col.key), row: row }" />
                        } @else {
                          {{ resolveValue(row, col.key) }}
                        }
                      </span>
                    }
                  </span>
                  @if (mobileBadgeCol(); as col) {
                    <span class="sol-data-table__card-chip">
                      @if (col.cellTemplate) {
                        <ng-container *ngTemplateOutlet="col.cellTemplate; context: { $implicit: resolveValue(row, col.key), row: row }" />
                      } @else {
                        {{ resolveValue(row, col.key) }}
                      }
                    </span>
                  }
                </button>

                @if (isRowExpanded(trackId($index, row))) {
                  <div class="sol-data-table__card-details" data-testid="detalle-fila">
                    <dl class="sol-data-table__card-kv-list">
                      @for (col of mobileDetailCols(); track col.key) {
                        <div class="sol-data-table__card-kv">
                          <dt>{{ col.label }}</dt>
                          <dd>
                            @if (col.cellTemplate) {
                              <ng-container *ngTemplateOutlet="col.cellTemplate; context: { $implicit: resolveValue(row, col.key), row: row }" />
                            } @else {
                              {{ resolveValue(row, col.key) }}
                            }
                          </dd>
                        </div>
                      }
                    </dl>
                    @if (showActions()) {
                      <div class="sol-data-table__card-actions">
                        <ng-container *ngTemplateOutlet="rowActionButtons; context: { $implicit: row }" />
                      </div>
                    }
                  </div>
                }
              </li>
            } @empty {
              <li class="sol-data-table__empty">{{ emptyText() }}</li>
            }
          </ul>
        }
      } @else {
        <div class="sol-data-table__wrapper">
          <table class="sol-data-table__table">
            <thead>
              <tr>
                @if (showActions() && actionsPosition() === 'start') {
                  <ng-container *ngTemplateOutlet="actionsHeaderCell" />
                }
                @for (col of columns(); track col.key) {
                  <th
                    class="sol-data-table__th"
                    [style.width]="col.width || 'auto'"
                    [class.sol-data-table__th--sortable]="col.sortable"
                    (click)="col.sortable ? onSort(col.key) : null"
                  >
                    {{ col.label }}
                    @if (col.sortable && sortKey() === col.key) {
                      <span class="sol-data-table__sort-icon">
                        {{ sortDirection() === 'asc' ? '↑' : '↓' }}
                      </span>
                    }
                  </th>
                }
                @if (showActions() && actionsPosition() === 'end') {
                  <ng-container *ngTemplateOutlet="actionsHeaderCell" />
                }
              </tr>
              @if (hasColumnFilters()) {
                <!-- Fila de filtros opt-in (ver DataTableColumn.filter): solo
                     dentro de <table>, nunca en el modo colapsado móvil (que
                     ni siquiera renderiza este bloque). Las celdas siguen el
                     mismo actionsPosition que el header para no desalinear
                     columnas. -->
                <tr class="sol-data-table__filters-row">
                  @if (showActions() && actionsPosition() === 'start') {
                    <ng-container *ngTemplateOutlet="actionsFilterCell" />
                  }
                  @for (col of columns(); track col.key) {
                    <th class="sol-data-table__filter-cell">
                      @if (col.filter === 'text') {
                        <input
                          type="text"
                          class="sol-data-table__filter-input"
                          placeholder="…"
                          [attr.aria-label]="col.label"
                          [value]="columnFilters()[col.key] ?? ''"
                          (input)="onColumnFilterChange(col.key, $event)"
                        />
                      } @else if (col.filter === 'select') {
                        <select
                          class="sol-data-table__filter-select"
                          [attr.aria-label]="col.label"
                          [value]="columnFilters()[col.key] ?? ''"
                          (change)="onColumnFilterChange(col.key, $event)"
                        >
                          <option value="">{{ filterAllText() }}</option>
                          @for (opt of columnFilterOptions(col); track opt) {
                            <option [value]="opt">{{ opt }}</option>
                          }
                        </select>
                      }
                    </th>
                  }
                  @if (showActions() && actionsPosition() === 'end') {
                    <ng-container *ngTemplateOutlet="actionsFilterCell" />
                  }
                </tr>
              }
            </thead>
            <tbody>
              @if (loadingVisible()) {
                @for (i of skeletonRows; track i) {
                  <tr class="sol-data-table__tr">
                    <td class="sol-data-table__td" [attr.colspan]="columns().length + (showActions() ? 1 : 0)">
                      <sol-skeleton variant="row" />
                    </td>
                  </tr>
                }
              } @else {
                @for (row of pagedData(); track trackId($index, row)) {
                  <tr
                    class="sol-data-table__tr"
                    [solRowReveal]="rowReveal()"
                    [solRowRevealIndex]="$index"
                    [solRowRevealReplay]="revealReplayKey()"
                  >
                    @if (showActions() && actionsPosition() === 'start') {
                      <ng-container *ngTemplateOutlet="actionsBodyCell; context: { $implicit: row }" />
                    }
                    @for (col of columns(); track col.key) {
                      <td class="sol-data-table__td">
                        @if (col.cellTemplate) {
                          <ng-container *ngTemplateOutlet="col.cellTemplate; context: { $implicit: resolveValue(row, col.key), row: row }" />
                        } @else {
                          {{ resolveValue(row, col.key) }}
                        }
                      </td>
                    }
                    @if (showActions() && actionsPosition() === 'end') {
                      <ng-container *ngTemplateOutlet="actionsBodyCell; context: { $implicit: row }" />
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td class="sol-data-table__empty" [attr.colspan]="columns().length + (showActions() ? 1 : 0)">
                      {{ emptyText() }}
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (paginated() && !loadingVisible()) {
      <div class="sol-data-table__footer">
        <sol-pagination
          [totalItems]="filteredData().length"
          [pageSize]="pageSize()"
          [currentPage]="currentPage()"
          (pageChanged)="currentPage.set($event)"
          (pageSizeChanged)="onPageSizeChange($event)"
        />
      </div>
    }
  `,
  styles: `
    /* El colapso a cards mide el ancho del host con ResizeObserver, que
       reporta 0 en un elemento inline: sin display de bloque la tabla
       colapsaba siempre, también en escritorio. */
    :host {
      display: block;
    }

    .sol-data-table__filters {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .sol-data-table__filters:empty {
      display: none;
    }

    .sol-data-table {
      /* Adopta el look de "card" del tema (sombra difusa/dura/glass/plana)
         igual que sol-card, con fallback al look neutro previo. */
      background: var(--sol-card-bg, var(--sol-bg-surface, #fff));
      border: var(--sol-card-border, 1px solid var(--sol-border-color-default, #E2E8F0));
      border-radius: var(--sol-card-radius, var(--sol-border-radius-lg, 12px));
      box-shadow: var(--sol-card-shadow, var(--sol-shadow-sm));
      overflow: hidden;
    }

    .sol-data-table__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      gap: 12px;
      border-bottom: 1px solid var(--sol-border-color-default, #E2E8F0);
    }

    .sol-data-table__toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sol-data-table__toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 200px;
      max-width: 280px;
    }

    .sol-data-table__wrapper {
      overflow-x: auto;
    }

    .sol-data-table__table {
      width: 100%;
      border-collapse: collapse;
    }

    .sol-data-table__th {
      padding: 10px 16px;
      font-size: var(--sol-font-size-xs, 11px);
      font-weight: 600;
      color: var(--sol-color-text-muted, #64748B);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
      background: color-mix(in srgb, var(--sol-border-color-default, #E2E8F0) 30%, transparent);
      border-bottom: 1px solid var(--sol-border-color-default, #E2E8F0);
      white-space: nowrap;
      user-select: none;
    }

    .sol-data-table__th--sortable {
      cursor: pointer;
      transition: color 0.15s;
    }

    .sol-data-table__th--sortable:hover {
      color: var(--sol-color-text-primary, #0F172A);
    }

    /* width 1% + nowrap: the column shrinks to fit however many action
       buttons the row template projects, instead of a fixed 100px that
       wraps three or more buttons. */
    .sol-data-table__th--actions {
      width: 1%;
      white-space: nowrap;
      text-align: center;
    }

    /* Fila de filtros opt-in (ver DataTableColumn.filter): mismo fondo
       tenue que el header, pero sin su tipografía en mayúsculas — es un
       control, no una etiqueta. */
    .sol-data-table__filter-cell {
      padding: 6px 16px;
      background: color-mix(in srgb, var(--sol-border-color-default, #E2E8F0) 15%, transparent);
      border-bottom: 1px solid var(--sol-border-color-default, #E2E8F0);
    }

    .sol-data-table__filter-input,
    .sol-data-table__filter-select {
      width: 100%;
      box-sizing: border-box;
      height: var(--sol-size-component-sm, 30px);
      padding: 0 8px;
      font-family: inherit;
      font-size: var(--sol-font-size-sm, 12px);
      color: var(--sol-color-text-primary, #0F172A);
      background: var(--sol-bg-surface, #fff);
      border: 1px solid var(--sol-border-color-default, #E2E8F0);
      border-radius: var(--sol-border-radius-sm, 6px);
      outline: none;
      transition:
        border-color var(--sol-dur-fast, 150ms) var(--sol-ease, ease),
        box-shadow var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
    }

    .sol-data-table__filter-input::placeholder {
      color: var(--sol-color-text-muted, #94A3B8);
    }

    .sol-data-table__filter-input:focus,
    .sol-data-table__filter-select:focus {
      border-color: var(--sol-color-primary, #2563EB);
      box-shadow: var(--sol-focus-ring, 0 0 0 2px color-mix(in srgb, var(--sol-color-primary, #2563EB) 20%, transparent));
    }

    .sol-data-table__sort-icon {
      margin-left: 4px;
      font-size: 12px;
      color: var(--sol-color-primary, #2563EB);
    }

    .sol-data-table__tr {
      border-bottom: 1px solid var(--sol-border-color-default, #E2E8F0);
      transition: background-color 0.15s;
    }

    .sol-data-table__tr:last-child .sol-data-table__td {
      border-bottom: none;
    }

    .sol-data-table__tr:hover {
      background: color-mix(in srgb, var(--sol-color-primary, #2563EB) 3%, transparent);
    }

    .sol-data-table__td {
      padding: 12px 16px;
      font-size: var(--sol-font-size-sm, 13px);
      color: var(--sol-color-text-primary, #0F172A);
      vertical-align: middle;
    }

    .sol-data-table__td--actions {
      text-align: center;
      white-space: nowrap;
    }

    .sol-data-table__action-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .sol-data-table__empty {
      padding: 40px 16px;
      text-align: center;
      font-size: var(--sol-font-size-sm, 13px);
      color: var(--sol-color-text-muted, #94A3B8);
    }

    .sol-data-table__footer {
      padding: 8px 4px 0;
    }

    /* ── Variantes visuales (0.6.0, input variant / component.table.variant) ──
       Solo pintan con tokens del modo activo; sin data-variant la tabla
       conserva su look de siempre. La regla de hover repite el atributo para
       igualar la especificidad de las filas con tinte y ganar por orden. */
    .sol-data-table[data-variant] {
      --sol-table-header-bg: color-mix(in srgb, var(--sol-color-primary, #2563EB) 8%, var(--sol-bg-surface, #FFFFFF));
      --sol-table-header-strong-bg: color-mix(in srgb, var(--sol-color-primary, #2563EB) 16%, var(--sol-bg-surface, #FFFFFF));
      --sol-table-zebra: color-mix(in srgb, var(--sol-color-text-primary, #0F172A) 4%, transparent);
      --sol-table-band: color-mix(in srgb, var(--sol-color-primary, #2563EB) 7%, transparent);
      --sol-table-cell-border: var(--sol-border-color-default, #E2E8F0);
      --sol-table-hover: color-mix(in srgb, var(--sol-color-text-primary, #0F172A) 6%, transparent);
    }

    .sol-data-table[data-variant] .sol-data-table__th {
      background: var(--sol-table-header-bg);
      color: var(--sol-color-text-secondary, #475569);
      font-size: var(--sol-font-size-sm, 12px);
      border-bottom: var(--sol-border-width-default, 1px) solid var(--sol-table-cell-border);
    }

    .sol-data-table[data-variant] .sol-data-table__tr {
      border-bottom: var(--sol-border-width-default, 1px) solid var(--sol-table-cell-border);
    }

    .sol-data-table[data-variant]:not([data-variant='clean']) .sol-data-table__table > tbody > .sol-data-table__tr:nth-of-type(odd) {
      background: var(--sol-table-zebra);
    }

    .sol-data-table[data-variant='banded'] .sol-data-table__table > tbody > .sol-data-table__tr:nth-of-type(3n) {
      background: var(--sol-table-band);
    }

    .sol-data-table[data-variant][data-variant] .sol-data-table__table > tbody > .sol-data-table__tr:hover {
      background: var(--sol-table-hover);
    }

    .sol-data-table[data-variant='bordered'] .sol-data-table__table {
      border: var(--sol-border-width-default, 1px) solid var(--sol-table-cell-border);
    }

    .sol-data-table[data-variant='bordered'] .sol-data-table__th,
    .sol-data-table[data-variant='bordered'] .sol-data-table__td,
    .sol-data-table[data-variant='bordered'] .sol-data-table__table .sol-data-table__tr:last-child > .sol-data-table__td {
      border: var(--sol-border-width-default, 1px) solid var(--sol-table-cell-border);
    }

    .sol-data-table[data-variant='emphasis-header'] .sol-data-table__th {
      background: var(--sol-table-header-strong-bg);
      color: var(--sol-color-primary, #2563EB);
    }

    /* ── Modo móvil colapsado ──────────────────────────────────────────
       Sin scroll horizontal: cada fila colapsa a [▶] título + subdato ·
       chip de estado. Los tokens solo estilizan (colores, radios, motion). */

    .sol-data-table__cards {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .sol-data-table__card {
      border-bottom: 1px solid var(--sol-border-color-default, #E2E8F0);
    }

    .sol-data-table__card:last-child {
      border-bottom: none;
    }

    .sol-data-table__card-head {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-width: 0;
      padding: 12px;
      border: none;
      background: transparent;
      font: inherit;
      text-align: left;
      color: var(--sol-color-text-primary, #0F172A);
      cursor: pointer;
      box-sizing: border-box;
    }

    .sol-data-table__card-chevron {
      flex-shrink: 0;
      color: var(--sol-color-text-muted, #94A3B8);
      transition: transform var(--sol-dur-fast, 120ms) var(--sol-ease, ease);
    }

    .sol-data-table__card-chevron--open {
      transform: rotate(90deg);
    }

    .sol-data-table__card-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sol-data-table__card-title {
      font-size: var(--sol-font-size-sm, 13px);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sol-data-table__card-sub {
      font-size: var(--sol-font-size-sm, 12px);
      color: var(--sol-color-text-muted, #64748B);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sol-data-table__card-chip {
      flex-shrink: 0;
      max-width: 40%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 2px 10px;
      border-radius: var(--sol-border-radius-full, 9999px);
      font-size: 11px;
      font-weight: 600;
      color: var(--sol-color-primary, #2563EB);
      background: color-mix(in srgb, var(--sol-color-primary, #2563EB) 12%, transparent);
    }

    /* Detalle expandido: pares clave/valor que entran con los tokens de
       motion del tema (keyframe local del componente). */
    .sol-data-table__card-details {
      padding: 0 12px 12px 34px;
      animation: sol-data-table-reveal var(--sol-dur-base, 240ms) var(--sol-ease-entrance, ease-out) backwards;
    }

    @keyframes sol-data-table-reveal {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .sol-data-table__card-kv-list {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .sol-data-table__card-kv {
      display: flex;
      gap: 8px;
      align-items: baseline;
      min-width: 0;
    }

    .sol-data-table__card-kv dt {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--sol-color-text-muted, #64748B);
    }

    .sol-data-table__card-kv dd {
      margin: 0;
      min-width: 0;
      font-size: var(--sol-font-size-sm, 13px);
      color: var(--sol-color-text-primary, #0F172A);
      overflow-wrap: anywhere;
    }

    .sol-data-table__card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 10px;
    }

    /* Toolbar fluida en pantallas angostas. */
    @media (max-width: 767px) {
      .sol-data-table__toolbar {
        flex-wrap: wrap;
      }

      .sol-data-table__toolbar-right {
        flex: 1;
        min-width: 0;
        max-width: none;
      }
    }
  `,
})
export class SolDataTableComponent {
  private readonly themeService = inject(ThemeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = injectSolI18n();

  readonly data = input<SolDataTableRow[]>([]);
  readonly columns = input<DataTableColumn[]>([]);
  /**
   * Estado de carga de la fuente de datos: sustituye el cuerpo por filas
   * skeleton tokenizadas y oculta la paginación mientras esté activo.
   */
  readonly loading = input<boolean>(false);
  /** Search placeholder. Without a value it uses `shared.table.searchPlaceholder`. */
  readonly searchPlaceholder = input<string | undefined>(undefined);
  /** Empty-state message. Without a value it uses `shared.table.empty`. */
  readonly emptyMessage = input<string | undefined>(undefined);
  readonly paginated = input<boolean>(true);
  readonly showToolbar = input<boolean>(true);
  readonly filterPosition = input<'left' | 'right'>('left');
  readonly showActions = input<boolean>(true);
  readonly showEditAction = input<boolean>(true);
  readonly showDeleteAction = input<boolean>(true);
  readonly trackByKey = input<string>('id');
  /** Encabezado de la columna de acciones. Sin valor usa `shared.table.actions`. */
  readonly actionsLabel = input<string | undefined>(undefined);
  /**
   * Posición de la columna de acciones (0.6.0). `'end'` (default) preserva
   * el comportamiento previo — th/td de acciones después de las columnas de
   * datos. `'start'` los renderiza ANTES, como primera columna (aplica al
   * `#rowActions` proyectado y a los botones editar/eliminar por defecto
   * por igual). Sin efecto en el modo colapsado móvil: ahí las acciones
   * siguen viviendo solo en el detalle expandido de la card.
   */
  readonly actionsPosition = input<'start' | 'end'>('end');
  /**
   * aria-label del botón ▶ de expansión de fila en el modo móvil. Sin valor
   * usa la clave i18n `shared.table.toggleDetails`.
   */
  readonly toggleDetailsLabel = input<string | undefined>(undefined);
  /**
   * Activa la animación de entrada (`solRowReveal`, ver directiva interna
   * arriba) en cada fila/tarjeta. Default `true`: preserva el
   * comportamiento visual del widget local que este componente reemplazó
   * (PR7a/T51) sin requerir cambios en los consumidores existentes — el
   * intensity "none"/`prefers-reduced-motion` del tema ya neutraliza el
   * efecto (duración ~1ms, distancia 0) para quien no lo quiera, sin
   * necesidad de apagar este input.
   */
  readonly rowReveal = input<boolean>(true);

  /**
   * Ancho (px) del HOST bajo el cual la tabla colapsa a cards (0.6.0).
   * Reemplaza el criterio anterior, que solo miraba el viewport del
   * navegador (`matchMedia`) — la fuente de verdad ahora es un
   * `ResizeObserver` sobre el propio elemento raíz del componente, así que
   * una tabla dentro de un contenedor angosto (sidebar, grid a dos
   * columnas) colapsa aunque la ventana siga en ancho desktop. El default
   * (767) conserva el breakpoint canónico previo.
   */
  readonly collapseWidth = input<number>(767);

  /**
   * Variante visual (0.6.0): `clean` | `zebra` | `bordered` | `emphasis-header`
   * | `banded`. Sobrescribe `component.table.variant` del tema activo; `null`
   * (default) deja decidir al tema y, si el tema tampoco la declara, la tabla
   * conserva su look de siempre. Los colores salen de `var(--sol-*)`, así que
   * la variante reacciona sola a claro/oscuro.
   */
  readonly variant = input<SolTableVariant | null>(null);

  readonly editClicked = output<SolDataTableRow>();
  readonly deleteClicked = output<SolDataTableRow>();

  /**
   * Plantilla de acciones por fila proyectada con `#rowActions`. Recibe la fila
   * como `$implicit`. Cuando existe, reemplaza los botones editar/eliminar por
   * defecto: aquí van las acciones específicas del dominio del consumidor.
   */
  readonly rowActionsTemplate = contentChild<TemplateRef<{ $implicit: SolDataTableRow }>>('rowActions');

  /**
   * Carga "estirada" a un mínimo visible (anti-flash): con un backend rápido
   * `loading` se apaga antes de que el skeleton se perciba. `loadingVisible`
   * mantiene el skeleton un instante mínimo — es lo que consume el template.
   */
  protected readonly loadingVisible = stretchLoading(this.loading);

  readonly searchTerm = signal('');
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly sortKey = signal('');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  /** Valor de filtro por columna (0.6.0), indexado por `DataTableColumn.key`. */
  readonly columnFilters = signal<Record<string, string>>({});

  // Visible texts: an explicit input always wins (even ''); otherwise the shared.table.* key.
  readonly searchPlaceholderText = computed(() => this.text(this.searchPlaceholder(), 'shared.table.searchPlaceholder'));
  readonly emptyText = computed(() => this.text(this.emptyMessage(), 'shared.table.empty'));
  readonly actionsText = computed(() => this.text(this.actionsLabel(), 'shared.table.actions'));
  readonly toggleDetailsText = computed(() => this.text(this.toggleDetailsLabel(), 'shared.table.toggleDetails'));
  readonly filterAllText = computed(() => this.text(undefined, 'shared.table.filterAll'));

  private text(override: string | undefined, key: string): string {
    this.i18n.activeLang();
    return override ?? this.i18n.translate(key);
  }

  /**
   * Clave de replay de `solRowReveal`: cambia con cualquier búsqueda, orden
   * o paginación — reinicia la animación de entrada de las filas visibles
   * (paridad con el widget local: `solRevealReplay` sobre el mismo filtro).
   */
  readonly revealReplayKey = computed(
    () => `${this.searchTerm()}:${this.sortKey()}:${this.sortDirection()}:${this.currentPage()}`,
  );

  /**
   * Señal reactiva al ancho del HOST (0.6.0, ver `collapseWidth`): true
   * cuando el ResizeObserver mide un ancho <= `collapseWidth()`. Fuente de
   * verdad del colapso — ya NO es el viewport del navegador.
   */
  readonly isContainerNarrow = observeContainerWidth(this.host, this.collapseWidth);

  /** Índices de las filas fantasma del estado de carga (7 filas fijas). */
  protected readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6];

  /**
   * Token aditivo `component.table.mobile` del ThemeFile activo.
   * "collapse" (default): filas colapsables sin scroll horizontal.
   * "scroll": conserva la tabla con overflow-x. El token ajusta la
   * preferencia — NUNCA la estructura del componente.
   */
  private readonly tableMobileMode = computed<'collapse' | 'scroll'>(() => {
    const file = this.themeService.activeTheme();
    const mode = this.themeService.isDark() ? 'dark' : 'light';
    return file?.modes?.[mode]?.component?.table?.mobile ?? 'collapse';
  });

  /** Variante efectiva: el input manda; si no, `component.table.variant` del tema activo. */
  readonly effectiveVariant = computed<SolTableVariant | null>(() => {
    const own = this.variant();
    if (own) return own;
    const file = this.themeService.activeTheme();
    const mode = this.themeService.isDark() ? 'dark' : 'light';
    return file?.modes?.[mode]?.component?.table?.variant ?? null;
  });

  /** El modo colapsado aplica solo con host angosto (`collapseWidth`) y preferencia "collapse". */
  readonly mobileCollapse = computed(
    () => this.isContainerNarrow() && this.tableMobileMode() === 'collapse',
  );

  /** Filas expandidas del modo colapsado (por id de trackBy). */
  readonly expandedRows = signal<ReadonlySet<string | number>>(new Set());

  /** Columna título de la fila colapsada = primera columna configurada. */
  readonly mobileTitleCol = computed<DataTableColumn | undefined>(() => this.columns()[0]);

  /** Columna del chip de estado = la marcada con `badge: true` (si existe). */
  readonly mobileBadgeCol = computed<DataTableColumn | undefined>(() =>
    this.columns().find((col) => col.badge),
  );

  /** Subdato = la segunda columna que no sea el chip de estado. */
  readonly mobileSubtitleCol = computed<DataTableColumn | undefined>(() =>
    this.columns().find((col, index) => index > 0 && !col.badge),
  );

  /** Columnas ocultas en el colapso: todas menos título, subdato y chip. */
  readonly mobileDetailCols = computed<DataTableColumn[]>(() => {
    const title = this.mobileTitleCol();
    const subtitle = this.mobileSubtitleCol();
    const badge = this.mobileBadgeCol();
    return this.columns().filter((col) => col !== title && col !== subtitle && col !== badge);
  });

  /** true si AL MENOS una columna declara `filter` — dispara la fila de filtros. */
  readonly hasColumnFilters = computed(() => this.columns().some((col) => !!col.filter));

  readonly filteredData = computed(() => {
    let result = [...this.data()];
    const term = this.searchTerm().toLowerCase();

    if (term) {
      result = result.filter((row) =>
        this.columns().some((col) =>
          String(this.resolveValue(row, col.key) ?? '').toLowerCase().includes(term),
        ),
      );
    }

    // Filtros por columna (0.6.0): se COMBINAN (AND) entre sí y con la
    // búsqueda global de arriba. 'select' es igualdad exacta (viene de un
    // desplegable con las opciones reales de la columna); 'text' es
    // contención — el mismo criterio que la búsqueda global.
    const activeFilters = Object.entries(this.columnFilters()).filter(([, value]) => value !== '');
    if (activeFilters.length > 0) {
      const columnByKey = new Map(this.columns().map((col) => [col.key, col]));
      result = result.filter((row) =>
        activeFilters.every(([key, value]) => {
          const cellValue = String(this.resolveValue(row, key) ?? '').toLowerCase();
          const needle = value.toLowerCase();
          return columnByKey.get(key)?.filter === 'select'
            ? cellValue === needle
            : cellValue.includes(needle);
        }),
      );
    }

    const key = this.sortKey();
    if (key) {
      const dir = this.sortDirection() === 'asc' ? 1 : -1;
      result.sort((a, b) => {
        const va = this.resolveValue(a, key) as string | number;
        const vb = this.resolveValue(b, key) as string | number;
        return va > vb ? dir : va < vb ? -dir : 0;
      });
    }

    return result;
  });

  readonly pagedData = computed(() => {
    if (!this.paginated()) return this.filteredData();
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredData().slice(start, start + this.pageSize());
  });

  resolveValue(row: SolDataTableRow, key: string): unknown {
    return key.split('.').reduce<unknown>(
      (obj, k) => (obj == null ? undefined : (obj as SolDataTableRow)[k]),
      row,
    ) ?? '';
  }

  trackId(index: number, row: SolDataTableRow): string | number {
    const key = this.trackByKey();
    if (key) {
      const val = row[key];
      if (val !== undefined && val !== null && val !== '') return val as string | number;
    }
    return index;
  }

  /**
   * Valores únicos (ordenados) de `column` dentro de `data()` — puebla el
   * `<select>` de su filtro (0.6.0). Deriva del dataset completo, no del ya
   * filtrado: así las opciones no desaparecen a medida que el propio
   * usuario filtra.
   */
  columnFilterOptions(column: DataTableColumn): string[] {
    const values = new Set<string>();
    for (const row of this.data()) {
      const value = this.resolveValue(row, column.key);
      if (value !== undefined && value !== null && value !== '') {
        values.add(String(value));
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  /** Estado de expansión de una fila en el modo móvil colapsado. */
  isRowExpanded(id: string | number): boolean {
    return this.expandedRows().has(id);
  }

  /** Expande/colapsa una fila del modo móvil colapsado. */
  toggleRow(id: string | number): void {
    this.expandedRows.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
    // Al filtrar, el detalle expandido pierde contexto — se colapsa todo.
    this.expandedRows.set(new Set());
  }

  /** Cambia el filtro de una columna (0.6.0) desde su input/select nativo. */
  onColumnFilterChange(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.columnFilters.update((current) => ({ ...current, [key]: value }));
    this.currentPage.set(1);
    // Mismo criterio que onSearch: al filtrar, el detalle expandido pierde
    // contexto — se colapsa todo.
    this.expandedRows.set(new Set());
  }

  onSort(key: string): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }
}

/**
 * "Estira" una señal de carga a un tiempo mínimo visible (patrón anti-flash).
 * Con un backend rápido `loading` pasa a `false` en pocos ms y el skeleton
 * parpadea imperceptiblemente; este helper lo mantiene visible al menos
 * `minMs` desde que se encendió, sin agregar latencia real a los datos.
 * Debe invocarse en contexto de inyección (inicializador de campo).
 */
function stretchLoading(source: Signal<boolean>, minMs = 450): Signal<boolean> {
  const visible = signal(source());
  const destroyRef = inject(DestroyRef);
  let onSince = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  effect(() => {
    const loading = source();
    clear();
    if (loading) {
      onSince = Date.now();
      visible.set(true);
      return;
    }
    const elapsed = Date.now() - onSince;
    if (elapsed >= minMs) {
      visible.set(false);
    } else {
      timer = setTimeout(() => {
        visible.set(false);
        timer = null;
      }, minMs - elapsed);
    }
  });

  destroyRef.onDestroy(clear);

  return computed(() => visible());
}

/** Breakpoint canónico usado SOLO como valor inicial anti-flicker (ver abajo). */
const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

/**
 * Señal booleana reactiva al ancho del elemento HOST (0.6.0) — fuente de
 * verdad del colapso a cards vía `ResizeObserver`. Reemplaza el criterio
 * anterior (`matchMedia` sobre el VIEWPORT del navegador): true cuando el
 * ancho medido del host es <= `collapseWidth()`. Así una tabla dentro de un
 * contenedor angosto (sidebar, grid a dos columnas) colapsa aunque la
 * ventana siga en ancho desktop.
 *
 * `matchMedia` contra el breakpoint canónico 767px se conserva SOLO como
 * valor inicial (anti-flicker) hasta que llega la primera medición real del
 * observer — nunca se vuelve a consultar después de eso.
 *
 * Debe invocarse en contexto de inyección (inicializador de campo): usa
 * `DestroyRef` para desconectar el observer al destruir el componente.
 * Guarda para jsdom/SSR: sin `ResizeObserver` queda fija en el valor
 * inicial (mismo criterio que el resto de la lib usa para ese entorno).
 */
function observeContainerWidth(
  host: ElementRef<HTMLElement>,
  collapseWidth: Signal<number>,
): Signal<boolean> {
  const destroyRef = inject(DestroyRef);

  const initial =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_MEDIA_QUERY).matches
      : false;

  const hostWidth = signal<number | null>(null);
  const narrow = computed(() => {
    const width = hostWidth();
    return width === null ? initial : width <= collapseWidth();
  });

  if (typeof ResizeObserver === 'undefined') {
    return narrow;
  }

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) {
      hostWidth.set(entry.contentRect.width);
    }
  });
  observer.observe(host.nativeElement);
  destroyRef.onDestroy(() => observer.disconnect());

  return narrow;
}

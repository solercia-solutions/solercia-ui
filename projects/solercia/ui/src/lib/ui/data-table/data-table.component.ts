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
 * - `cellTemplate`: plantilla opcional para renderizar la celda (recibe el
 *   valor resuelto como `$implicit` y la fila completa como `row`).
 */
export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  badge?: boolean;
  cellTemplate?: TemplateRef<{ $implicit: unknown; row: SolDataTableRow }>;
}

/**
 * Tabla de datos genérica dirigida por columnas: búsqueda, orden, paginación,
 * estado de carga (skeleton), estado vacío y acciones por fila. En viewport
 * móvil colapsa cada fila a un resumen expandible (sin scroll horizontal)
 * cuando el tema activo lo prefiere (`component.table.mobile: "collapse"`).
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

    <div class="sol-data-table" [attr.aria-busy]="loadingVisible() || null">
      @if (showToolbar()) {
        <div class="sol-data-table__toolbar">
          <div class="sol-data-table__toolbar-left">
            <ng-content select="[tableActions]" />
          </div>
          <div class="sol-data-table__toolbar-right">
            <sol-search-input
              [placeholder]="searchPlaceholder()"
              (searchChange)="onSearch($event)"
            />
          </div>
        </div>
      }

      <!-- Acciones por fila compartidas entre el modo tabla y el modo móvil. -->
      <ng-template #rowActionButtons let-row>
        @if (rowActionsTemplate(); as tpl) {
          <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row }" />
        } @else {
          <div class="sol-data-table__action-group">
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
          </div>
        }
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
                  [attr.aria-label]="toggleDetailsLabel()"
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
              <li class="sol-data-table__empty">{{ emptyMessage() }}</li>
            }
          </ul>
        }
      } @else {
        <div class="sol-data-table__wrapper">
          <table class="sol-data-table__table">
            <thead>
              <tr>
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
                @if (showActions()) {
                  <th class="sol-data-table__th sol-data-table__th--actions">{{ actionsLabel() }}</th>
                }
              </tr>
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
                    @for (col of columns(); track col.key) {
                      <td class="sol-data-table__td">
                        @if (col.cellTemplate) {
                          <ng-container *ngTemplateOutlet="col.cellTemplate; context: { $implicit: resolveValue(row, col.key), row: row }" />
                        } @else {
                          {{ resolveValue(row, col.key) }}
                        }
                      </td>
                    }
                    @if (showActions()) {
                      <td class="sol-data-table__td sol-data-table__td--actions">
                        <ng-container *ngTemplateOutlet="rowActionButtons; context: { $implicit: row }" />
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td class="sol-data-table__empty" [attr.colspan]="columns().length + (showActions() ? 1 : 0)">
                      {{ emptyMessage() }}
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

    .sol-data-table__th--actions {
      width: 100px;
      text-align: center;
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

  readonly data = input<SolDataTableRow[]>([]);
  readonly columns = input<DataTableColumn[]>([]);
  /**
   * Estado de carga de la fuente de datos: sustituye el cuerpo por filas
   * skeleton tokenizadas y oculta la paginación mientras esté activo.
   */
  readonly loading = input<boolean>(false);
  readonly searchPlaceholder = input<string>('Buscar...');
  readonly emptyMessage = input<string>('No hay datos disponibles');
  readonly paginated = input<boolean>(true);
  readonly showToolbar = input<boolean>(true);
  readonly filterPosition = input<'left' | 'right'>('left');
  readonly showActions = input<boolean>(true);
  readonly showEditAction = input<boolean>(true);
  readonly showDeleteAction = input<boolean>(true);
  readonly trackByKey = input<string>('id');
  /** Encabezado de la columna de acciones. */
  readonly actionsLabel = input<string>('Acciones');
  /**
   * aria-label del botón ▶ de expansión de fila en el modo móvil. El default
   * se alinea con el texto de la clave i18n `shared.table.toggleDetails`
   * para que cualquier consumidor que no lo sobreescriba (vía
   * `[toggleDetailsLabel]`) obtenga el texto correcto sin necesidad de
   * traducción explícita.
   */
  readonly toggleDetailsLabel = input<string>('Mostrar u ocultar el detalle de la fila');
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

  /**
   * Clave de replay de `solRowReveal`: cambia con cualquier búsqueda, orden
   * o paginación — reinicia la animación de entrada de las filas visibles
   * (paridad con el widget local: `solRevealReplay` sobre el mismo filtro).
   */
  readonly revealReplayKey = computed(
    () => `${this.searchTerm()}:${this.sortKey()}:${this.sortDirection()}:${this.currentPage()}`,
  );

  /** Señal reactiva de viewport móvil (breakpoint canónico 767px). */
  readonly isMobileViewport = observeMobileViewport();

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

  /** El modo colapsado aplica solo en viewport móvil con preferencia "collapse". */
  readonly mobileCollapse = computed(
    () => this.isMobileViewport() && this.tableMobileMode() === 'collapse',
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

/** Ancho canónico bajo el cual la tabla adopta su comportamiento móvil. */
const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

/**
 * Señal booleana reactiva al viewport móvil. Debe invocarse en contexto de
 * inyección (inicializador de campo): usa `DestroyRef` para retirar el
 * listener. Guarda para jsdom/SSR: sin `matchMedia` queda en `false`
 * (comportamiento desktop).
 */
function observeMobileViewport(): Signal<boolean> {
  const destroyRef = inject(DestroyRef);
  const matches = signal(false);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return matches.asReadonly();
  }

  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
  matches.set(mediaQueryList.matches);

  if (typeof mediaQueryList.addEventListener === 'function') {
    const onChange = (event: MediaQueryListEvent): void => matches.set(event.matches);
    mediaQueryList.addEventListener('change', onChange);
    destroyRef.onDestroy(() => mediaQueryList.removeEventListener('change', onChange));
  }

  return matches.asReadonly();
}

import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolIconComponent } from '../icon/icon.component';
import {
  computeGlobalRange,
  computeMonthAxisTicks,
  collectUndatedNodes,
  defaultStatusToken,
  positionRows,
  type PositionedTimelineRow,
} from './timeline-position';
import type {
  SolTimelineStatusResolver,
  TimelineLegendItem,
  TimelineNode,
} from './timeline.model';

const MONTH_KEYS = Array.from({ length: 12 }, (_, i) => `shared.timeline.months.${i}`);

/**
 * `sol-timeline` — timeline jerárquico N-niveles, genérico y sin
 * dependencias externas (spec: solercia-ui-timeline, design.md D5).
 * Generaliza el motor `%` de `sprint-timeline` de `gestion_proyectos`;
 * NUNCA conoce `epic`/`sprint`/`historia de usuario` — el consumidor mapea
 * su dominio al contrato `TimelineNode`.
 *
 * Colapso/expansión: "espejo" propio (mismo patrón que `sol-kanban-board`),
 * sembrado desde `node.collapsed` de la entrada y actualizado por clic —
 * NUNCA muta los objetos de entrada. Emite `nodeToggled` para que el
 * consumidor persista el estado si lo necesita.
 *
 * Robustez de entrada (lección del PR3): `nodes` tolera `null`/`undefined`
 * (Angular no garantiza que un `input.required()` resuelva a un valor
 * no-nulo en runtime) y cada nodo tolera fechas inválidas/ausentes — ver
 * `timeline-position.ts`.
 */
@Component({
  selector: 'sol-timeline',
  standalone: true,
  imports: [SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!hasAnyNodes()) {
      <p class="sol-timeline__empty">{{ emptyLabel() }}</p>
    } @else {
      <div class="sol-timeline">
        @if (rows().length > 0) {
          <div class="sol-timeline__chart">
            <div class="sol-timeline__axis">
              @for (tick of axisLabels(); track tick.leftPct + tick.label) {
                <span class="sol-timeline__axis-label" [style.left.%]="tick.leftPct">{{ tick.label }}</span>
              }
            </div>
            <div class="sol-timeline__axis-rule"></div>

            <div class="sol-timeline__rows">
              @for (row of rows(); track row.node.id) {
                <div class="sol-timeline__row">
                  <div class="sol-timeline__row-header" [style.padding-left.px]="row.depth * 20">
                    @if (collapsible() && row.node.children?.length) {
                      <button
                        type="button"
                        class="sol-timeline__toggle"
                        [attr.aria-expanded]="!isCollapsedRow(row.node)"
                        [attr.aria-label]="isCollapsedRow(row.node) ? expandLabel() : collapseLabel()"
                        (click)="toggle(row.node)"
                      >
                        <sol-icon
                          name="chevron-right"
                          size="sm"
                          [style.transform]="isCollapsedRow(row.node) ? 'none' : 'rotate(90deg)'"
                        />
                      </button>
                    } @else {
                      <span class="sol-timeline__toggle-spacer" aria-hidden="true"></span>
                    }
                    <span class="sol-timeline__label">{{ labelOf(row.node) }}</span>
                  </div>

                  <div class="sol-timeline__track">
                    <div
                      class="sol-timeline__bar"
                      [style.left.%]="row.leftPct"
                      [style.width.%]="row.widthPct"
                      [style.background]="colorOf(row.node)"
                      [attr.title]="labelOf(row.node)"
                      (click)="nodeClicked.emit(row.node)"
                    ></div>
                  </div>
                </div>
              }
            </div>

            @if (legend().length > 0) {
              <div class="sol-timeline__legend">
                @for (item of legend(); track item.status) {
                  <span class="sol-timeline__legend-item">
                    <span class="sol-timeline__legend-swatch" [style.background]="resolveColor(item.status)"></span>
                    {{ legendLabel(item) }}
                  </span>
                }
              </div>
            }
          </div>
        }

        @if (undatedNodes().length > 0) {
          <div class="sol-timeline__undated">
            <p class="sol-timeline__undated-title">{{ undatedTitle() }}</p>
            <div class="sol-timeline__undated-list">
              @for (node of undatedNodes(); track node.id) {
                <span class="sol-timeline__chip" [style.color]="colorOf(node)">{{ labelOf(node) }}</span>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--sol-font-family);
    }

    .sol-timeline__empty {
      padding: var(--sol-space-lg, 24px) 0;
      text-align: center;
      font-size: var(--sol-font-size-sm, 0.875rem);
      color: var(--sol-color-text-muted, #94a3b8);
    }

    .sol-timeline__chart {
      overflow-x: auto;
    }

    .sol-timeline__axis {
      position: relative;
      height: 20px;
      margin-bottom: var(--sol-space-xs, 4px);
      font-size: var(--sol-font-size-xs, 0.75rem);
      color: var(--sol-color-text-muted, #94a3b8);
    }

    .sol-timeline__axis-label {
      position: absolute;
      white-space: nowrap;
      transform: translateX(-50%);
    }

    .sol-timeline__axis-rule {
      height: 1px;
      margin-bottom: var(--sol-space-sm, 8px);
      background: var(--sol-border-color-default, #e2e8f0);
    }

    .sol-timeline__rows {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-xs, 4px);
      min-width: 480px;
    }

    .sol-timeline__row {
      display: grid;
      grid-template-columns: minmax(140px, 220px) 1fr;
      align-items: center;
      gap: var(--sol-space-sm, 8px);
      min-height: 32px;
    }

    .sol-timeline__row-header {
      display: flex;
      align-items: center;
      gap: var(--sol-space-xs, 4px);
      min-width: 0;
    }

    .sol-timeline__toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: var(--sol-border-radius-sm, 4px);
      background: transparent;
      color: var(--sol-color-text-secondary, #64748b);
      cursor: pointer;
      flex-shrink: 0;
    }

    .sol-timeline__toggle:hover {
      background: color-mix(in srgb, var(--sol-color-primary, #6366f1) 10%, transparent);
    }

    .sol-timeline__toggle sol-icon {
      transition: transform 0.15s ease;
    }

    .sol-timeline__toggle-spacer {
      display: inline-block;
      width: 20px;
      flex-shrink: 0;
    }

    .sol-timeline__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sol-font-size-sm, 0.875rem);
      color: var(--sol-color-text-primary, #0f172a);
    }

    .sol-timeline__track {
      position: relative;
      height: 20px;
      border-radius: var(--sol-border-radius-sm, 4px);
      background: color-mix(in srgb, var(--sol-color-text-muted, #94a3b8) 10%, transparent);
    }

    .sol-timeline__bar {
      position: absolute;
      inset-block: 0;
      border-radius: var(--sol-border-radius-sm, 4px);
      cursor: pointer;
    }

    .sol-timeline__legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sol-space-md, 16px);
      margin-top: var(--sol-space-md, 16px);
      font-size: var(--sol-font-size-xs, 0.75rem);
      color: var(--sol-color-text-muted, #94a3b8);
    }

    .sol-timeline__legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .sol-timeline__legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: var(--sol-border-radius-sm, 2px);
    }

    .sol-timeline__undated {
      margin-top: var(--sol-space-md, 16px);
    }

    .sol-timeline__undated-title {
      margin: 0 0 var(--sol-space-sm, 8px);
      font-size: var(--sol-font-size-xs, 0.75rem);
      font-weight: 500;
      color: var(--sol-color-text-muted, #94a3b8);
    }

    .sol-timeline__undated-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sol-space-sm, 8px);
    }

    .sol-timeline__chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-full, 9999px);
      padding: 2px 10px;
      font-size: var(--sol-font-size-xs, 0.75rem);
      font-weight: 500;
    }
  `,
})
export class SolTimelineComponent {
  private readonly i18n = inject(SOL_I18N);

  /**
   * Nodos raíz del timeline. Tipado `TimelineNode[] | null | undefined` a
   * propósito: `input.required()` exige que el BINDING exista, no que su
   * valor ya esté resuelto (lección del PR3 — `sol-avatar`).
   */
  readonly nodes = input.required<TimelineNode[] | null | undefined>();

  /** Resuelve `status` → color CSS. Default: `ui/tone/sol-tone.ts` (mismo mapa que score-badge/trend). */
  readonly statusToken = input<SolTimelineStatusResolver | null>(null);

  readonly legend = input<TimelineLegendItem[]>([]);

  /** `false` deshabilita por completo el control de colapso (todo se renderiza expandido). */
  readonly collapsible = input<boolean>(true);

  readonly nodeToggled = output<{ id: string | number; collapsed: boolean }>();
  readonly nodeClicked = output<TimelineNode>();

  /** Espejo interno del colapso — sembrado desde `node.collapsed`, nunca muta la entrada. */
  private readonly collapsedIds = signal<ReadonlySet<string | number>>(new Set());

  /**
   * Siembra `collapsedIds` SOLO la primera vez que el `effect` corre (con
   * los `nodes` ya resueltos). Distinto del patrón "espejo" de
   * `sol-kanban-board`: ahí el re-siembro en CADA cambio de `columns` es un
   * rollback DELIBERADO (el consumidor reasigna el input para deshacer un
   * drag fallido). Aquí NO — `TimelineNode.collapsed` es explícitamente el
   * estado INICIAL al montar (ver `timeline.model.ts`); reasignar `nodes`
   * después (p. ej. porque llegó una actualización del backend) NUNCA debe
   * descartar lo que el usuario ya colapsó/expandió con clics.
   */
  private hasSeededCollapse = false;

  constructor() {
    effect(() => {
      const currentNodes = this.nodes();
      if (this.hasSeededCollapse) return;
      this.hasSeededCollapse = true;

      const initial = new Set<string | number>();
      const seed = (list: TimelineNode[], visited: WeakSet<TimelineNode>) => {
        for (const node of list) {
          if (!node || visited.has(node)) continue; // guarda de ciclos (CRITICAL-3)
          visited.add(node);
          if (node.collapsed) initial.add(node.id);
          if (node.children?.length) seed(node.children, visited);
        }
      };
      seed(currentNodes ?? [], new WeakSet());
      this.collapsedIds.set(initial);
    });
  }

  readonly hasAnyNodes = computed(() => (this.nodes() ?? []).length > 0);

  private readonly globalRange = computed(() => computeGlobalRange(this.nodes()));

  readonly rows = computed<PositionedTimelineRow[]>(() => {
    const range = this.globalRange();
    if (!range) return [];
    const collapsible = this.collapsible();
    const collapsed = this.collapsedIds();
    return positionRows(this.nodes(), range, {
      isCollapsed: (node) => collapsible && collapsed.has(node.id),
    });
  });

  readonly undatedNodes = computed(() => collectUndatedNodes(this.nodes()));

  private readonly monthLabels = this.i18n.tMany(MONTH_KEYS);

  readonly axisLabels = computed(() => {
    const range = this.globalRange();
    if (!range) return [];
    const labels = this.monthLabels();
    return computeMonthAxisTicks(range).map((tick) => ({
      leftPct: tick.leftPct,
      label: `${labels[tick.month] ?? ''} ${tick.year}`,
    }));
  });

  readonly emptyLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.timeline.emptyState');
  });

  readonly undatedTitle = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.timeline.undatedTitle');
  });

  readonly expandLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.timeline.expandNode');
  });

  readonly collapseLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.timeline.collapseNode');
  });

  labelOf(node: TimelineNode): string {
    if (node.labelKey) {
      this.i18n.activeLang();
      return this.i18n.translate(node.labelKey);
    }
    return node.label ?? '';
  }

  legendLabel(item: TimelineLegendItem): string {
    this.i18n.activeLang();
    return this.i18n.translate(item.labelKey);
  }

  colorOf(node: TimelineNode): string {
    return this.resolveColor(node.status);
  }

  resolveColor(status: string | undefined): string {
    const resolver = this.statusToken() ?? defaultStatusToken;
    return resolver(status);
  }

  isCollapsedRow(node: TimelineNode): boolean {
    return this.collapsedIds().has(node.id);
  }

  toggle(node: TimelineNode): void {
    if (!node.children?.length) return;
    const next = new Set(this.collapsedIds());
    const collapsed = !next.has(node.id);
    if (collapsed) {
      next.add(node.id);
    } else {
      next.delete(node.id);
    }
    this.collapsedIds.set(next);
    this.nodeToggled.emit({ id: node.id, collapsed });
  }
}

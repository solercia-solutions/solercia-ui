import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  computed,
  contentChild,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolIconComponent } from '../icon/icon.component';
import {
  buildOffsets,
  classifyItemsChange,
  computeWindow,
  isAtBottom,
  resolveHeights,
} from './virtual-window';

/** Contexto del template de ítem proyectado. */
export interface SolVirtualScrollItemContext<T> {
  $implicit: T;
  index: number;
}

interface VisibleRow<T> {
  item: T;
  index: number;
  key: string | number;
}

/**
 * `sol-virtual-scroll` — virtual scroll PROPIO del design system (E5), sin
 * CDK ni librerías: renderiza solo los ítems visibles + buffer con
 * espaciadores que preservan el alto total.
 *
 * - **Altura variable**: cada ítem arranca con `estimatedItemHeight` y se
 *   corrige con la altura REAL medida tras el render (por clave estable,
 *   así la medición sobrevive a prepends). La matemática vive en
 *   `virtual-window.ts` (funciones puras con spec propia).
 * - **Anclaje al fondo (patrón chat)**: con `followOutput` activo, los
 *   ítems nuevos al final empujan el scroll al fondo SOLO si el usuario ya
 *   estaba al fondo; si scrolleó hacia arriba, el scroll no se arrastra y
 *   aparece el chip "mensajes nuevos" con el conteo.
 * - **Paginación hacia atrás**: emite `nearTop` al acercarse al inicio y
 *   compensa el scroll cuando se prepende una página de ítems antiguos
 *   (sin salto visual).
 *
 * Uso:
 * ```html
 * <sol-virtual-scroll [items]="messages()" [itemKey]="byId" [estimatedItemHeight]="64" (nearTop)="loadOlder()">
 *   <ng-template let-msg let-index="index">…</ng-template>
 * </sol-virtual-scroll>
 * ```
 * El host debe darle altura (ocupa el 100% de su contenedor).
 */
@Component({
  selector: 'sol-virtual-scroll',
  standalone: true,
  imports: [NgTemplateOutlet, SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #viewport class="sol-virtual-scroll__viewport" (scroll)="onScroll()">
      <div
        class="sol-virtual-scroll__spacer"
        [style.height.px]="window().padTop"
        aria-hidden="true"
      ></div>
      @for (row of visibleRows(); track row.key) {
        <div class="sol-virtual-scroll__item">
          <ng-container
            [ngTemplateOutlet]="itemTemplate()"
            [ngTemplateOutletContext]="{ $implicit: row.item, index: row.index }"
          />
        </div>
      }
      <div
        class="sol-virtual-scroll__spacer"
        [style.height.px]="window().padBottom"
        aria-hidden="true"
      ></div>
    </div>

    @if (newItemsCount() > 0) {
      <button
        type="button"
        class="sol-virtual-scroll__chip"
        data-testid="chip-mensajes-nuevos"
        (click)="jumpToBottom()"
      >
        <sol-icon name="chevron-down" size="sm" />
        <span class="sol-virtual-scroll__chip-count">{{ newItemsCount() }}</span>
        <span>{{ chipLabel() }}</span>
      </button>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      height: 100%;
      min-height: 0;
    }

    .sol-virtual-scroll__viewport {
      height: 100%;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .sol-virtual-scroll__chip {
      position: absolute;
      bottom: var(--sol-space-md, 1rem);
      left: 50%;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: 1px solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-full, 999px);
      background: var(--sol-bg-surface, #ffffff);
      color: var(--sol-color-primary, #2563eb);
      font-family: var(--sol-font-family);
      font-size: var(--sol-font-size-sm, 13px);
      font-weight: 600;
      box-shadow: var(--sol-shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
      cursor: pointer;
      transition: filter var(--sol-transition-fast, 150ms ease);
    }

    .sol-virtual-scroll__chip:hover {
      filter: brightness(0.97);
    }

    .sol-virtual-scroll__chip-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: var(--sol-border-radius-full, 999px);
      background: var(--sol-color-primary, #2563eb);
      color: var(--sol-color-primary-contrast, #ffffff);
      font-size: var(--sol-font-size-xs, 11px);
    }
  `,
})
export class SolVirtualScrollComponent<T = unknown> implements AfterViewChecked {
  private readonly i18n = injectSolI18n();

  /** Lista completa de ítems (el componente solo renderiza la ventana). */
  readonly items = input.required<readonly T[]>();

  /**
   * Clave ESTABLE por ítem (ej. id del mensaje). Gobierna el track del
   * render, el mapa de alturas medidas y la detección append/prepend.
   * Por defecto usa el índice (suficiente para listas append-only).
   */
  readonly itemKey = input<(item: T, index: number) => string | number>((_, i) => i);

  /** Altura estimada por ítem mientras no exista medición real. */
  readonly estimatedItemHeight = input(56);

  /** Buffer en px renderizado por fuera del viewport (arriba y abajo). */
  readonly bufferPx = input(240);

  /** Anclaje al fondo tipo chat (nuevos ítems empujan si ya estabas al fondo). */
  readonly followOutput = input(true);

  /** Distancia al inicio (px) que dispara `nearTop` (paginación hacia atrás). */
  readonly nearTopThreshold = input(120);

  /** Se acerca al inicio de la lista: cargar página anterior. */
  readonly nearTop = output<void>();

  /** Cambió el estado "está al fondo" (ej. para ocultar acciones). */
  readonly atBottomChange = output<boolean>();

  /** Template del ítem, proyectado por el consumidor. */
  readonly itemTemplate = contentChild.required(TemplateRef<SolVirtualScrollItemContext<T>>);

  private readonly viewportRef =
    viewChild.required<ElementRef<HTMLElement>>('viewport');

  // ── Estado interno ──
  private readonly scrollTop = signal(0);
  private readonly viewportHeight = signal(0);
  private readonly measured = signal<ReadonlyMap<string | number, number>>(new Map());
  private readonly _atBottom = signal(true);
  private readonly _newItemsCount = signal(0);

  /** ¿El usuario está al fondo del hilo? */
  readonly atBottom = this._atBottom.asReadonly();

  /** Ítems nuevos llegados mientras el usuario estaba scrolleado arriba. */
  readonly newItemsCount = this._newItemsCount.asReadonly();

  readonly chipLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.virtualScroll.newMessages');
  });

  // ── Derivados de ventana (matemática pura) ──
  private readonly keys = computed<(string | number)[]>(() => {
    const key = this.itemKey();
    return this.items().map((item, i) => key(item, i));
  });

  private readonly offsets = computed(() => {
    const items = this.items();
    const keys = this.keys();
    const heights = resolveHeights(
      items.length,
      this.estimatedItemHeight(),
      this.measured(),
      i => keys[i],
    );
    return buildOffsets(heights);
  });

  readonly window = computed(() =>
    computeWindow(this.offsets(), this.scrollTop(), this.viewportHeight(), this.bufferPx()),
  );

  readonly visibleRows = computed<VisibleRow<T>[]>(() => {
    const { start, end } = this.window();
    const items = this.items();
    const keys = this.keys();
    const rows: VisibleRow<T>[] = [];
    for (let i = start; i < end; i++) {
      rows.push({ item: items[i], index: i, key: keys[i] });
    }
    return rows;
  });

  // ── Reacciones a cambios de lista (anclaje / chip / compensación) ──
  private prevKeys: (string | number)[] = [];
  private pendingScrollToBottom = false;
  private pendingPrependCount = 0;
  private nearTopArmed = true;
  private lastEmittedAtBottom: boolean | null = null;

  constructor() {
    effect(() => {
      const nextKeys = this.keys();
      untracked(() => this.onItemsChanged(nextKeys));
    });
  }

  ngAfterViewChecked(): void {
    const el = this.viewportRef().nativeElement;

    // 1. Alto real del viewport (0 en jsdom → la ventana usa solo el buffer).
    const clientHeight = el.clientHeight;
    if (clientHeight !== this.viewportHeight()) {
      this.viewportHeight.set(clientHeight);
    }

    // 2. Medición de alturas reales de las filas renderizadas (por clave).
    this.measureRenderedRows(el);

    // 3. Compensación de prepend: mantener la posición visual.
    if (this.pendingPrependCount > 0) {
      const delta = this.offsets()[this.pendingPrependCount] ?? 0;
      this.pendingPrependCount = 0;
      if (delta > 0) {
        el.scrollTop = el.scrollTop + delta;
        this.syncFromViewport(el);
      }
    }

    // 4. Anclaje al fondo pendiente (carga inicial, mensaje propio, chip).
    if (this.pendingScrollToBottom) {
      this.pendingScrollToBottom = false;
      this.applyScrollToBottom(el);
    } else if (this.followOutput() && this._atBottom()) {
      // Corrección de deriva: si estamos anclados y una medición tardía
      // cambió el alto total, re-pegar al fondo.
      const target = this.window().totalHeight - this.viewportHeight();
      if (target > 0 && el.scrollTop < target) {
        this.applyScrollToBottom(el);
      }
    }
  }

  onScroll(): void {
    const el = this.viewportRef().nativeElement;
    this.syncFromViewport(el);

    const st = this.scrollTop();
    const threshold = this.nearTopThreshold();
    if (st <= threshold && this.nearTopArmed && this.items().length > 0) {
      this.nearTopArmed = false;
      this.nearTop.emit();
    } else if (st > threshold) {
      this.nearTopArmed = true;
    }
  }

  /** Salta al fondo del hilo y limpia el chip de mensajes nuevos. */
  scrollToBottom(): void {
    this._newItemsCount.set(0);
    this._atBottom.set(true);
    this.pendingScrollToBottom = true;
    this.applyScrollToBottom(this.viewportRef().nativeElement);
  }

  jumpToBottom(): void {
    this.scrollToBottom();
  }

  // ── Privados ──

  private onItemsChanged(nextKeys: (string | number)[]): void {
    const change = classifyItemsChange(this.prevKeys, nextKeys);
    this.prevKeys = nextKeys;

    if (change.reset) {
      this.measured.set(new Map());
      this._newItemsCount.set(0);
      this.nearTopArmed = true;
      if (this.followOutput()) {
        this._atBottom.set(true);
        this.pendingScrollToBottom = true;
      }
      return;
    }

    if (change.prepended > 0) {
      this.pendingPrependCount = change.prepended;
      this.nearTopArmed = true;
    }

    if (change.appended > 0) {
      if (this.followOutput() && this._atBottom()) {
        this.pendingScrollToBottom = true;
      } else {
        this._newItemsCount.update(n => n + change.appended);
      }
    }
  }

  private measureRenderedRows(viewport: HTMLElement): void {
    const rows = this.visibleRows();
    if (rows.length === 0) return;

    const els = viewport.querySelectorAll<HTMLElement>('.sol-virtual-scroll__item');
    let changes: Map<string | number, number> | null = null;
    const current = this.measured();

    els.forEach((rowEl, i) => {
      const row = rows[i];
      if (!row) return;
      const height = rowEl.offsetHeight;
      // jsdom/elementos ocultos miden 0: se ignoran (queda la estimada).
      if (height <= 0) return;
      if (current.get(row.key) === height && !changes?.has(row.key)) return;
      changes ??= new Map(current);
      changes.set(row.key, height);
    });

    if (changes) {
      this.measured.set(changes);
    }
  }

  private applyScrollToBottom(el: HTMLElement): void {
    const target = Math.max(0, this.window().totalHeight - this.viewportHeight());
    el.scrollTop = target;
    this.syncFromViewport(el);
  }

  private syncFromViewport(el: HTMLElement): void {
    this.scrollTop.set(el.scrollTop);

    const bottom = isAtBottom(el.scrollTop, this.viewportHeight(), this.window().totalHeight);
    if (bottom !== this._atBottom()) {
      this._atBottom.set(bottom);
    }
    if (bottom) {
      this._newItemsCount.set(0);
    }
    if (bottom !== this.lastEmittedAtBottom) {
      this.lastEmittedAtBottom = bottom;
      this.atBottomChange.emit(bottom);
    }
  }
}

import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { SolIconComponent } from '../icon/icon.component';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { bodyScrollLock } from '../overlay/body-scroll-lock';
import { createFocusTrap, type FocusTrapHandle } from '../overlay/focus-trap';
import { shouldCloseOnBackdrop, shouldCloseOnEscape } from '../overlay/overlay-interactions';

export type SolDrawerSide = 'start' | 'end';
export type SolDrawerSize = 'sm' | 'md' | 'lg';
/**
 * `panel` (default): comportamiento de SIEMPRE — panel lateral que en móvil
 * (≤640px) pasa a ancho completo (ver CSS de abajo, SIN cambios).
 * `sheet` (PR-C4, Ola 5 GOAL §4 punto 3, "canvas de lectura en viewport
 * móvil... tap en nodo → BOTTOM SHEET casi completo"): idéntico a `panel` en
 * desktop (>767px) — el bottom sheet es un patrón EXCLUSIVAMENTE móvil; a
 * ≤767px se apila desde ABAJO (no desde `side()`) ocupando ~92dvh con
 * esquinas superiores redondeadas, en vez del slide lateral. Aditivo — NUNCA
 * rompe la API existente, ningún consumidor actual pasa `variant`.
 */
export type SolDrawerVariant = 'panel' | 'sheet';

/**
 * Panel lateral (drawer / side sheet) a alto completo, hermano de `sol-modal`
 * para formularios largos con contenido desplegable (11-h-sol-drawer). Reusa
 * el mismo enfoque inline de `sol-modal` (position:fixed + `--sol-z-modal`,
 * consistencia de la casa; sin CDK ni portal a `document.body`) y comparte
 * los helpers de overlay (`overlay/`) para Escape, backdrop, candado de
 * scroll y focus trap.
 */
@Component({
  selector: 'sol-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  template: `
    @if (open()) {
      <div
        [class]="overlayClasses()"
        (click)="onBackdropClick()"
      >
        <div
          #panel
          [class]="panelClasses()"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <header class="sol-drawer-header">
            <h2 [id]="titleId" class="sol-drawer-title">{{ title() }}</h2>
            @if (closeable()) {
              <button
                type="button"
                class="sol-drawer-close"
                [attr.aria-label]="closeLabel()"
                (click)="close()"
              >
                <sol-icon name="x" size="md" />
              </button>
            }
          </header>

          <div class="sol-drawer-body">
            <ng-content />
          </div>

          <ng-content select="[drawerFooter]" />
        </div>
      </div>
    }
  `,
  styles: `
    .sol-drawer-overlay {
      position: fixed;
      inset: 0;
      z-index: var(--sol-z-modal, 1000);
      display: flex;
      background: var(--sol-bg-overlay, rgba(0, 0, 0, 0.5));
      /* Desenfoque del fondo (frosted glass), personalizable por tema. */
      backdrop-filter: var(--sol-overlay-blur, blur(3px));
      -webkit-backdrop-filter: var(--sol-overlay-blur, blur(3px));
      animation: sol-drawer-fade-in var(--sol-dur-base, 240ms) var(--sol-ease-entrance, cubic-bezier(0.2, 0, 0, 1));
    }

    .sol-drawer-overlay--start { justify-content: flex-start; }
    .sol-drawer-overlay--end { justify-content: flex-end; }

    .sol-drawer-panel {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100dvh;
      background: var(--sol-bg-surface, #fff);
      box-shadow: var(--sol-shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.3));
      outline: none;
      animation: sol-drawer-slide-in var(--sol-dur-base, 240ms) var(--sol-ease-entrance, cubic-bezier(0.2, 0, 0, 1));
    }

    .sol-drawer-panel--start {
      --sol-drawer-slide-from: -100%;
      border-right: 1px solid var(--sol-border-color-default, #e5e7eb);
      border-top-right-radius: var(--sol-border-radius-lg, 12px);
      border-bottom-right-radius: var(--sol-border-radius-lg, 12px);
    }

    .sol-drawer-panel--end {
      --sol-drawer-slide-from: 100%;
      border-left: 1px solid var(--sol-border-color-default, #e5e7eb);
      border-top-left-radius: var(--sol-border-radius-lg, 12px);
      border-bottom-left-radius: var(--sol-border-radius-lg, 12px);
    }

    .sol-drawer-sm { width: min(20rem, 100vw); }
    .sol-drawer-md { width: min(28rem, 100vw); }
    .sol-drawer-lg { width: min(40rem, 100vw); }

    .sol-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--sol-border-color-default, #e5e7eb);
      flex: none;
    }

    .sol-drawer-title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--sol-color-text-primary, #111827);
    }

    .sol-drawer-close {
      /* PR-C4 (GOAL §4, hit-area invisible >= 44px): min-width/height reales
         (medibles con getBoundingClientRect) — el icono interno (size md,
         sin cambios) queda centrado, la tinta visible no crece. */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.75rem;
      min-height: 2.75rem;
      border: none;
      border-radius: var(--sol-border-radius-lg, 8px);
      background: transparent;
      color: var(--sol-color-text-secondary, #6b7280);
      cursor: pointer;
      transition: background var(--sol-dur-fast, 120ms) ease, color var(--sol-dur-fast, 120ms) ease;
    }

    .sol-drawer-close:hover {
      background: var(--sol-color-bg-hover, rgba(0, 0, 0, 0.06));
      color: var(--sol-color-text-primary, #111827);
    }

    .sol-drawer-body {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 1.5rem;
    }

    /* ── Móvil ────────────────────────────────────────────────────────
       El drawer ocupa el 100% del ancho del viewport, sin borde ni
       esquinas redondeadas del lado interno (bottom-sheet queda fuera
       de alcance, 11-h-sol-drawer). */
    @media (max-width: 640px) {
      .sol-drawer-sm,
      .sol-drawer-md,
      .sol-drawer-lg {
        width: 100vw;
      }

      .sol-drawer-panel--start,
      .sol-drawer-panel--end {
        border-left: none;
        border-right: none;
        border-radius: 0;
      }
    }

    /* -- Variante sheet (bottom sheet, PR-C4) --------------------------
       SOLO a <=767px (mismo breakpoint que el apilado de filas de
       transición de flow-node-editor-drawer, Ola 5 PR-C3) — arriba de eso,
       sheet se ve IDÉNTICO al panel lateral de siempre (el bottom sheet es
       un patrón exclusivamente móvil). El modificador --sheet es una clase
       ADITIVA (se agrega junto a --start/--end, nunca las reemplaza) — por
       eso las reglas de acá ganan en cascada (mismo peso de especificidad,
       definidas DESPUÉS en la hoja de estilos). */
    @media (max-width: 767px) {
      .sol-drawer-overlay--sheet {
        align-items: flex-end;
      }

      .sol-drawer-panel--sheet {
        width: 100vw;
        height: min(92dvh, 100dvh);
        max-height: 92dvh;
        border-left: 1px solid var(--sol-border-color-default, #e5e7eb);
        border-right: 1px solid var(--sol-border-color-default, #e5e7eb);
        border-top-left-radius: var(--sol-border-radius-lg, 12px);
        border-top-right-radius: var(--sol-border-radius-lg, 12px);
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        animation: sol-drawer-sheet-slide-up var(--sol-dur-base, 240ms) var(--sol-ease-entrance, cubic-bezier(0.2, 0, 0, 1));
      }
    }

    @keyframes sol-drawer-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes sol-drawer-slide-in {
      from { transform: translateX(var(--sol-drawer-slide-from, 100%)); }
      to   { transform: translateX(0); }
    }

    @keyframes sol-drawer-sheet-slide-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }

    /* Reduced motion: aparición directa, sin desplazamiento (mismo patrón
       de parada dura que sol-skeleton). */
    @media (prefers-reduced-motion: reduce) {
      .sol-drawer-overlay,
      .sol-drawer-panel {
        animation: none;
      }
    }
  `,
})
export class SolDrawerComponent {
  private static nextId = 0;
  private readonly i18n = inject(SOL_I18N);

  /** Whether the drawer is open. */
  readonly open = input<boolean>(false);

  /** Title displayed in the drawer header. */
  readonly title = input<string>('');

  /** Side the panel enters from. Right (`end`) is the default. */
  readonly side = input<SolDrawerSide>('end');

  /** Width preset for the drawer panel. */
  readonly size = input<SolDrawerSize>('md');

  /** Visual variant — `panel` (default, unchanged) or `sheet` (PR-C4, bottom sheet on mobile only). See {@link SolDrawerVariant}. */
  readonly variant = input<SolDrawerVariant>('panel');

  /** Whether the drawer can be closed by the user. */
  readonly closeable = input<boolean>(true);

  /**
   * Whether clicking the backdrop closes the drawer. Unlike `sol-modal`
   * (reserved for confirmations, backdrop-close is opt-in and defaults to
   * `false`), the drawer/side-sheet pattern defaults to closing on backdrop
   * click, matching the common side-sheet UX.
   */
  readonly closeOnBackdrop = input<boolean>(true);

  /** Emitted when the drawer requests to be closed. */
  readonly closed = output<void>();

  private readonly panelEl = viewChild<ElementRef<HTMLElement>>('panel');

  /** Unique id consumed by `aria-labelledby`. */
  readonly titleId = `sol-drawer-title-${SolDrawerComponent.nextId++}`;

  readonly overlayClasses = computed(
    () =>
      `sol-drawer-overlay sol-drawer-overlay--${this.side()}` +
      (this.variant() === 'sheet' ? ' sol-drawer-overlay--sheet' : ''),
  );

  readonly panelClasses = computed(
    () =>
      `sol-drawer-panel sol-drawer-panel--${this.side()} sol-drawer-${this.size()}` +
      (this.variant() === 'sheet' ? ' sol-drawer-panel--sheet' : ''),
  );

  readonly closeLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.drawer.close');
  });

  constructor() {
    // Focus trap + candado de scroll: se activan cuando el panel se monta
    // (open=true) y se desactivan automáticamente al cerrarse o al destruir
    // el componente — mismo patrón `effect(onCleanup ⇒ …)` que usa el portal
    // de sol-select para su ciclo de vida.
    effect(onCleanup => {
      const panel = this.panelEl()?.nativeElement ?? null;
      if (!panel) return;

      const trigger = document.activeElement as HTMLElement | null;
      bodyScrollLock.lock();
      const trap: FocusTrapHandle = createFocusTrap(panel);
      trap.activate(trigger);

      onCleanup(() => {
        trap.deactivate();
        bodyScrollLock.unlock();
      });
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (shouldCloseOnEscape(this.open(), this.closeable())) {
      this.close();
    }
  }

  onBackdropClick(): void {
    if (shouldCloseOnBackdrop(this.closeable(), this.closeOnBackdrop())) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }
}

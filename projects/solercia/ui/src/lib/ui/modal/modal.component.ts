import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { SolIconComponent } from '../icon/icon.component';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { bodyScrollLock } from '../overlay/body-scroll-lock';
import { createFocusTrap } from '../overlay/focus-trap';
import { shouldCloseOnBackdrop, shouldCloseOnEscape } from '../overlay/overlay-interactions';

@Component({
  selector: 'sol-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  template: `
    @if (open()) {
      <div
        class="sol-modal-overlay"
        (click)="onBackdropClick()"
      >
        <div
          #panel
          class="sol-modal-content"
          [class]="panelClasses()"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="title() ? titleId : null"
          [attr.aria-label]="title() ? null : ariaLabel() || null"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <header class="sol-modal-header">
            @if (title()) {
              <h2 [id]="titleId" class="sol-modal-title">{{ title() }}</h2>
            }
            @if (closeable()) {
              <button
                type="button"
                class="sol-modal-close"
                [attr.aria-label]="closeLabel()"
                (click)="close()"
              >
                <sol-icon name="x" size="md" />
              </button>
            }
          </header>

          <div class="sol-modal-body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .sol-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: var(--sol-z-modal, 1000);
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--sol-bg-overlay, rgba(0, 0, 0, 0.5));
      /* Desenfoque del fondo (frosted glass), personalizable por tema. */
      backdrop-filter: var(--sol-overlay-blur, blur(3px));
      -webkit-backdrop-filter: var(--sol-overlay-blur, blur(3px));
      animation: sol-modal-fade-in 0.15s ease-out;
    }

    .sol-modal-content {
      position: relative;
      display: flex;
      flex-direction: column;
      background: var(--sol-bg-surface, #fff);
      border-radius: var(--sol-border-radius-lg, 12px);
      box-shadow: var(--sol-shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.3));
      max-height: 90vh;
      overflow: visible;
      animation: sol-modal-scale-in 0.2s ease-out;
    }

    .sol-modal-sm { width: min(24rem, 95vw); }
    .sol-modal-md { width: min(32rem, 95vw); }
    .sol-modal-lg { width: min(48rem, 95vw); }
    .sol-modal-xl { width: min(64rem, 95vw); }

    .sol-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--sol-border-color-default, #e5e7eb);
    }

    .sol-modal-title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--sol-color-text-primary, #111827);
    }

    .sol-modal-content:focus {
      outline: none;
    }

    .sol-modal-close {
      margin-inline-start: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: none;
      border-radius: var(--sol-border-radius-lg, 8px);
      background: transparent;
      color: var(--sol-color-text-secondary, #6b7280);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .sol-modal-close:hover {
      background: var(--sol-color-bg-hover, rgba(0, 0, 0, 0.06));
      color: var(--sol-color-text-primary, #111827);
    }

    .sol-modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      max-height: calc(90vh - 4rem);
    }

    /* ── Móvil (estructura base v2) ─────────────────────────────────
       El panel limita su ancho al viewport real menos márgenes y su alto
       con scroll interno del body — ningún tema puede desbordarlo. */
    @media (max-width: 767px) {
      .sol-modal-sm,
      .sol-modal-md,
      .sol-modal-lg,
      .sol-modal-xl {
        width: min(430px, calc(100vw - 32px));
      }

      .sol-modal-content {
        max-height: calc(100dvh - 32px);
      }

      .sol-modal-body {
        max-height: calc(100dvh - 32px - 4rem);
      }
    }

    /* Touch screens: the close button meets the 44px touch target. */
    @media (pointer: coarse) {
      .sol-modal-close {
        width: var(--sol-size-control-touch, 44px);
        height: var(--sol-size-control-touch, 44px);
      }
    }

    @keyframes sol-modal-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes sol-modal-scale-in {
      from { opacity: 0; transform: scale(0.95); }
      to   { opacity: 1; transform: scale(1); }
    }
  `,
})
export class SolModalComponent {
  private static nextId = 0;
  private readonly i18n = injectSolI18n();

  /** Whether the modal is open. */
  open = input<boolean>(false);

  /** Title displayed in the modal header. */
  title = input<string>('');

  /** Width preset for the modal panel. */
  size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  /** Whether the modal can be closed by the user. */
  closeable = input<boolean>(true);

  /** Whether clicking the backdrop closes the modal. */
  closeOnBackdrop = input<boolean>(false);

  /** Accessible name of the dialog when there is no `title` (ignored when a title is set). */
  ariaLabel = input<string>('');

  /** Emitted when the modal requests to be closed. */
  closed = output<void>();

  /** Computed CSS class for the panel size. */
  panelClasses = computed(() => `sol-modal-content sol-modal-${this.size()}`);

  /** Unique id consumed by `aria-labelledby`. */
  readonly titleId = `sol-modal-title-${SolModalComponent.nextId++}`;

  /** Accessible label of the close button (`shared.modal.close`). */
  readonly closeLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.modal.close');
  });

  private readonly panelEl = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    // Same lifecycle as sol-drawer: while the panel is mounted, the background scroll is
    // locked and focus is trapped inside; on close (or destroy) both are released and
    // focus returns to the element that was focused before opening.
    effect(onCleanup => {
      const panel = this.panelEl()?.nativeElement ?? null;
      if (!panel) return;

      const trigger = document.activeElement as HTMLElement | null;
      bodyScrollLock.lock();
      const trap = createFocusTrap(panel);
      trap.activate(trigger);

      onCleanup(() => {
        trap.deactivate();
        bodyScrollLock.unlock();
      });
    });
  }

  // Escape and backdrop share the gating helpers of sol-drawer.
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

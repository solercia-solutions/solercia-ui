import { ChangeDetectionStrategy, Component, HostListener, computed, input, output } from '@angular/core';
import { SolIconComponent, type SolIconName } from '../icon/icon.component';

/** Variante visual: define el ícono y el color del botón de confirmación. */
export type SolConfirmDialogVariant = 'danger' | 'warning' | 'info';

const CONFIRM_ICON_NAMES: Readonly<Record<SolConfirmDialogVariant, SolIconName>> = {
  danger: 'x-circle',
  warning: 'exclamation-triangle',
  info: 'information-circle',
};

/**
 * `<sol-confirm-dialog>`: diálogo de confirmación con ícono por variante, título, mensaje y dos
 * acciones (confirmar a la izquierda, cancelar a la derecha). Escape y clic en el fondo cancelan.
 *
 * El componente no guarda estado: el host decide cuándo abrirlo (`open`) y qué hacer con
 * `confirm` y `cancel`.
 */
@Component({
  selector: 'sol-confirm-dialog',
  standalone: true,
  imports: [SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="sol-confirm-overlay"
        role="alertdialog"
        aria-modal="true"
        data-testid="sol-confirm-dialog"
        [attr.aria-label]="title()"
        (click)="onBackdropClick()"
      >
        <div class="sol-confirm-panel" (click)="$event.stopPropagation()">
          <div class="sol-confirm-header">
            <sol-icon class="sol-confirm-icon" [class]="iconClasses()" [name]="iconName()" />
            <h2 class="sol-confirm-title">{{ title() }}</h2>
          </div>

          @if (message()) {
            <p class="sol-confirm-message">{{ message() }}</p>
          }

          <div class="sol-confirm-actions">
            <button type="button" data-testid="sol-confirm-accept" [class]="confirmBtnClasses()" (click)="onConfirm()">
              {{ confirmLabel() }}
            </button>
            <button
              type="button"
              data-testid="sol-confirm-cancel"
              class="sol-confirm-btn sol-confirm-btn--cancel"
              (click)="onCancel()"
            >
              {{ cancelLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .sol-confirm-overlay {
      position: fixed;
      inset: 0;
      z-index: var(--sol-z-modal, 1000);
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--sol-bg-overlay, rgba(0, 0, 0, 0.5));
      backdrop-filter: var(--sol-overlay-blur, blur(3px));
      -webkit-backdrop-filter: var(--sol-overlay-blur, blur(3px));
      animation: sol-confirm-fade-in 0.15s ease-out;
    }
    .sol-confirm-panel {
      width: min(28rem, 92vw);
      background: var(--sol-bg-surface, #ffffff);
      border-radius: var(--sol-border-radius-lg, 12px);
      box-shadow: var(--sol-shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.3));
      padding: var(--sol-space-lg, 1.5rem);
      animation: sol-confirm-scale-in 0.2s ease-out;
    }
    .sol-confirm-header {
      display: flex;
      align-items: center;
      gap: var(--sol-space-sm, 0.75rem);
      margin-bottom: var(--sol-space-sm, 0.5rem);
    }
    .sol-confirm-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--sol-border-radius-full, 9999px);
      flex-shrink: 0;
    }
    .sol-confirm-icon--danger {
      background: color-mix(in srgb, var(--sol-color-danger, #ef4444) 12%, transparent);
      color: var(--sol-color-danger, #ef4444);
    }
    .sol-confirm-icon--warning {
      background: color-mix(in srgb, var(--sol-color-warning, #f59e0b) 12%, transparent);
      color: var(--sol-color-warning, #f59e0b);
    }
    .sol-confirm-icon--info {
      background: color-mix(in srgb, var(--sol-color-info, #3b82f6) 12%, transparent);
      color: var(--sol-color-info, #3b82f6);
    }
    .sol-confirm-title {
      margin: 0;
      font-size: var(--sol-font-size-lg, 1.125rem);
      font-weight: 600;
      color: var(--sol-color-text-primary, #111827);
    }
    .sol-confirm-message {
      margin: var(--sol-space-sm, 0.5rem) 0 0 0;
      padding-left: calc(40px + var(--sol-space-sm, 0.75rem));
      font-size: var(--sol-font-size-sm, 0.875rem);
      color: var(--sol-color-text-secondary, #6b7280);
      line-height: 1.5;
    }
    .sol-confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--sol-space-sm, 0.5rem);
      margin-top: var(--sol-space-lg, 1.5rem);
    }
    .sol-confirm-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--sol-space-sm, 0.5rem) var(--sol-space-md, 1rem);
      border: none;
      border-radius: var(--sol-border-radius-md, 8px);
      font-size: var(--sol-font-size-sm, 0.875rem);
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: background-color 0.15s ease, opacity 0.15s ease;
      line-height: 1;
      min-height: 36px;
    }
    .sol-confirm-btn--cancel {
      background: transparent;
      color: var(--sol-color-primary, #6366f1);
    }
    .sol-confirm-btn--cancel:hover {
      background: color-mix(in srgb, var(--sol-color-primary, #6366f1) 10%, transparent);
    }
    .sol-confirm-btn--danger {
      background: var(--sol-color-danger, #ef4444);
      color: var(--sol-confirm-on-color, #ffffff);
    }
    .sol-confirm-btn--danger:hover {
      background: color-mix(in srgb, var(--sol-color-danger, #ef4444) 85%, var(--sol-confirm-hover-shade, #000000));
    }
    .sol-confirm-btn--warning {
      background: var(--sol-color-warning, #f59e0b);
      color: var(--sol-confirm-on-color, #ffffff);
    }
    .sol-confirm-btn--warning:hover {
      background: color-mix(in srgb, var(--sol-color-warning, #f59e0b) 85%, var(--sol-confirm-hover-shade, #000000));
    }
    .sol-confirm-btn--info {
      background: var(--sol-color-info, #3b82f6);
      color: var(--sol-confirm-on-color, #ffffff);
    }
    .sol-confirm-btn--info:hover {
      background: color-mix(in srgb, var(--sol-color-info, #3b82f6) 85%, var(--sol-confirm-hover-shade, #000000));
    }
    .sol-confirm-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #6366f1) 40%, transparent);
    }
    @keyframes sol-confirm-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes sol-confirm-scale-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `,
})
export class SolConfirmDialogComponent {
  /** Abre o cierra el diálogo. */
  readonly open = input<boolean>(false);
  /** Título del diálogo. */
  readonly title = input<string>('¿Estás seguro?');
  /** Mensaje bajo el título (opcional). */
  readonly message = input<string>('');
  /** Texto del botón de confirmación. */
  readonly confirmLabel = input<string>('Confirmar');
  /** Texto del botón de cancelación. */
  readonly cancelLabel = input<string>('Cancelar');
  /** Variante visual: ícono y color del botón de confirmación. */
  readonly variant = input<SolConfirmDialogVariant>('danger');

  /** La persona confirmó la acción. */
  readonly confirm = output<void>();
  /** La persona canceló (botón, Escape o clic en el fondo). */
  readonly cancel = output<void>();

  protected readonly iconClasses = computed(() => `sol-confirm-icon sol-confirm-icon--${this.variant()}`);
  protected readonly confirmBtnClasses = computed(() => `sol-confirm-btn sol-confirm-btn--${this.variant()}`);
  protected readonly iconName = computed((): SolIconName => CONFIRM_ICON_NAMES[this.variant()]);

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.open()) this.onCancel();
  }

  protected onBackdropClick(): void {
    this.onCancel();
  }

  protected onConfirm(): void {
    this.confirm.emit();
  }

  protected onCancel(): void {
    this.cancel.emit();
  }
}

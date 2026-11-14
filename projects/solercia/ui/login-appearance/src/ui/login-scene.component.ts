import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { hasLoginShapes, type LoginView } from '../model/login-appearance.model';
import { SolLoginPhotosComponent } from './login-photos.component';

/**
 * What sits behind the form: photos, veil, shapes and caption. Every layer is fixed to the
 * viewport (or to the preview canvas, whose `transform` contains them) and takes no events. The
 * real login (`sol-login-frame`) and the editor preview share it.
 */
@Component({
  standalone: true,
  selector: 'sol-login-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolLoginPhotosComponent],
  template: `
    <sol-login-photos
      [photos]="view().images"
      [effect]="view().effect"
      [transition]="view().transition"
      [intervalMs]="view().intervalMs"
      (activePhoto)="activePhoto.set($event)"
    />
    @if (!withShapes()) {
      <div [class]="'veil veil--' + view().position" aria-hidden="true" data-testid="login-veil"></div>
    }
    <div [class]="captionVeilClass()" aria-hidden="true" data-testid="login-caption-veil"></div>
    <div [class]="'caption caption--' + view().captionPosition" [class.caption--marks-below]="!withShapes()">
      @if (view().indicators && view().images.length > 1) {
        <div class="caption__marks" data-testid="login-caption-indicators" aria-hidden="true">
          @for (photo of view().images; track photo; let i = $index) {
            <span class="caption__mark" [class.caption__mark--active]="i === activePhoto()"></span>
          }
        </div>
      }
      @if (view().label; as label) {
        <p class="caption__label" data-testid="login-caption-label">{{ label }}</p>
      }
      @if (tagline()) {
        <p class="caption__text sol-display" data-testid="login-caption-text">{{ tagline() }}</p>
      }
    </div>
  `,
  styles: `
    .veil, .caption-veil {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }

    /* Starts almost opaque, hides where the panel begins and fades continuously. It ends at 30%
       of the width or a little after the panel when the panel is farther. */
    .veil--right, .veil--left {
      --sol-login-veil-end: max(30%, 520px);
      --sol-login-veil-start: min(0.96, calc(var(--sol-auth-veil-to, 0.94) * 1.12));
      background: linear-gradient(var(--sol-login-veil-dir),
        rgba(var(--sol-auth-veil-rgb), var(--sol-login-veil-start)) 0%,
        rgba(var(--sol-auth-veil-rgb), calc(var(--sol-login-veil-start) * 0.96)) calc(var(--sol-login-veil-end) * 0.2),
        rgba(var(--sol-auth-veil-rgb), calc(var(--sol-login-veil-start) * 0.84)) calc(var(--sol-login-veil-end) * 0.4),
        rgba(var(--sol-auth-veil-rgb), calc(var(--sol-login-veil-start) * 0.62)) calc(var(--sol-login-veil-end) * 0.6),
        rgba(var(--sol-auth-veil-rgb), calc(var(--sol-login-veil-start) * 0.4)) calc(var(--sol-login-veil-end) * 0.75),
        rgba(var(--sol-auth-veil-rgb), calc(var(--sol-login-veil-start) * 0.14)) calc(var(--sol-login-veil-end) * 0.9),
        rgba(var(--sol-auth-veil-rgb), 0) var(--sol-login-veil-end));
    }
    .veil--right { --sol-login-veil-dir: 270deg; }
    .veil--left { --sol-login-veil-dir: 90deg; }

    /* Centered: only around the panel, leaving the rest of the photo untouched. */
    .veil--center {
      background: radial-gradient(ellipse 32% 62% at center,
        rgba(var(--sol-auth-veil-rgb), calc(var(--sol-auth-veil-to, 0.94) * 0.8)) 58%,
        rgba(var(--sol-auth-veil-rgb), 0) 100%);
    }

    /* Darkens the caption area: the caption text is light in light mode too. */
    .caption-veil--bottom {
      background: linear-gradient(0deg,
        rgba(var(--sol-auth-caption-rgb), var(--sol-auth-veil-bottom, 0.55)) 0%,
        rgba(var(--sol-auth-caption-rgb), 0) var(--sol-auth-caption-reach, 30%));
    }
    .caption-veil--bottom-left { background: radial-gradient(ellipse 55% 50% at 0% 100%, rgba(var(--sol-auth-caption-rgb), 0.72), transparent); }
    .caption-veil--bottom-right { background: radial-gradient(ellipse 55% 50% at 100% 100%, rgba(var(--sol-auth-caption-rgb), 0.72), transparent); }
    .caption-veil--top-left { background: radial-gradient(ellipse 55% 50% at 0% 0%, rgba(var(--sol-auth-caption-rgb), 0.72), transparent); }
    .caption-veil--top-right { background: radial-gradient(ellipse 55% 50% at 100% 0%, rgba(var(--sol-auth-caption-rgb), 0.72), transparent); }

    .caption {
      position: absolute;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-sm, 8px);
      max-width: min(34vw, 420px);
      color: var(--sol-auth-caption-color, var(--sol-color-text-primary));
      pointer-events: none;
    }

    .caption--bottom-left { left: clamp(24px, 4vw, 56px); bottom: clamp(24px, 4vw, 56px); }
    .caption--bottom-right { right: clamp(24px, 4vw, 56px); bottom: clamp(24px, 4vw, 56px); text-align: right; align-items: flex-end; }
    .caption--top-left { left: clamp(24px, 4vw, 56px); top: clamp(24px, 4vw, 56px); }
    .caption--top-right { right: clamp(24px, 4vw, 56px); top: clamp(24px, 4vw, 56px); text-align: right; align-items: flex-end; }

    .caption__marks { display: flex; gap: 6px; }
    .caption--marks-below .caption__marks { order: 1; }
    .caption__mark {
      width: 28px;
      height: 2px;
      border-radius: 2px;
      background: currentColor;
      opacity: 0.35;
      transition: opacity 0.6s var(--sol-ease, ease);
    }
    .caption__mark--active { opacity: 1; }

    .caption__label {
      margin: 0;
      color: var(--sol-auth-caption-label, currentColor);
      opacity: var(--sol-auth-caption-label-opacity, 0.85);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 500;
    }

    .caption__text {
      margin: 0;
      font-size: 22px;
      font-weight: 500;
      line-height: 1.25;
      text-wrap: pretty;
    }

    @media (max-width: 1099.98px) {
      .caption, .caption-veil { display: none; }
    }
  `,
})
export class SolLoginSceneComponent {
  readonly view = input.required<LoginView>();
  /** Large caption text (for example, the theme `meta.tagline`). Empty hides it. */
  readonly tagline = input('');

  protected readonly activePhoto = signal(0);
  protected readonly withShapes = computed(() => hasLoginShapes(this.view().background));
  /** With a gradient and the caption below, a bottom band; otherwise only the caption corner. */
  protected readonly captionVeilClass = computed(() => {
    const { captionPosition } = this.view();
    const band = !this.withShapes() && captionPosition.startsWith('bottom');
    return `caption-veil caption-veil--${band ? 'bottom' : captionPosition}`;
  });
}

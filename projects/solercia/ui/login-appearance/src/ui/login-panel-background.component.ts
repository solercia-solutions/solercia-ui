import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { hasLoginShapes, type LoginBackground, type LoginPosition } from '../model/login-appearance.model';

/**
 * Background of the form. With gradient, glass or solid it is the rectangular panel (driven by the
 * `--sol-auth-panel-*` variables). With a shape there is no panel or veil: the shape is the
 * container. Below 768 px, with a shape, a simple panel comes back.
 */
@Component({
  standalone: true,
  selector: 'sol-login-panel-background',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class]': 'classes()' },
  template: `<span class="panel"></span>`,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: var(--sol-auth-panel-radius, var(--sol-card-radius, var(--sol-border-radius-lg)));
    }

    :host(:not(.with-shapes)) { z-index: -1; }

    span {
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }

    .panel {
      background: var(--sol-auth-panel-bg, color-mix(in srgb, var(--sol-bg-surface) 48%, transparent));
      border: var(--sol-auth-panel-border, 1px solid transparent);
      backdrop-filter: var(--sol-auth-panel-filter, none);
      -webkit-backdrop-filter: var(--sol-auth-panel-filter, none);
    }

    :host(.side-right) { --sol-login-fade: 270deg; }
    :host(.side-left) { --sol-login-fade: 90deg; }

    :host(.bg-glass-fade:not(.side-center)) .panel {
      -webkit-mask-image: linear-gradient(var(--sol-login-fade), transparent 0%, rgba(0, 0, 0, 0.04) 14%, rgba(0, 0, 0, 0.35) 42%, black 72%);
      mask-image: linear-gradient(var(--sol-login-fade), transparent 0%, rgba(0, 0, 0, 0.04) 14%, rgba(0, 0, 0, 0.35) 42%, black 72%);
    }

    :host(.bg-glass-fade.side-center) .panel {
      -webkit-mask-image: radial-gradient(ellipse 72% 72% at center, black 62%, transparent 100%);
      mask-image: radial-gradient(ellipse 72% 72% at center, black 62%, transparent 100%);
    }

    :host(.bg-solid) .panel {
      background: var(--sol-bg-surface);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    :host(.with-shapes) .panel { display: none; }

    @media (max-width: 767.98px) {
      :host(.bg-glass-fade) .panel {
        -webkit-mask-image: none;
        mask-image: none;
      }

      :host(.with-shapes) .panel {
        display: block;
        background: color-mix(in srgb, var(--sol-bg-surface) 88%, transparent);
        border: 0;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }
    }
  `,
})
export class SolLoginPanelBackgroundComponent {
  readonly background = input.required<LoginBackground>();
  readonly position = input.required<LoginPosition>();

  protected readonly classes = computed(() =>
    [`bg-${this.background()}`, `side-${this.position()}`, hasLoginShapes(this.background()) ? 'with-shapes' : ''].join(' ').trim(),
  );
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { hasLoginShapes, type LoginView } from '../model/login-appearance.model';
import { SolLoginBrandComponent, type LoginBrandLogo } from './login-brand.component';
import { SolLoginPanelBackgroundComponent } from './login-panel-background.component';
import { SolLoginSceneComponent } from './login-scene.component';
import { SolLoginShapesComponent } from './login-shapes.component';

/**
 * Themed sign-in frame: photos, veil, shapes and caption from `meta.login`, and the card where the
 * host projects its own form (`<ng-content>`: user and password, SSO buttons, notices…). The
 * library ships no auth logic and makes no HTTP call. With `view` null (no photos anywhere) it
 * renders a plain centered card on the page background, so the host keeps one template.
 *
 * ```html
 * <sol-login-frame [view]="view()" [tagline]="tagline()" [logo]="logo()" [dark]="isDark()">
 *   <h1>…</h1>
 *   <my-login-form />
 * </sol-login-frame>
 * ```
 */
@Component({
  standalone: true,
  selector: 'sol-login-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolLoginSceneComponent, SolLoginShapesComponent, SolLoginPanelBackgroundComponent, SolLoginBrandComponent],
  template: `
    <div
      class="frame"
      data-login-frame
      data-testid="login-frame"
      [class.frame--immersive]="view() !== null"
      [class.frame--shapes]="withShapes()"
      [attr.data-pos]="view()?.position ?? null"
      [attr.data-background]="view()?.background ?? null"
      [style]="view()?.variables ?? null"
    >
      @if (view(); as scene) {
        <sol-login-scene [view]="scene" [tagline]="tagline()" />
      }
      <main class="frame__panel">
        <div class="frame__card" data-testid="login-frame-card">
          @if (view(); as scene) {
            @if (withShapes()) {
              <sol-login-shapes [background]="scene.background" [position]="scene.position" />
            }
            <sol-login-panel-background [background]="scene.background" [position]="scene.position" />
          }
          <div class="frame__content">
            @if (logo()) {
              <sol-login-brand [logo]="logo()" [dark]="dark()" [tagline]="brandTagline()" />
            }
            <ng-content />
          </div>
        </div>
      </main>
    </div>
  `,
  styles: `
    :host { display: block; }

    .frame {
      position: relative;
      isolation: isolate;
      display: flex;
      box-sizing: border-box;
      min-height: 100vh;
      min-height: 100dvh;
      padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)
        env(safe-area-inset-left, 0px);
      overflow: hidden;
      color: var(--sol-color-text-primary);
      background-color: var(--sol-bg-page);
    }

    .frame__panel {
      position: relative;
      z-index: 1;
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(24px, 4vw, 48px);
    }

    .frame__card {
      position: relative;
      width: 100%;
      max-width: 400px;
      box-sizing: border-box;
      padding: clamp(24px, 3vw, 36px);
      background: var(--sol-card-bg, var(--sol-bg-surface));
      border: var(--sol-card-border, 1px solid transparent);
      border-radius: var(--sol-card-radius, var(--sol-border-radius-lg));
      box-shadow: var(--sol-card-shadow, var(--sol-shadow-lg));
    }

    .frame__content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
    }

    @media (min-width: 768px) {
      .frame[data-pos='left'] .frame__panel { justify-content: flex-start; }
      .frame[data-pos='right'] .frame__panel { justify-content: flex-end; }
    }

    .frame--immersive .frame__card {
      max-width: 420px;
      background: none;
      border: 0;
      box-shadow: none;
    }

    .frame--immersive:not(.frame--shapes) .frame__card { isolation: isolate; }

    @media (max-height: 700px) {
      .frame--immersive .frame__panel { padding-block: var(--sol-space-sm, 8px); }
    }

    /* The shape is the container: to multiply with the photo, neither the panel nor the card may
       create a stacking context. */
    .frame--shapes .frame__panel {
      z-index: auto;
      padding-inline: var(--sol-auth-shape-margin, 48px);
    }

    .frame--shapes .frame__card { border-radius: 0; }

    @media (max-width: 767.98px) {
      .frame__panel { padding: var(--sol-space-lg, 24px) var(--sol-space-md, 16px) var(--sol-space-xl, 48px); }
      .frame--shapes .frame__panel { padding-inline: var(--sol-space-md, 16px); }
    }
  `,
})
export class SolLoginFrameComponent {
  /** Resolved appearance (`resolveLoginView` / `buildLoginView`); `null` keeps the classic card. */
  readonly view = input<LoginView | null>(null);
  /** Large caption text over the photo (for example, the theme `meta.tagline`). */
  readonly tagline = input('');
  /** Brand block above the projected form; without it the host renders its own. */
  readonly logo = input<LoginBrandLogo | null>(null);
  /** Optional line under the logo. */
  readonly brandTagline = input<string | null>(null);
  /** Active mode, to pick the dark logo variant. */
  readonly dark = input(false);

  protected readonly withShapes = computed(() => {
    const view = this.view();
    return view !== null && hasLoginShapes(view.background);
  });
}

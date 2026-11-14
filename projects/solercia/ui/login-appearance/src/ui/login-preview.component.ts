import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { resolveCssVars, type ThemeFile } from '@solercia/ui';
import { injectLoginAppearanceText } from '../i18n/login-appearance.i18n';
import { hasLoginShapes, type LoginView } from '../model/login-appearance.model';
import { SolLoginBrandComponent } from './login-brand.component';
import { SolLoginPanelBackgroundComponent } from './login-panel-background.component';
import { SolLoginSceneComponent } from './login-scene.component';
import { SolLoginShapesComponent } from './login-shapes.component';

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 800;
const INITIAL_SCALE = 0.4;

/**
 * The login, scaled inside a frame, with the same scene, shapes and panel as the real one. The
 * canvas `transform` is the containing block of its `position: fixed` layers. The tokens of the
 * shown mode apply only here: "Dark" looks dark even when the app is light, and vice versa. The
 * form is an inert mock: the preview never signs in.
 */
@Component({
  standalone: true,
  selector: 'sol-login-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolLoginSceneComponent, SolLoginShapesComponent, SolLoginBrandComponent, SolLoginPanelBackgroundComponent],
  template: `
    <div class="frame" [style.height.px]="height()">
      <div
        class="canvas"
        inert
        data-login-frame
        [class.canvas--shapes]="withShapes()"
        [style]="variables()"
        [style.transform]="'scale(' + scale() + ')'"
        [attr.data-pos]="view().position"
        data-testid="login-preview"
      >
        <sol-login-scene [view]="view()" [tagline]="shownTagline()" />
        <div class="panel">
          <div class="card">
            @if (withShapes()) {
              <sol-login-shapes [background]="view().background" [position]="view().position" />
            }
            <sol-login-panel-background [background]="view().background" [position]="view().position" />
            <div class="content">
              <sol-login-brand [logo]="logo()" [dark]="dark()" />
              <p class="title">{{ t('preview.welcome') }}</p>
              <div class="field">
                <span class="field__label">{{ t('preview.email') }}</span>
                <span class="field__box">{{ t('preview.emailPlaceholder') }}</span>
              </div>
              <div class="field">
                <span class="field__label">{{ t('preview.password') }}</span>
                <span class="field__box">{{ t('preview.passwordPlaceholder') }}</span>
              </div>
              <span class="check"><span class="check__box"></span>{{ t('preview.remember') }}</span>
              <span class="button">{{ t('preview.submit') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }

    .frame {
      position: relative;
      overflow: hidden;
      border-radius: var(--sol-border-radius-md);
      background: var(--sol-bg-page);
    }

    .canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 1280px;
      height: 800px;
      overflow: hidden;
      transform-origin: top left;
      isolation: isolate;
      color: var(--sol-color-text-primary);
      background: var(--sol-bg-page);
      font-family: var(--sol-font-family);
    }

    .panel {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px;
    }
    .canvas[data-pos='left'] .panel { justify-content: flex-start; }
    .canvas[data-pos='right'] .panel { justify-content: flex-end; }
    .canvas--shapes .panel { z-index: auto; padding-inline: var(--sol-auth-shape-margin, 48px); }

    .card {
      position: relative;
      isolation: isolate;
      width: 420px;
      padding: 36px;
    }
    .canvas--shapes .card { isolation: auto; }

    .content { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; }

    .title { margin: 0; font-size: 28px; font-weight: 600; text-align: center; }

    .field { display: flex; flex-direction: column; gap: 6px; }
    .field__label { font-size: 12px; font-weight: 500; color: var(--sol-color-text-secondary); }
    .field__box {
      display: flex;
      align-items: center;
      height: 42px;
      padding: 0 12px;
      box-sizing: border-box;
      border-radius: var(--sol-input-radius, var(--sol-border-radius-md));
      background: var(--sol-input-bg, var(--sol-bg-surface));
      border: var(--sol-input-border, 1px solid var(--sol-border-color-default));
      color: var(--sol-color-text-muted);
      font-size: 14px;
    }

    .check { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .check__box {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 2px solid var(--sol-border-color-default);
      box-sizing: border-box;
    }

    .button {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      border-radius: var(--sol-button-radius, var(--sol-border-radius-md));
      background: var(--sol-color-primary);
      color: var(--sol-color-primary-contrast);
      font-weight: 600;
    }
  `,
})
export class SolLoginPreviewComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly t = injectLoginAppearanceText();

  readonly view = input.required<LoginView>();
  /** Theme whose tokens paint the frame for the shown mode; `null` keeps the app tokens. */
  readonly theme = input<ThemeFile | null>(null);
  readonly dark = input(false);
  /** Caption text; by default the theme `meta.tagline` or the library fallback. */
  readonly tagline = input<string | null>(null);

  protected readonly shownTagline = computed(
    () => this.tagline() ?? (this.theme()?.meta?.tagline?.trim() || this.t('taglineFallback')),
  );
  protected readonly logo = computed(() => this.theme()?.meta?.logo ?? null);

  protected readonly scale = signal(INITIAL_SCALE);
  protected readonly height = signal(FRAME_HEIGHT * INITIAL_SCALE);
  protected readonly withShapes = computed(() => hasLoginShapes(this.view().background));

  protected readonly variables = computed(() => ({ ...this.modeTokens(), ...this.view().variables }));

  constructor() {
    afterNextRender(() => this.observeWidth());
  }

  /** A theme that cannot be resolved must not break the preview: it keeps the app tokens. */
  private modeTokens(): Record<string, string> {
    const theme = this.theme();
    if (!theme) return {};
    try {
      return Object.fromEntries(resolveCssVars(theme, this.dark() ? 'dark' : 'light'));
    } catch {
      return {};
    }
  }

  private observeWidth(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const scale = entry.contentRect.width / FRAME_WIDTH;
      if (scale <= 0) return;
      this.scale.set(scale);
      this.height.set(FRAME_HEIGHT * scale);
    });
    observer.observe(this.element.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}

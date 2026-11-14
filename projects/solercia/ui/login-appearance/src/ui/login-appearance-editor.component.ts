import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { take, type Observable } from 'rxjs';
import { SolIconComponent, ThemeService, type ThemeFile } from '@solercia/ui';
import { injectLoginAppearanceText } from '../i18n/login-appearance.i18n';
import { buildLoginView, isAllowedLoginImage } from '../lib/normalize-login';
import {
  LOGIN_BACKGROUNDS,
  LOGIN_DEFAULT_BACKGROUND,
  LOGIN_DEFAULT_EFFECT,
  LOGIN_DEFAULT_POSITION,
  LOGIN_DEFAULT_TRANSITION,
  LOGIN_EFFECTS,
  LOGIN_INTERVAL_DEFAULT_MS,
  LOGIN_INTERVAL_MAX_MS,
  LOGIN_INTERVAL_MIN_MS,
  LOGIN_MAX_IMAGES,
  LOGIN_POSITIONS,
  LOGIN_TRANSITIONS,
  type LoginBackground,
  type LoginMode,
  type LoginPosition,
  type ThemeLogin,
  type ThemeLoginModeConfig,
} from '../model/login-appearance.model';
import { SolLoginPreviewComponent } from './login-preview.component';
import { SolLoginShapesComponent } from './login-shapes.component';

/** Uploads one photo and returns its published URL (usually the store `uploadLogo`). */
export type LoginPhotoUploader = (file: File) => Observable<string>;

/** First value of an upload, as a promise that never rejects (an empty stream counts as an error). */
function settle(source: Observable<string>): Promise<{ url: string } | { error: unknown }> {
  return new Promise(resolve => {
    source.pipe(take(1)).subscribe({
      next: url => resolve({ url: String(url) }),
      error: (error: unknown) => resolve({ error }),
      complete: () => resolve({ error: null }),
    });
  });
}

const INTERVAL_STEP_MS = 1000;
const MODES: readonly LoginMode[] = ['light', 'dark'];

/**
 * Editor of the theme `meta.login` block: photos, motion, per-mode composition and caption, with
 * a live preview. It emits the whole block only when the person changes something; saving is the
 * host's job (inside `sol-theme-studio`, its «Aplicar tema»). Veil and panel have no controls: they
 * travel untouched inside the block.
 */
@Component({
  standalone: true,
  selector: 'sol-login-appearance-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolLoginPreviewComponent, SolLoginShapesComponent, SolIconComponent],
  template: `
    <div class="editor">
      <div class="controls">
        <fieldset>
          <legend>{{ t('editor.photos.title') }}</legend>
          @if (images().length === 0) {
            <p class="hint" data-testid="login-photos-empty">{{ t('editor.photos.empty') }}</p>
          }
          <ul class="photos">
            @for (photo of images(); track photo; let i = $index) {
              <li>
                <img [src]="photo" alt="" />
                <span class="photos__name">{{ nameOf(photo) }}</span>
                <button type="button" class="icon" [attr.aria-label]="t('editor.photos.moveUp', { n: i + 1 })" [disabled]="i === 0" (click)="move(i, -1)" [attr.data-testid]="'login-photo-up-' + i">
                  <sol-icon name="chevron-up" size="sm" />
                </button>
                <button type="button" class="icon" [attr.aria-label]="t('editor.photos.moveDown', { n: i + 1 })" [disabled]="i === images().length - 1" (click)="move(i, 1)" [attr.data-testid]="'login-photo-down-' + i">
                  <sol-icon name="chevron-down" size="sm" />
                </button>
                <button type="button" class="icon" [attr.aria-label]="t('editor.photos.remove', { n: i + 1 })" (click)="remove(i)" [attr.data-testid]="'login-photo-remove-' + i">
                  <sol-icon name="x-mark" size="sm" />
                </button>
              </li>
            }
          </ul>
          @if (uploader()) {
            <input #file class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple tabindex="-1" [disabled]="full() || uploading() !== null" data-testid="login-photos-file" (change)="onFiles($event)" />
            <button type="button" class="btn" data-testid="login-photos-add" [disabled]="full() || uploading() !== null" (click)="file.click()">{{ t('editor.photos.add') }}</button>
          } @else {
            <p class="hint" data-testid="login-photos-unavailable">{{ t('editor.photos.uploadUnavailable') }}</p>
          }
          @if (full()) {
            <p class="hint" data-testid="login-photos-limit">{{ t('editor.photos.limit', { max: maxImages }) }}</p>
          }
          @if (uploading(); as u) {
            <p class="hint" role="status" aria-live="polite" data-testid="login-photos-uploading">{{ t('editor.photos.uploading', { current: u.current, total: u.total }) }}</p>
          }
          @if (photoError(); as error) {
            <p class="error" role="alert" data-testid="login-photos-error">{{ error }}</p>
          }
        </fieldset>

        <fieldset>
          <legend>{{ t('editor.motion.title') }}</legend>
          <p class="label" id="sol-login-duration">{{ t('editor.motion.duration') }}</p>
          <div class="stepper" role="group" aria-labelledby="sol-login-duration">
            <button type="button" class="icon" [attr.aria-label]="t('editor.motion.less')" [disabled]="seconds() <= minSeconds" data-testid="login-duration-less" (click)="stepSeconds(-1)">
              <sol-icon name="minus" size="sm" />
            </button>
            <output data-testid="login-duration-value">{{ t('editor.motion.seconds', { s: seconds() }) }}</output>
            <button type="button" class="icon" [attr.aria-label]="t('editor.motion.more')" [disabled]="seconds() >= maxSeconds" data-testid="login-duration-more" (click)="stepSeconds(1)">
              <sol-icon name="plus" size="sm" />
            </button>
            <span class="hint">{{ t('editor.motion.range', { min: minSeconds, max: maxSeconds }) }}</span>
          </div>

          <p class="label">{{ t('editor.motion.effect') }}</p>
          <div class="options">
            @for (e of effects; track e) {
              <button type="button" class="option" [class.option--on]="effect() === e" [attr.aria-pressed]="effect() === e" [attr.data-testid]="'login-effect-' + e" (click)="set({ effect: e })">{{ t('editor.effect.' + e) }}</button>
            }
          </div>

          <p class="label">{{ t('editor.motion.transition') }}</p>
          <div class="options">
            @for (tr of transitions; track tr) {
              <button type="button" class="option" [class.option--on]="transition() === tr" [attr.aria-pressed]="transition() === tr" [attr.data-testid]="'login-transition-' + tr" (click)="set({ transition: tr })">{{ t('editor.transition.' + tr) }}</button>
            }
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t('editor.perMode.title') }}</legend>
          <div class="options" role="group" [attr.aria-label]="t('editor.perMode.ariaLabel')">
            @for (m of modes; track m) {
              <button type="button" class="option" [class.option--on]="mode() === m" [attr.aria-pressed]="mode() === m" [attr.data-testid]="'login-mode-' + m" (click)="mode.set(m)">{{ t('editor.perMode.' + m) }}</button>
            }
          </div>

          <p class="label">{{ t('editor.perMode.position') }}</p>
          <div class="options">
            @for (p of positions; track p) {
              <button type="button" class="option" [class.option--on]="modeConfig().position === p" [attr.aria-pressed]="modeConfig().position === p" [attr.data-testid]="'login-position-' + p" (click)="setMode({ position: p })">{{ t('editor.position.' + p) }}</button>
            }
          </div>

          <p class="label">{{ t('editor.perMode.background') }}</p>
          <div class="tiles">
            @for (b of backgrounds; track b) {
              <button type="button" class="tile" [class.tile--on]="modeConfig().background === b" [attr.aria-pressed]="modeConfig().background === b" [attr.data-testid]="'login-background-' + b" (click)="setMode({ background: b })">
                <span [class]="'tile__sample sample--' + b"><sol-login-shapes [background]="b" [position]="modeConfig().position" [fixedScale]="0.09" /></span>
                <span>{{ t('editor.background.' + b) }}</span>
              </button>
            }
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t('editor.caption.title') }}</legend>
          <label class="label" for="sol-login-caption-label">{{ t('editor.caption.label') }}</label>
          <input id="sol-login-caption-label" class="text" type="text" maxlength="80" data-testid="login-caption-label-input" [placeholder]="t('editor.caption.labelPlaceholder')" [value]="captionLabel()" (input)="setLabel($event)" />
          <label class="check">
            <input type="checkbox" data-testid="login-caption-indicators-input" [checked]="indicators()" (change)="setIndicators($event)" />
            {{ t('editor.caption.indicators') }}
          </label>
        </fieldset>

        <div class="footer">
          <button type="button" class="btn btn--secondary" data-testid="login-reset" (click)="reset()">{{ t('editor.reset') }}</button>
          @if (canUndo()) {
            <button type="button" class="btn btn--secondary" data-testid="login-undo" (click)="undo()">{{ t('editor.undo') }}</button>
          }
          @if (resetDone()) {
            <p class="hint" role="status">{{ t('editor.resetDone') }}</p>
          }
          @if (showApplyShortcut()) {
            <p class="hint">{{ t('editor.applyHint') }}</p>
            <button type="button" class="btn" data-testid="login-go-to-apply" (click)="goToApply.emit()">{{ t('editor.goToApply') }}</button>
          }
        </div>
      </div>

      <div class="preview">
        <p class="label">{{ t('preview.title', { mode: mode() === 'dark' ? t('preview.modeDark') : t('preview.modeLight') }) }}</p>
        @if (previewView(); as view) {
          <sol-login-preview [view]="view" [theme]="previewTheme()" [dark]="mode() === 'dark'" />
        } @else {
          <p class="hint" data-testid="login-preview-empty">{{ t('preview.empty') }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; padding: var(--sol-space-md, 16px); color: var(--sol-color-text-primary); }

    .editor { display: grid; gap: var(--sol-space-lg, 24px); grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); align-items: start; }
    .preview { position: sticky; top: var(--sol-space-md, 16px); }
    @media (max-width: 991.98px) {
      .editor { grid-template-columns: minmax(0, 1fr); }
      .preview { position: static; order: -1; }
    }

    .controls { display: flex; flex-direction: column; gap: var(--sol-space-md, 16px); min-width: 0; }
    fieldset { margin: 0; padding: var(--sol-space-md, 16px); border: 0; border-radius: var(--sol-border-radius-lg); background: var(--sol-bg-surface); min-width: 0; }
    legend { padding: 0; font-weight: var(--sol-font-weight-bold); font-size: var(--sol-font-size-base); float: left; width: 100%; margin-bottom: var(--sol-space-sm, 8px); }
    legend + * { clear: both; }
    .label { display: block; margin: var(--sol-space-sm, 8px) 0 var(--sol-space-xs, 4px); font-size: var(--sol-font-size-sm); font-weight: var(--sol-font-weight-bold); }
    .hint { margin: var(--sol-space-xs, 4px) 0; font-size: var(--sol-font-size-sm); color: var(--sol-color-text-muted); }
    .error { margin: var(--sol-space-xs, 4px) 0; font-size: var(--sol-font-size-sm); color: var(--sol-color-danger); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

    button { font: inherit; cursor: pointer; }
    button:disabled { cursor: not-allowed; opacity: 0.5; }
    :is(button, input):focus-visible { outline: 2px solid var(--sol-color-primary); outline-offset: 2px; }

    .btn { min-height: var(--sol-size-component-md, 36px); padding: 0 var(--sol-space-md, 16px); border: 0; border-radius: var(--sol-border-radius-md); background: var(--sol-color-primary); color: var(--sol-color-primary-contrast); font-weight: var(--sol-font-weight-bold); }
    .btn--secondary { background: transparent; color: var(--sol-color-text-primary); border: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default); }
    .icon { display: inline-flex; align-items: center; justify-content: center; width: var(--sol-size-component-md, 36px); height: var(--sol-size-component-md, 36px); flex: none; padding: 0; border: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default); border-radius: var(--sol-border-radius-md); background: transparent; color: inherit; }

    .options { display: flex; flex-wrap: wrap; gap: var(--sol-space-xs, 4px); }
    .option { min-height: var(--sol-size-component-md, 36px); padding: 0 var(--sol-space-md, 16px); border: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default); border-radius: var(--sol-border-radius-md); background: transparent; color: inherit; }
    .option--on { background: var(--sol-color-primary); border-color: var(--sol-color-primary); color: var(--sol-color-primary-contrast); font-weight: var(--sol-font-weight-bold); }

    .stepper { display: flex; align-items: center; gap: var(--sol-space-sm, 8px); flex-wrap: wrap; }
    output { min-width: 3.5em; text-align: center; font-weight: var(--sol-font-weight-bold); }

    .photos { list-style: none; margin: 0 0 var(--sol-space-sm, 8px); padding: 0; display: flex; flex-direction: column; gap: var(--sol-space-xs, 4px); }
    .photos li { display: flex; align-items: center; gap: var(--sol-space-xs, 4px); }
    .photos img { width: 64px; height: 40px; object-fit: cover; border-radius: var(--sol-border-radius-sm); flex: none; }
    .photos__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--sol-font-size-sm); }

    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: var(--sol-space-sm, 8px); }
    .tile { display: flex; flex-direction: column; gap: var(--sol-space-xs, 4px); padding: var(--sol-space-xs, 4px); border: 2px solid transparent; border-radius: var(--sol-border-radius-md); background: transparent; color: inherit; font-size: var(--sol-font-size-sm); }
    .tile--on { border-color: var(--sol-color-primary); font-weight: var(--sol-font-weight-bold); }
    .tile__sample { position: relative; display: block; height: 60px; overflow: hidden; border-radius: var(--sol-border-radius-sm); background: color-mix(in srgb, var(--sol-color-primary) 22%, var(--sol-bg-page)); transform: translateZ(0); }
    .sample--glass-fade::after, .sample--glass::after, .sample--solid::after { content: ''; position: absolute; inset: 12px 12px 12px 48%; border-radius: var(--sol-border-radius-sm); background: var(--sol-bg-surface); }
    .sample--glass-fade::after { -webkit-mask-image: linear-gradient(90deg, transparent, black 70%); mask-image: linear-gradient(90deg, transparent, black 70%); }
    .sample--glass::after { opacity: 0.55; }

    .text { width: 100%; box-sizing: border-box; min-height: var(--sol-size-component-md, 36px); padding: 0 var(--sol-space-sm, 8px); border: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default); border-radius: var(--sol-input-radius, var(--sol-border-radius-md)); background: var(--sol-input-bg, transparent); color: inherit; font: inherit; }
    .check { display: flex; align-items: center; gap: var(--sol-space-sm, 8px); margin-top: var(--sol-space-sm, 8px); min-height: var(--sol-size-component-md, 36px); font-size: var(--sol-font-size-sm); }

    .footer { display: flex; flex-direction: column; align-items: flex-start; gap: var(--sol-space-sm, 8px); }

    @media (max-width: 767.98px) {
      .btn, .option, .check, .text { min-height: var(--sol-size-control-touch, 44px); }
      .icon { width: var(--sol-size-control-touch, 44px); height: var(--sol-size-control-touch, 44px); }
      .text { font-size: var(--sol-font-size-touch-input, 16px); }
    }
  `,
})
export class SolLoginAppearanceEditorComponent {
  private readonly themeService = inject(ThemeService);
  protected readonly t = injectLoginAppearanceText();

  /** Current `meta.login`, already normalized; untouched, the editor only shows it. */
  readonly base = input.required<ThemeLogin>();
  /** Theme whose tokens paint the preview (the one being edited); by default the active one. */
  readonly theme = input<ThemeFile | null>(null);
  /** Host photos for the preview when the block has none, and what «Restablecer» restores. */
  readonly fallbackImages = input<readonly string[]>([]);
  /** Photo upload; without it the editor only orders and removes photos. */
  readonly uploader = input<LoginPhotoUploader | null>(null);
  /** Readable message of an upload error (for example, the store `extractStoreErrorMessage`). */
  readonly describeError = input<((error: unknown) => string | null) | null>(null);
  /** Shows the note and the button that send the person to «Aplicar tema». */
  readonly showApplyShortcut = input(false);

  /** Full `meta.login` after each change made by the person. */
  readonly loginChange = output<ThemeLogin>();
  readonly goToApply = output<void>();

  protected readonly effects = LOGIN_EFFECTS;
  protected readonly transitions = LOGIN_TRANSITIONS;
  protected readonly positions = LOGIN_POSITIONS;
  protected readonly backgrounds = LOGIN_BACKGROUNDS;
  protected readonly modes = MODES;
  protected readonly maxImages = LOGIN_MAX_IMAGES;
  protected readonly minSeconds = LOGIN_INTERVAL_MIN_MS / 1000;
  protected readonly maxSeconds = LOGIN_INTERVAL_MAX_MS / 1000;

  /** Draft of the person's edits; a new `base` (import, version, apply) discards it. */
  private readonly draft = linkedSignal<ThemeLogin, ThemeLogin | null>({ source: this.base, computation: () => null });
  protected readonly value = computed(() => this.draft() ?? this.base());

  protected readonly previewTheme = computed(() => this.theme() ?? this.themeService.activeTheme());

  protected readonly mode = signal<LoginMode>(this.themeService.isDark() ? 'dark' : 'light');
  protected readonly modeConfig = computed<ThemeLoginModeConfig & { position: LoginPosition; background: LoginBackground }>(() => {
    const config = this.value().modes?.[this.mode()];
    return { ...config, position: config?.position ?? LOGIN_DEFAULT_POSITION, background: config?.background ?? LOGIN_DEFAULT_BACKGROUND };
  });

  protected readonly images = computed(() => this.value().images ?? []);
  protected readonly full = computed(() => this.images().length >= LOGIN_MAX_IMAGES);
  protected readonly seconds = computed(() => (this.value().intervalMs ?? LOGIN_INTERVAL_DEFAULT_MS) / 1000);
  protected readonly effect = computed(() => this.value().effect ?? LOGIN_DEFAULT_EFFECT);
  protected readonly transition = computed(() => this.value().transition ?? LOGIN_DEFAULT_TRANSITION);
  protected readonly captionLabel = computed(() => this.value().caption?.label ?? '');
  protected readonly indicators = computed(() => this.value().caption?.indicators ?? true);

  protected readonly uploading = signal<{ current: number; total: number } | null>(null);
  protected readonly photoError = signal<string | null>(null);

  private readonly previous = signal<ThemeLogin | null>(null);
  protected readonly canUndo = computed(() => this.previous() !== null);
  protected readonly resetDone = signal(false);

  private readonly safeFallback = computed(() => this.fallbackImages().filter(isAllowedLoginImage));

  protected readonly previewView = computed(() => {
    const own = this.images();
    const images = own.length > 0 ? own : this.safeFallback();
    return images.length > 0 ? buildLoginView(this.value(), images, this.mode() === 'dark') : null;
  });

  private commit(next: ThemeLogin): void {
    this.resetDone.set(false);
    this.previous.set(null);
    this.draft.set(next);
    this.loginChange.emit(next);
  }

  protected set(changes: Partial<ThemeLogin>): void {
    this.commit({ ...this.value(), ...changes });
  }

  protected setMode(changes: Partial<ThemeLoginModeConfig>): void {
    const mode = this.mode();
    const current = this.value();
    this.commit({ ...current, modes: { ...current.modes, [mode]: { ...current.modes?.[mode], ...changes } } });
  }

  protected stepSeconds(delta: number): void {
    const next = Math.min(this.maxSeconds, Math.max(this.minSeconds, this.seconds() + delta)) * INTERVAL_STEP_MS;
    if (next !== (this.value().intervalMs ?? LOGIN_INTERVAL_DEFAULT_MS)) this.set({ intervalMs: next });
  }

  protected setLabel(event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    this.set({ caption: { ...this.value().caption, label } });
  }

  protected setIndicators(event: Event): void {
    this.set({ caption: { ...this.value().caption, indicators: (event.target as HTMLInputElement).checked } });
  }

  protected move(index: number, delta: number): void {
    const list = [...this.images()];
    const [photo] = list.splice(index, 1);
    list.splice(index + delta, 0, photo);
    this.set({ images: list });
  }

  protected remove(index: number): void {
    this.set({ images: this.images().filter((_, i) => i !== index) });
  }

  protected nameOf(url: string): string {
    return url.split('?')[0].split('/').pop() || url;
  }

  protected async onFiles(event: Event): Promise<void> {
    const field = event.target as HTMLInputElement;
    const files = Array.from(field.files ?? []);
    field.value = '';
    const room = LOGIN_MAX_IMAGES - this.images().length;
    const batch = files.slice(0, Math.max(0, room));
    if (batch.length === 0) return;
    this.photoError.set(null);
    for (const [index, file] of batch.entries()) {
      this.uploading.set({ current: index + 1, total: batch.length });
      const url = await this.upload(file);
      if (url && !this.images().includes(url)) this.set({ images: [...this.images(), url] });
    }
    this.uploading.set(null);
    if (files.length > batch.length) {
      this.photoError.update(e => e ?? this.t('editor.photos.partial', { count: batch.length, max: LOGIN_MAX_IMAGES }));
    }
  }

  private async upload(file: File): Promise<string | null> {
    const uploader = this.uploader();
    if (!uploader) return null;
    const result = await settle(uploader(file));
    if ('error' in result) {
      const detail = this.describeError()?.(result.error) || this.t('editor.photos.uploadErrorDetail');
      this.photoError.set(this.t('editor.photos.uploadError', { name: file.name, detail }));
      return null;
    }
    const url = result.url.trim();
    if (isAllowedLoginImage(url)) return url;
    this.photoError.set(this.t('editor.photos.invalidUrl', { name: file.name }));
    return null;
  }

  protected reset(): void {
    const prior = this.value();
    const keep = (mode: LoginMode): ThemeLoginModeConfig => ({
      ...(prior.modes?.[mode]?.veil ? { veil: prior.modes[mode]?.veil } : {}),
      ...(prior.modes?.[mode]?.panel ? { panel: prior.modes[mode]?.panel } : {}),
    });
    this.commit({
      images: [...this.safeFallback()],
      intervalMs: LOGIN_INTERVAL_DEFAULT_MS,
      effect: LOGIN_DEFAULT_EFFECT,
      transition: LOGIN_DEFAULT_TRANSITION,
      caption: { indicators: true },
      modes: {
        dark: { position: 'right', background: LOGIN_DEFAULT_BACKGROUND, captionPosition: 'bottom-left', ...keep('dark') },
        light: { position: 'left', background: LOGIN_DEFAULT_BACKGROUND, captionPosition: 'bottom-right', ...keep('light') },
      },
    });
    this.previous.set(prior);
    this.resetDone.set(true);
  }

  protected undo(): void {
    const prior = this.previous();
    if (prior) this.commit(prior);
  }
}

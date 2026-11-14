import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  type OnDestroy,
  type OnInit,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  LOGIN_META_SCHEMA,
  SolLoginAppearanceEditorComponent,
  normalizeLogin,
  type LoginPhotoUploader,
  type ThemeLogin,
} from '@solercia/ui/login-appearance';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  SOL_DEFAULT_THEME,
  SOL_I18N,
  SOL_TABLE_VARIANTS,
  SolButtonComponent,
  SolConfirmDialogComponent,
  SolIconComponent,
  SolRevealDirective,
  SolSpinnerComponent,
  ThemeService,
  buildGoogleFontsUrl,
  isRenderableTheme,
  sanitizeAssetUrl,
  type SolTableVariant,
  type ThemeFile,
  type ThemeFont,
  type ThemeLogo,
  type ThemeMeta,
  type ThemeMode,
} from '@solercia/ui';
import { buildThemeFile, mapThemeFileToForm } from '../lib/theme-builder';
import {
  MAX_THEME_JSON_BYTES,
  ThemeImportError,
  mergeThemeEditorChanges,
  parseThemeJson,
  type ParseThemeJsonOptions,
} from '../lib/theme-json-file';
import {
  BASE_SIZE_MAX,
  BASE_SIZE_MIN,
  DEFAULT_LOADER_CONFIG,
  DEFAULT_STUDIO_FORM,
  HEX_COLOR_PATTERN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  RADIUS_MAX,
  RADIUS_MIN,
  SERIF_DISPLAY_FONTS,
  STUDIO_BODY_FONTS,
  STUDIO_BODY_FONTS_QUICK,
  STUDIO_COLOR_SUGGESTIONS_DARK,
  STUDIO_COLOR_SUGGESTIONS_LIGHT,
  STUDIO_DISPLAY_FONTS,
  STUDIO_DISPLAY_FONTS_QUICK,
  STUDIO_LOADER_ANIMATIONS,
  STUDIO_LOADER_PRESENTATIONS,
  STUDIO_SHADOW_COLOR_SUGGESTIONS,
  STUDIO_SHADOW_DIRECTIONS,
  STUDIO_TEXT_COLOR_SUGGESTIONS_DARK,
  STUDIO_TEXT_COLOR_SUGGESTIONS_LIGHT,
  STUDIO_TEXTURE_COLOR_SUGGESTIONS,
  cloneStudioForm,
  type StudioColorFieldKey,
  type StudioModeColorKey,
  type StudioShadowDirection,
  type StudioTexture,
  type ThemeLoaderConfig,
  type ThemeStudioForm,
  type ThemeStudioModeForm,
} from '../model/theme-studio-form.model';
import {
  THEME_STUDIO_STORE,
  extractStoreErrorMessage,
  type ThemeVersion,
  type ThemeVersionPage,
} from '../store/theme-studio-store';
import { injectThemeStudioText } from '../i18n/theme-studio.i18n';
import { SolThemeStudioPreviewComponent } from './theme-studio-preview.component';

/** Aviso que la pantalla emite por `notify`; la aplicación decide cómo mostrarlo (toast, alerta…). */
export interface SolThemeStudioNotice {
  kind: 'success' | 'error' | 'info' | 'warning';
  /** Clave completa (`sol.themeStudio.*`) por si el host prefiere traducirla con su motor. */
  messageKey: string;
  /**
   * Texto ya resuelto en el idioma activo (con el respaldo de la librería). Cuando el store
   * devolvió un mensaje propio (por ejemplo, el del backend), es ese mensaje.
   */
  message: string;
}

/**
 * Secciones y comportamientos opcionales de `<sol-theme-studio>`. Los valores por defecto
 * reproducen la pantalla de 0.6.0; un host activa lo que necesita.
 */
export interface SolThemeStudioFeatures {
  /** Campo «Nombre del tema» (`meta.name`) en la sección Marca. Por defecto `true`. */
  themeName?: boolean;
  /**
   * Sección «Loader / spinner» (`meta.loader`: imagen, presentación y animación) y su muestra en
   * la vista previa. Por defecto `false`.
   */
  loader?: boolean;
  /**
   * Clave de `meta` donde el host lee y escribe además la variante de tabla (p. ej.
   * `'tableStyle'`). Al hidratar gana sobre `component.table.variant`. Por defecto, ninguna.
   */
  tableVariantMetaKey?: string;
  /**
   * Al aplicar, fija `meta.defaultMode` como preferencia EXPLÍCITA de este navegador
   * (`ThemeService.setDarkMode`), para que nadie quede pegado en un modo viejo. Por defecto `false`.
   */
  persistDefaultModeOnApply?: boolean;
  /**
   * Pestaña «Inicio de sesión»: editor de `meta.login` (fotos, movimiento, composición por modo y
   * lema) de `@solercia/ui/login-appearance`, con su vista previa. Se guarda con el mismo
   * «Aplicar tema». Por defecto `false`.
   */
  loginAppearance?: boolean;
}

/** Opción de un control segmentado: valor del contrato + clave de su texto. */
interface SegmentOption {
  value: string | number;
  labelKey: string;
}

/** Claves COMPARTIDAS editadas con controles segmentados. */
type SharedSegmentKey =
  | 'displayWeight'
  | 'displayTransform'
  | 'button'
  | 'input'
  | 'density'
  | 'border'
  | 'intensity'
  | 'reveal'
  | 'motionDuration'
  | 'overlayBlur'
  | 'shadowSize'
  | 'authLayout'
  | 'defaultMode'
  | 'tableVariant';

/** Claves POR MODO editadas con controles segmentados. */
type ModeSegmentKey = 'shadow' | 'shadowDirection' | 'sidebar' | 'header' | 'texture';

interface SegmentGroup<K extends string> {
  key: K;
  labelKey: string;
  options: ReadonlyArray<SegmentOption>;
}

/** Imagen que se sube por archivo. */
type ImageTarget = 'logo' | 'logoDark' | 'favicon' | 'loaderImage';
type LoadState = 'loading' | 'ready' | 'error' | 'no-store';
/** Texto de estado: una clave traducible o un texto ya resuelto (p. ej. el mensaje del backend). */
type StatusMessage = { key: string; params?: Record<string, unknown> } | { text: string };

const TEXTURE_COLOR_TEXTURES: ReadonlySet<StudioTexture> = new Set<StudioTexture>([
  'glow',
  'corners',
  'dots',
  'mesh',
  'vignette',
  'waves',
]);

const DIRECTION_GLYPHS: Record<StudioShadowDirection, string> = {
  'top-left': '↖',
  top: '↑',
  'top-right': '↗',
  left: '←',
  center: '•',
  right: '→',
  'bottom-left': '↙',
  bottom: '↓',
  'bottom-right': '↘',
};

const BRAND_WIDTH_MIN = 60;
const BRAND_WIDTH_MAX = 200;
const MAX_IMAGE_FILE_BYTES = 2 * 1024 * 1024;
const LOGO_ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/webp';
const FAVICON_ACCEPT = 'image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/webp';

const SPLIT_DEFAULT = 60;
const SPLIT_MIN = 30;
const SPLIT_MAX = 75;
const SPLIT_STEP = 2;
const SPLIT_STORAGE_KEY = 'sol-theme-studio-split';

function clampSplit(value: number): number {
  if (!Number.isFinite(value)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(value)));
}

function readStoredSplit(): number {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    return raw === null ? SPLIT_DEFAULT : clampSplit(Number(raw));
  } catch {
    return SPLIT_DEFAULT;
  }
}

/** `true` cuando el resultado de `store.apply` es el tema persistido (y no una versión). */
function isThemeFileLike(value: unknown): value is ThemeFile {
  return (
    !!value &&
    typeof value === 'object' &&
    'modes' in value &&
    'meta' in value &&
    'primitives' in value
  );
}

const opt = (value: string | number, labelKey: string): SegmentOption => ({ value, labelKey });

/**
 * `<sol-theme-studio>`: editor visual completo del tema del tenant (portado del Theme Studio de
 * PANDORA con el mismo marcado, estilos, textos y comportamiento).
 *
 * - Persistencia por el puerto `THEME_STUDIO_STORE` (la app implementa el adaptador). Los
 *   métodos opcionales del store apagan su sección: sin historial o sin carga de imágenes.
 * - Edición: controles COMPARTIDOS (marca, pie, inicio de sesión, modo por defecto, tablas,
 *   tipografía, forma, densidad, movimiento) y POR MODO (color, roles, sombra, textura, barra
 *   lateral, encabezado) en pestañas claro/oscuro. Secciones opcionales por `features`.
 * - Vista previa aislada al lado de los controles en escritorio (divisor arrastrable, 60/40 por
 *   defecto) y en un panel lateral con botón flotante bajo 1024 px.
 * - Aplicar (con confirmación) llama a `store.apply(...)`; con el tema persistido lo empuja con
 *   `ThemeService.setTenantTheme`, sin él llama a `ThemeService.refresh()`. Emite `applied`.
 * - Historial paginado, previsualización y restauración de versiones (`sourceVersionId`).
 * - Importar/exportar JSON con validación previa. Textos por `SOL_I18N` (`sol.themeStudio.*`).
 */
@Component({
  selector: 'sol-theme-studio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closePreviewPanel()',
  },
  imports: [
    SolButtonComponent,
    SolIconComponent,
    SolConfirmDialogComponent,
    SolRevealDirective,
    SolSpinnerComponent,
    SolThemeStudioPreviewComponent,
    SolLoginAppearanceEditorComponent,
  ],
  template: `
    <div class="studio">
      <header class="studio-header">
        <div>
          <h1 class="studio-title">{{ t('title') }}</h1>
          <p class="studio-subtitle">{{ t('subtitle') }}</p>
        </div>
      </header>

      @switch (loadState()) {
        @case ('loading') {
          <div class="state-panel" role="status" data-testid="studio-loading">
            <sol-spinner size="md" />
            <p>{{ t('state.loading') }}</p>
          </div>
        }
        @case ('no-store') {
          <div class="state-panel state-panel--error" role="alert" data-testid="studio-no-store">
            <sol-icon name="exclamation-triangle" size="lg" />
            <p>{{ t('state.storeMissing') }}</p>
          </div>
        }
        @case ('error') {
          <div class="state-panel state-panel--error" role="alert" data-testid="studio-load-error">
            <sol-icon name="exclamation-triangle" size="lg" />
            <p>{{ t('state.loadError') }}</p>
            <sol-button data-testid="studio-load-retry" variant="secondary" size="touch" (clicked)="load()">
              {{ t('state.retry') }}
            </sol-button>
          </div>
        }
        @default {
          @if (feature().loginAppearance) {
            <div class="section-tabs" role="tablist" [attr.aria-label]="t('sections.ariaLabel')" data-testid="studio-section-tabs">
              <button
                type="button"
                role="tab"
                class="section-tab"
                [class.section-tab--on]="section() === 'general'"
                [attr.aria-selected]="section() === 'general'"
                data-testid="studio-tab-general"
                (click)="section.set('general')"
              >{{ t('sections.general') }}</button>
              <button
                type="button"
                role="tab"
                class="section-tab"
                [class.section-tab--on]="section() === 'login'"
                [attr.aria-selected]="section() === 'login'"
                data-testid="studio-tab-login"
                (click)="section.set('login')"
              >
                {{ t('sections.login') }}
                @if (loginUnsaved()) {
                  <span class="section-tab__mark" data-testid="studio-login-unsaved">{{ t('sections.unsaved') }}</span>
                }
              </button>
            </div>
          }

          <!-- The general section never unmounts: its draft and preview live here. -->
          <div class="studio-section" [hidden]="section() !== 'general'" data-testid="studio-section-general">
          @if (!hasSavedTheme()) {
            <p class="notice" role="status" data-testid="studio-base-notice">{{ t('state.baseNotice') }}</p>
          }

          @if (canBrowseHistory) {
            <section class="history-panel" data-testid="studio-history-panel" [attr.aria-label]="t('history.ariaLabel')">
              <sol-button
                data-testid="studio-history"
                size="touch"
                variant="secondary"
                [attr.aria-expanded]="historyOpen()"
                (clicked)="toggleHistory()"
              >{{ t('history.toggle') }}</sol-button>
              @if (historyOpen()) {
                <p class="field-hint">{{ t('history.hint') }}</p>
                @if (historyLoading()) { <p role="status" data-testid="history-loading">{{ t('history.loading') }}</p> }
                @if (historyError(); as error) {
                  <p role="alert" data-testid="history-error">{{ text(error) }}</p>
                  <sol-button data-testid="history-retry" size="touch" variant="ghost" (clicked)="loadHistory()">{{ t('history.retry') }}</sol-button>
                }
                @if (!historyLoading() && !historyError() && versions().length === 0) {
                  <p data-testid="history-empty">{{ t('history.empty') }}</p>
                }
                <ul class="history-list" data-testid="history-list">
                  @for (version of versions(); track version.id) {
                    <li>
                      <div><strong>{{ t('history.version', { id: version.id }) }}</strong> · {{ versionDate(version.appliedAt) }}
                        <p class="field-hint">{{ version.initialCapture ? t('history.initialCapture') : (version.userName ?? '') }}
                          @if (version.sourceVersionId) { · {{ t('history.basedOn', { id: version.sourceVersionId }) }} }
                        </p>
                      </div>
                      <sol-button
                        size="touch"
                        variant="ghost"
                        [attr.data-testid]="'history-preview-' + version.id"
                        [disabled]="busy()"
                        (clicked)="previewVersion(version.id)"
                      >{{ t('history.preview') }}</sol-button>
                    </li>
                  }
                </ul>
                @if (versionLoading()) { <p role="status" data-testid="history-version-loading">{{ t('history.versionLoading') }}</p> }
                @if (nextCursor() && !historyLoading()) {
                  <sol-button data-testid="history-more" size="touch" variant="ghost" (clicked)="loadHistory(true)">{{ t('history.loadMore') }}</sol-button>
                }
              }
            </section>
          }
          <input #themeJsonInput type="file" hidden accept=".json,application/json" data-testid="studio-json-file" (change)="importJson($event)" />

          <div
            class="studio-grid"
            #gridContainer
            [class.is-resizing]="resizing()"
            [style.--studio-split]="studioSplit() + '%'"
          >
            <!-- Controles: columna izquierda del reparto en escritorio; ancho completo bajo 1024px. -->
            <div class="controls">
              <!-- ── Compartido (claro y oscuro) ── -->
              <p class="group-title">{{ t('group.shared') }}</p>

              <!-- Marca -->
              <section class="control-card" solReveal [solRevealIndex]="0">
                <h2 class="card-title">{{ t('brand.title') }}</h2>
                @if (feature().themeName) {
                  <div class="control-row">
                    <span class="control-label">{{ t('brand.name') }}</span>
                    <input
                      class="text-input"
                      type="text"
                      maxlength="80"
                      data-testid="brand-name"
                      [value]="themeName()"
                      [placeholder]="t('brand.namePlaceholder')"
                      (change)="themeName.set(inputValue($event))"
                    />
                  </div>
                }
                <div class="control-row">
                  <span class="control-label">{{ t('brand.logo') }}</span>
                  <div class="swatch-row">
                    @if (imageUrl('logo'); as url) {
                      <img class="logo-thumb" [src]="url" [alt]="t('brand.logoAlt')" />
                    }
                    @if (canUpload) {
                      <sol-button
                        type="button"
                        data-testid="brand-logo-attach"
                        variant="ghost"
                        size="sm"
                        [loading]="uploadingLogo() === 'logo'"
                        [disabled]="uploadingLogo() !== null"
                        (clicked)="logoFileInput.click()"
                      >
                        <sol-icon name="image" size="sm" />
                        {{ t('brand.attach') }}
                      </sol-button>
                    }
                    @if (brandForm().url) {
                      <sol-button
                        type="button"
                        data-testid="brand-logo-remove"
                        variant="ghost"
                        size="sm"
                        [disabled]="uploadingLogo() !== null"
                        (clicked)="removeImage('logo')"
                      >
                        <sol-icon name="trash" size="sm" />
                        {{ t('brand.remove') }}
                      </sol-button>
                    }
                    <input
                      #logoFileInput
                      type="file"
                      hidden
                      data-testid="brand-logo-file"
                      [attr.accept]="logoAccept"
                      (change)="onImageSelected('logo', $event)"
                    />
                  </div>
                </div>
                <div class="control-row">
                  <span class="control-label">{{ t('brand.logoDark') }}</span>
                  <div class="swatch-row">
                    @if (imageUrl('logoDark'); as url) {
                      <img class="logo-thumb" [src]="url" [alt]="t('brand.logoDarkAlt')" />
                    }
                    @if (canUpload) {
                      <sol-button
                        type="button"
                        data-testid="brand-logo-dark-attach"
                        variant="ghost"
                        size="sm"
                        [loading]="uploadingLogo() === 'logoDark'"
                        [disabled]="uploadingLogo() !== null"
                        (clicked)="logoDarkFileInput.click()"
                      >
                        <sol-icon name="image" size="sm" />
                        {{ t('brand.attach') }}
                      </sol-button>
                    }
                    @if (brandForm().urlDark) {
                      <sol-button
                        type="button"
                        data-testid="brand-logo-dark-remove"
                        variant="ghost"
                        size="sm"
                        [disabled]="uploadingLogo() !== null"
                        (clicked)="removeImage('logoDark')"
                      >
                        <sol-icon name="trash" size="sm" />
                        {{ t('brand.remove') }}
                      </sol-button>
                    }
                    <input
                      #logoDarkFileInput
                      type="file"
                      hidden
                      data-testid="brand-logo-dark-file"
                      [attr.accept]="logoAccept"
                      (change)="onImageSelected('logoDark', $event)"
                    />
                  </div>
                </div>
                <div class="control-row">
                  <span class="control-label">{{ t('brand.altText') }}</span>
                  <input
                    class="text-input"
                    type="text"
                    data-testid="brand-alt-text"
                    [value]="brandForm().altText"
                    [placeholder]="t('brand.altTextPlaceholder')"
                    (change)="setBrandField('altText', inputValue($event))"
                  />
                </div>
                <div class="control-row">
                  <span class="control-label">
                    {{ t('brand.width') }}
                    <b class="range-value">{{ brandForm().width }}px</b>
                  </span>
                  <input
                    type="range"
                    class="range"
                    data-testid="range-brand-width"
                    [min]="brandWidthMin"
                    [max]="brandWidthMax"
                    step="1"
                    [value]="brandForm().width"
                    (input)="setBrandField('width', numberValue($event))"
                  />
                </div>
                <div class="control-row">
                  <span class="control-label">{{ t('brand.favicon') }}</span>
                  <div class="swatch-row">
                    @if (imageUrl('favicon'); as url) {
                      <img class="logo-thumb" [src]="url" [alt]="t('brand.faviconAlt')" />
                    }
                    @if (canUpload) {
                      <sol-button
                        type="button"
                        data-testid="brand-favicon-attach"
                        variant="ghost"
                        size="sm"
                        [loading]="uploadingFavicon()"
                        [disabled]="uploadingFavicon()"
                        (clicked)="faviconFileInput.click()"
                      >
                        <sol-icon name="image" size="sm" />
                        {{ t('brand.attach') }}
                      </sol-button>
                    }
                    @if (favicon()) {
                      <sol-button
                        type="button"
                        data-testid="brand-favicon-remove"
                        variant="ghost"
                        size="sm"
                        [disabled]="uploadingFavicon()"
                        (clicked)="removeImage('favicon')"
                      >
                        <sol-icon name="trash" size="sm" />
                        {{ t('brand.remove') }}
                      </sol-button>
                    }
                    <input
                      #faviconFileInput
                      type="file"
                      hidden
                      data-testid="brand-favicon-file"
                      [attr.accept]="faviconAccept"
                      (change)="onImageSelected('favicon', $event)"
                    />
                  </div>
                </div>
                <p class="field-hint">{{ t('brand.faviconHint') }}</p>
                @if (!canUpload) {
                  <p class="field-hint" data-testid="upload-unavailable">{{ t('brand.uploadUnavailable') }}</p>
                }
              </section>

              <!-- Pie de página -->
              <section class="control-card" solReveal [solRevealIndex]="1">
                <h2 class="card-title">{{ t('footer.title') }}</h2>
                <div class="control-row">
                  <span class="control-label">{{ t('footer.text') }}</span>
                  <input
                    class="text-input"
                    type="text"
                    maxlength="200"
                    data-testid="footer-text"
                    [value]="tagline()"
                    [placeholder]="footerPlaceholder() ?? t('footer.placeholder')"
                    (change)="tagline.set(inputValue($event))"
                  />
                </div>
              </section>

              <!-- Diseño del inicio de sesión -->
              <section class="control-card" solReveal [solRevealIndex]="2">
                <h2 class="card-title">{{ t('auth.title') }}</h2>
                <div class="control-row">
                  <span class="control-label">{{ t('auth.layout') }}</span>
                  <div class="segmented">
                    @for (option of authLayoutOptions; track option.value) {
                      <button
                        type="button"
                        class="seg-btn"
                        [class.active]="form().authLayout === option.value"
                        [attr.data-testid]="'seg-authLayout-' + option.value"
                        (click)="setChoice('authLayout', option.value)"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    }
                  </div>
                </div>
              </section>

              <!-- Modo por defecto -->
              <section class="control-card" solReveal [solRevealIndex]="2">
                <h2 class="card-title">{{ t('defaultMode.title') }}</h2>
                <div class="control-row">
                  <div class="segmented">
                    @for (option of defaultModeOptions; track option.value) {
                      <button
                        type="button"
                        class="seg-btn"
                        [class.active]="form().defaultMode === option.value"
                        [attr.data-testid]="'seg-defaultMode-' + option.value"
                        (click)="setChoice('defaultMode', option.value)"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    }
                  </div>
                </div>
              </section>

              <!-- Tablas -->
              <section class="control-card" solReveal [solRevealIndex]="3">
                <h2 class="card-title">{{ t('table.title') }}</h2>
                <div class="control-row">
                  <span class="control-label">{{ t('table.variant') }}</span>
                  <div class="segmented">
                    @for (option of tableVariantOptions; track option.value) {
                      <button
                        type="button"
                        class="seg-btn"
                        [class.active]="form().tableVariant === option.value"
                        [attr.data-testid]="'seg-tableVariant-' + option.value"
                        (click)="setChoice('tableVariant', option.value)"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    }
                  </div>
                  <p class="field-hint">{{ t('table.hint') }}</p>
                </div>
              </section>

              <!-- Loader / spinner (opcional) -->
              @if (feature().loader) {
                <section class="control-card" solReveal [solRevealIndex]="3" data-testid="studio-loader-section">
                  <h2 class="card-title">{{ t('loader.title') }}</h2>
                  <div class="control-row">
                    <span class="control-label">{{ t('loader.image') }}</span>
                    <div class="swatch-row">
                      @if (imageUrl('loaderImage'); as url) {
                        <img class="logo-thumb" [src]="url" [alt]="t('loader.imageAlt')" />
                      }
                      @if (canUpload) {
                        <sol-button
                          type="button"
                          data-testid="loader-image-attach"
                          variant="ghost"
                          size="sm"
                          [loading]="uploadingLoaderImage()"
                          [disabled]="uploadingLoaderImage()"
                          (clicked)="loaderFileInput.click()"
                        >
                          <sol-icon name="image" size="sm" />
                          {{ t('brand.attach') }}
                        </sol-button>
                      }
                      @if (loaderForm().image) {
                        <sol-button
                          type="button"
                          data-testid="loader-image-remove"
                          variant="ghost"
                          size="sm"
                          [disabled]="uploadingLoaderImage()"
                          (clicked)="removeImage('loaderImage')"
                        >
                          <sol-icon name="trash" size="sm" />
                          {{ t('brand.remove') }}
                        </sol-button>
                      }
                      <input
                        #loaderFileInput
                        type="file"
                        hidden
                        data-testid="loader-image-file"
                        [attr.accept]="logoAccept"
                        (change)="onImageSelected('loaderImage', $event)"
                      />
                    </div>
                  </div>
                  <div class="control-row">
                    <span class="control-label">{{ t('loader.presentation') }}</span>
                    <div class="segmented">
                      @for (option of loaderPresentationOptions; track option.value) {
                        <button
                          type="button"
                          class="seg-btn"
                          [class.active]="loaderForm().presentation === option.value"
                          (click)="setLoaderChoice('presentation', option.value)"
                        >
                          {{ t(option.labelKey) }}
                        </button>
                      }
                    </div>
                  </div>
                  <div class="control-row">
                    <span class="control-label">{{ t('loader.animation') }}</span>
                    <div class="segmented">
                      @for (option of loaderAnimationOptions; track option.value) {
                        <button
                          type="button"
                          class="seg-btn"
                          [class.active]="loaderForm().animation === option.value"
                          (click)="setLoaderChoice('animation', option.value)"
                        >
                          {{ t(option.labelKey) }}
                        </button>
                      }
                    </div>
                    <p class="field-hint">{{ t('loader.hint') }}</p>
                  </div>
                </section>
              }

              <!-- Tipografía -->
              <section class="control-card" solReveal [solRevealIndex]="3">
                <h2 class="card-title">{{ t('typography.title') }}</h2>
                @for (role of fontRoles; track role.key) {
                  <div class="control-row">
                    <span class="control-label">{{ t(role.labelKey) }}</span>
                    <div class="font-list">
                      @for (family of role.quick; track family) {
                        <button
                          type="button"
                          class="font-btn"
                          [class.active]="form()[role.key] === family"
                          [style.font-family]="fontStackFor(family)"
                          (click)="setField(role.key, family)"
                        >
                          {{ family }}
                        </button>
                      }
                    </div>
                    <p class="field-hint">{{ t('typography.moreFonts') }}</p>
                    <select
                      class="font-select"
                      [attr.data-testid]="role.testId"
                      [value]="form()[role.key]"
                      [style.font-family]="fontStackFor(form()[role.key])"
                      (change)="setField(role.key, inputValue($event))"
                    >
                      @for (family of role.catalog; track family) {
                        <option [value]="family" [style.font-family]="fontStackFor(family)">{{ family }}</option>
                      }
                    </select>
                  </div>
                }
                @for (group of typographyGroups; track group.key) {
                  <div class="control-row">
                    <span class="control-label">{{ t(group.labelKey) }}</span>
                    <div class="segmented">
                      @for (option of group.options; track option.value) {
                        <button
                          type="button"
                          class="seg-btn"
                          [class.active]="form()[group.key] === option.value"
                          (click)="setChoice(group.key, option.value)"
                        >
                          {{ t(option.labelKey) }}
                        </button>
                      }
                    </div>
                  </div>
                }
                <div class="control-row">
                  <span class="control-label">
                    {{ t('typography.baseSize') }}
                    <b class="range-value">{{ form().baseSize }}px</b>
                  </span>
                  <input
                    type="range"
                    class="range"
                    data-testid="range-base-size"
                    [min]="baseSizeMin"
                    [max]="baseSizeMax"
                    step="0.5"
                    [value]="form().baseSize"
                    (input)="setField('baseSize', numberValue($event))"
                  />
                </div>
                <div class="control-row">
                  <span class="control-label">
                    {{ t('typography.lineHeight') }}
                    <b class="range-value">{{ form().lineHeight }}</b>
                  </span>
                  <input
                    type="range"
                    class="range"
                    data-testid="range-line-height"
                    [min]="lineHeightMin"
                    [max]="lineHeightMax"
                    step="0.1"
                    [value]="form().lineHeight"
                    (input)="setField('lineHeight', numberValue($event))"
                  />
                </div>
              </section>

              <!-- Forma -->
              <section class="control-card" solReveal [solRevealIndex]="4">
                <h2 class="card-title">{{ t('shape.title') }}</h2>
                <div class="control-row">
                  <span class="control-label">
                    {{ t('shape.radius') }}
                    <b class="range-value">{{ form().radius }}px</b>
                  </span>
                  <input
                    type="range"
                    class="range"
                    data-testid="range-radius"
                    [min]="radiusMin"
                    [max]="radiusMax"
                    step="1"
                    [value]="form().radius"
                    (input)="setField('radius', numberValue($event))"
                  />
                </div>
                @for (group of shapeGroups; track group.key) {
                  <div class="control-row">
                    <span class="control-label">{{ t(group.labelKey) }}</span>
                    <div class="segmented">
                      @for (option of group.options; track option.value) {
                        <button
                          type="button"
                          class="seg-btn"
                          [class.active]="form()[group.key] === option.value"
                          (click)="setChoice(group.key, option.value)"
                        >
                          {{ t(option.labelKey) }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </section>

              <!-- Densidad y bordes -->
              <section class="control-card" solReveal [solRevealIndex]="5">
                <h2 class="card-title">{{ t('structure.sharedTitle') }}</h2>
                @for (group of sharedStructureGroups; track group.key) {
                  <div class="control-row">
                    <span class="control-label">{{ t(group.labelKey) }}</span>
                    <div class="segmented">
                      @for (option of group.options; track option.value) {
                        <button
                          type="button"
                          class="seg-btn"
                          [class.active]="form()[group.key] === option.value"
                          (click)="setChoice(group.key, option.value)"
                        >
                          {{ t(option.labelKey) }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </section>

              <!-- Movimiento -->
              <section class="control-card" solReveal [solRevealIndex]="6">
                <h2 class="card-title">{{ t('motion.title') }}</h2>
                @for (group of motionGroups; track group.key) {
                  <div class="control-row">
                    <span class="control-label">{{ t(group.labelKey) }}</span>
                    <div class="segmented">
                      @for (option of group.options; track option.value) {
                        <button
                          type="button"
                          class="seg-btn"
                          [class.active]="form()[group.key] === option.value"
                          (click)="setChoice(group.key, option.value)"
                        >
                          {{ t(option.labelKey) }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </section>

              <!-- ── Por modo (claro / oscuro) ── -->
              <div class="mode-tabs-head">
                <p class="group-title">{{ t('group.perMode') }}</p>
                <div class="mode-tabs" role="tablist" data-testid="theme-mode-tabs">
                  @for (mode of modes; track mode) {
                    <button
                      type="button"
                      class="mode-tab"
                      role="tab"
                      [class.active]="activeMode() === mode"
                      [attr.aria-selected]="activeMode() === mode"
                      [attr.data-testid]="'mode-tab-' + mode"
                      (click)="activeMode.set(mode)"
                    >
                      {{ t('mode.' + mode) }}
                    </button>
                  }
                </div>
              </div>

              @for (section of colorSections(); track section.titleKey; let i = $index) {
                <section class="control-card" solReveal [solRevealIndex]="7 + i">
                  <h2 class="card-title">{{ t(section.titleKey) }}</h2>
                  @for (field of section.fields; track field.key) {
                    <div class="control-row">
                      <span class="control-label">{{ t(field.labelKey) }}</span>
                      <div class="swatch-row">
                        @for (color of field.suggestions; track color) {
                          <button
                            type="button"
                            class="swatch"
                            [class.active]="modeForm()[field.key] === color"
                            [style.background]="color"
                            [attr.aria-label]="color"
                            (click)="setModeColor(field.key, color)"
                          ></button>
                        }
                        <input
                          class="swatch-picker"
                          type="color"
                          [value]="modeForm()[field.key]"
                          (input)="setModeColor(field.key, inputValue($event))"
                        />
                        <input
                          class="hex-input"
                          type="text"
                          maxlength="7"
                          [attr.data-testid]="'hex-' + field.key"
                          [value]="modeForm()[field.key]"
                          (change)="onModeHexChange(field.key, $event)"
                        />
                      </div>
                      @if (field.hintKey) {
                        <p class="field-hint">{{ t(field.hintKey) }}</p>
                      }
                    </div>
                  }
                </section>
              }

              <!-- Sombra (por modo): estilo + tamaño (compartido) + color + orientación -->
              <section class="control-card" solReveal [solRevealIndex]="9">
                <h2 class="card-title">{{ t('shadow.title') }}</h2>
                <div class="control-row">
                  <span class="control-label">{{ t('shadow.style') }}</span>
                  <div class="segmented">
                    @for (option of shadowStyleOptions; track option.value) {
                      <button
                        type="button"
                        class="seg-btn"
                        [class.active]="modeForm().shadow === option.value"
                        (click)="setModeChoice('shadow', option.value)"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    }
                  </div>
                </div>
                <div class="control-row">
                  <span class="control-label">{{ t('shadow.size') }}</span>
                  <div class="segmented">
                    @for (option of shadowSizeOptions; track option.value) {
                      <button
                        type="button"
                        class="seg-btn"
                        [class.active]="form().shadowSize === option.value"
                        (click)="setChoice('shadowSize', option.value)"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    }
                  </div>
                </div>
                <div class="control-row">
                  <span class="control-label">{{ t('shadow.color') }}</span>
                  <div class="swatch-row">
                    @for (color of shadowColorSuggestions; track color) {
                      <button
                        type="button"
                        class="swatch"
                        [class.active]="modeForm().shadowColor === color"
                        [style.background]="color"
                        [attr.aria-label]="color"
                        (click)="setModeColor('shadowColor', color)"
                      ></button>
                    }
                    <input
                      class="swatch-picker"
                      type="color"
                      [value]="modeForm().shadowColor"
                      (input)="setModeColor('shadowColor', inputValue($event))"
                    />
                    <input
                      class="hex-input"
                      type="text"
                      maxlength="7"
                      data-testid="hex-shadowColor"
                      [value]="modeForm().shadowColor"
                      (change)="onModeHexChange('shadowColor', $event)"
                    />
                  </div>
                </div>
                <div class="control-row">
                  <span class="control-label">{{ t('shadow.direction') }}</span>
                  <div class="dir-grid" data-testid="shadow-direction">
                    @for (direction of shadowDirections; track direction.value) {
                      <button
                        type="button"
                        class="dir-cell"
                        [class.active]="modeForm().shadowDirection === direction.value"
                        [attr.aria-label]="t('shadow.dir.' + direction.value)"
                        [attr.data-testid]="'dir-' + direction.value"
                        (click)="setModeChoice('shadowDirection', direction.value)"
                      >
                        <span aria-hidden="true">{{ direction.glyph }}</span>
                      </button>
                    }
                  </div>
                </div>
              </section>

              <!-- Textura de fondo (por modo) -->
              <section class="control-card" solReveal [solRevealIndex]="10">
                <h2 class="card-title">{{ t('texture.title') }}</h2>
                <div class="control-row">
                  <span class="control-label">{{ t('texture.pattern') }}</span>
                  <div class="segmented">
                    @for (option of textureOptions; track option.value) {
                      <button
                        type="button"
                        class="seg-btn"
                        [class.active]="modeForm().texture === option.value"
                        (click)="setModeChoice('texture', option.value)"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    }
                  </div>
                </div>
                @if (textureUsesColor()) {
                  @for (field of textureColorFields; track field.key) {
                    <div class="control-row">
                      <span class="control-label">{{ t(field.labelKey) }}</span>
                      <div class="swatch-row">
                        @for (color of textureColorSuggestions; track color) {
                          <button
                            type="button"
                            class="swatch"
                            [class.active]="modeForm()[field.key] === color"
                            [style.background]="color"
                            [attr.aria-label]="color"
                            (click)="setModeColor(field.key, color)"
                          ></button>
                        }
                        <input
                          class="swatch-picker"
                          type="color"
                          [value]="modeForm()[field.key]"
                          (input)="setModeColor(field.key, inputValue($event))"
                        />
                        <input
                          class="hex-input"
                          type="text"
                          maxlength="7"
                          [attr.data-testid]="'hex-' + field.key"
                          [value]="modeForm()[field.key]"
                          (change)="onModeHexChange(field.key, $event)"
                        />
                      </div>
                    </div>
                  }
                }
              </section>

              <!-- Barra lateral y encabezado (por modo) -->
              <section class="control-card" solReveal [solRevealIndex]="11">
                <h2 class="card-title">{{ t('structure.modeTitle') }}</h2>
                @for (group of modeStructureGroups; track group.key) {
                  <div class="control-row">
                    <span class="control-label">{{ t(group.labelKey) }}</span>
                    <div class="segmented">
                      @for (option of group.options; track option.value) {
                        <button
                          type="button"
                          class="seg-btn"
                          [class.active]="modeForm()[group.key] === option.value"
                          (click)="setModeChoice(group.key, option.value)"
                        >
                          {{ t(option.labelKey) }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </section>
            </div>

            <!-- Divisor arrastrable (solo escritorio ≥1024px): puntero, flechas, Inicio/Fin; doble
                 clic vuelve al reparto por defecto. -->
            <div
              class="grid-divider"
              role="separator"
              aria-orientation="vertical"
              tabindex="0"
              [attr.aria-label]="t('preview.resize')"
              [attr.aria-valuenow]="studioSplit()"
              [attr.aria-valuemin]="splitMin"
              [attr.aria-valuemax]="splitMax"
              (pointerdown)="startResize($event)"
              (dblclick)="resetSplit()"
              (keydown)="onDividerKeydown($event)"
            >
              <span class="grid-divider__handle" aria-hidden="true"></span>
            </div>

            <!-- Vista previa (escritorio): card completo y pegajoso. -->
            <aside class="preview-pane">
              <div class="preview-toolbar">
                <h2 class="card-title">{{ t('preview.heading') }}</h2>
                <button type="button" class="mode-toggle" data-testid="preview-mode-toggle" (click)="toggleMode()">
                  {{ activeMode() === 'dark' ? t('preview.modeDark') : t('preview.modeLight') }}
                </button>
              </div>

              <div class="preview-body">
                <sol-theme-studio-preview
                  data-testid="studio-preview"
                  [theme]="effectiveTheme()"
                  [mode]="activeMode()"
                  [brand]="brandForm()"
                  [tagline]="tagline()"
                  [tableVariant]="form().tableVariant"
                  [loader]="previewLoader()"
                />
              </div>

              <div class="preview-actions">
                <sol-button
                  data-testid="studio-apply"
                  variant="primary"
                  [loading]="applying()"
                  [disabled]="busy()"
                  (clicked)="requestApply()"
                >
                  {{ t('actions.apply') }}
                </sol-button>
                <sol-button data-testid="studio-copy" variant="ghost" (clicked)="copyJson()">
                  <sol-icon name="clipboard" size="sm" />
                  {{ t('actions.copy') }}
                </sol-button>
                <sol-button data-testid="studio-export" size="touch" variant="ghost" (clicked)="exportJson()">{{ t('actions.export') }}</sol-button>
                <sol-button data-testid="studio-import" size="touch" variant="ghost" [loading]="importing()" [disabled]="importing() || applying()" (clicked)="themeJsonInput.click()">{{ t('actions.import') }}</sol-button>
                <p class="json-file-hint field-hint">{{ t('actions.jsonHint') }}</p>
                <p class="json-file-hint field-hint" role="status" aria-live="polite" data-testid="studio-json-status">{{ statusText() }}</p>
              </div>
            </aside>
          </div>

          <!-- Botón flotante (bajo 1024px): círculo al borde derecho a media altura. -->
          <button
            type="button"
            class="preview-fab"
            data-testid="preview-fab-mobile"
            [attr.aria-label]="t('preview.open')"
            [attr.aria-expanded]="previewOpenMobile()"
            (click)="previewOpenMobile.set(true)"
          >
            <sol-icon name="eye" size="md" />
          </button>

          <!-- Panel lateral de la vista previa (bajo 1024px): el card COMPLETO. -->
          @if (previewOpenMobile()) {
            <div class="preview-slide-over" role="dialog" aria-modal="true" [attr.aria-label]="t('preview.heading')">
              <div class="slide-over-backdrop" (click)="previewOpenMobile.set(false)"></div>

              <div class="slide-over-panel">
                <div class="slide-over-header">
                  <h2 class="card-title">{{ t('preview.heading') }}</h2>
                  <button type="button" class="mode-toggle" data-testid="preview-mode-toggle-mobile" (click)="toggleMode()">
                    {{ activeMode() === 'dark' ? t('preview.modeDark') : t('preview.modeLight') }}
                  </button>
                  <button
                    type="button"
                    class="close-btn"
                    data-testid="preview-slide-close"
                    [attr.aria-label]="t('preview.close')"
                    (click)="previewOpenMobile.set(false)"
                  >
                    <sol-icon name="x" size="md" />
                  </button>
                </div>

                <div class="slide-over-body">
                  <sol-theme-studio-preview
                    data-testid="studio-preview-mobile"
                    [theme]="effectiveTheme()"
                    [mode]="activeMode()"
                    [brand]="brandForm()"
                    [tagline]="tagline()"
                    [tableVariant]="form().tableVariant"
                    [loader]="previewLoader()"
                  />
                </div>

                <div class="slide-over-footer preview-actions">
                  <sol-button
                    data-testid="studio-apply-mobile"
                    variant="primary"
                    [loading]="applying()"
                    [disabled]="busy()"
                    (clicked)="requestApply()"
                  >
                    {{ t('actions.apply') }}
                  </sol-button>
                  <sol-button data-testid="studio-copy-mobile" variant="ghost" (clicked)="copyJson()">
                    <sol-icon name="clipboard" size="sm" />
                    {{ t('actions.copy') }}
                  </sol-button>
                  <sol-button data-testid="studio-export-mobile" size="touch" variant="ghost" (clicked)="exportJson()">{{ t('actions.export') }}</sol-button>
                  <sol-button data-testid="studio-import-mobile" size="touch" variant="ghost" [loading]="importing()" [disabled]="importing() || applying()" (clicked)="themeJsonInput.click()">{{ t('actions.import') }}</sol-button>
                  <p class="json-file-hint field-hint">{{ t('actions.jsonHint') }}</p>
                  <p class="json-file-hint field-hint" role="status" aria-live="polite" data-testid="studio-json-status-mobile">{{ statusText() }}</p>
                </div>
              </div>
            </div>
          }
          </div>

          @if (feature().loginAppearance) {
            <div class="studio-section" [hidden]="section() !== 'login'" data-testid="studio-section-login">
              <sol-login-appearance-editor
                [base]="loginBase()"
                [theme]="effectiveTheme()"
                [uploader]="loginUploader"
                [describeError]="describeStoreError"
                [showApplyShortcut]="true"
                (loginChange)="loginEdited.set($event)"
                (goToApply)="section.set('general')"
              />
            </div>
          }

          <sol-confirm-dialog
            [open]="showApplyConfirm()"
            [title]="t('confirm.title')"
            [message]="t('confirm.message')"
            [confirmLabel]="t('confirm.confirm')"
            [cancelLabel]="t('confirm.cancel')"
            variant="warning"
            (confirm)="confirmApply()"
            (cancel)="showApplyConfirm.set(false)"
          />
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    /* Section wrappers keep the original layout (flex children of .studio). */
    .studio-section {
      display: contents;
    }
    .studio-section[hidden] {
      display: none;
    }
    .section-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sol-space-xs, 4px);
      border-bottom: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default);
    }
    .section-tab {
      min-height: var(--sol-size-component-md, 36px);
      padding: 0 var(--sol-space-md, 16px);
      border: 0;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--sol-color-text-secondary);
      font: inherit;
      cursor: pointer;
    }
    .section-tab--on {
      border-bottom-color: var(--sol-color-primary);
      color: var(--sol-color-text-primary);
      font-weight: var(--sol-font-weight-bold);
    }
    .section-tab:focus-visible {
      outline: 2px solid var(--sol-color-primary);
      outline-offset: 2px;
    }
    .section-tab__mark {
      margin-left: var(--sol-space-xs, 4px);
      font-size: var(--sol-font-size-sm);
      color: var(--sol-color-text-muted);
    }
    @media (max-width: 767.98px) {
      .section-tab {
        min-height: var(--sol-size-control-touch, 44px);
      }
    }
    .studio {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-md, 16px);
      padding-bottom: var(--sol-space-xl, 32px);
      min-width: 0;
    }
    .studio-title,
    .card-title {
      margin: 0;
      font-family: var(--sol-font-display, var(--sol-font-family, system-ui, sans-serif));
      font-weight: var(--sol-display-weight, 700);
      letter-spacing: var(--sol-display-tracking, 0em);
      text-transform: var(--sol-display-transform, none);
      color: var(--sol-color-text-primary, #0F172A);
    }
    .studio-title {
      font-size: var(--sol-font-size-xl, 20px);
    }
    .studio-subtitle {
      margin: 4px 0 0;
      color: var(--sol-color-text-secondary, #475569);
      font-size: var(--sol-font-size-sm, 13px);
    }
    /* Estados de carga (propios de la librería: el tema llega por el store). */
    .state-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sol-space-sm, 8px);
      padding: var(--sol-space-xl, 32px) var(--sol-space-md, 16px);
      text-align: center;
      background: var(--sol-card-bg, var(--sol-bg-surface, #FFFFFF));
      border: var(--sol-card-border, 1px solid var(--sol-border-color-default, #E2E8F0));
      border-radius: var(--sol-card-radius, 12px);
      color: var(--sol-color-text-secondary, #475569);
    }
    .state-panel p {
      margin: 0;
    }
    .state-panel--error {
      color: var(--sol-color-danger, #DC2626);
    }
    .notice {
      margin: 0;
      padding: var(--sol-space-sm, 8px) var(--sol-space-md, 12px);
      border-radius: var(--sol-border-radius-md, 8px);
      background: color-mix(in srgb, var(--sol-color-info, #0284C7) 10%, transparent);
      color: var(--sol-color-text-primary, #0F172A);
      font-size: var(--sol-font-size-sm, 13px);
    }
    /* Rejilla controles | divisor | vista previa. Una sola columna bajo 1024px; en escritorio el
       reparto lo fija --studio-split. El borde "pegajoso" descuenta el header fijo del shell. */
    .studio-grid {
      --studio-split: 60%;
      --studio-sticky-top: calc(var(--sol-size-header-height, 56px) + var(--sol-space-md, 16px));
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sol-space-lg, 24px);
      align-items: start;
    }
    .studio-grid.is-resizing {
      cursor: col-resize;
      user-select: none;
      -webkit-user-select: none;
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-md, 16px);
      min-width: 0;
    }
    .grid-divider {
      display: none;
      position: relative;
      align-self: stretch;
      width: var(--sol-space-lg, 24px);
      cursor: col-resize;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      outline: none;
    }
    .grid-divider::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: var(--sol-border-width-default, 1px);
      transform: translateX(-50%);
      background: var(--sol-border-color-default, #E2E8F0);
    }
    .grid-divider__handle {
      position: sticky;
      top: calc(50dvh - var(--sol-space-lg, 24px));
      display: block;
      width: var(--sol-space-xs, 4px);
      height: calc(var(--sol-space-lg, 24px) * 2);
      margin: 0 auto;
      border-radius: var(--sol-border-radius-full, 999px);
      background: var(--sol-color-text-muted, #64748B);
      transition:
        background var(--sol-dur-fast, 120ms) var(--sol-ease, ease),
        transform var(--sol-dur-fast, 120ms) var(--sol-ease, ease);
    }
    .grid-divider:hover .grid-divider__handle,
    .grid-divider:focus-visible .grid-divider__handle,
    .studio-grid.is-resizing .grid-divider__handle {
      background: var(--sol-color-primary, #2563EB);
      transform: scaleX(1.5);
    }
    .grid-divider:focus-visible .grid-divider__handle {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #2563EB) 30%, transparent);
    }
    .group-title {
      margin: var(--sol-space-sm, 8px) 0 0;
      font-size: var(--sol-font-size-sm, 13px);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--sol-color-text-muted, #64748B);
    }
    .control-card {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-md, 16px);
      padding: var(--sol-space-lg, 24px);
      background: var(--sol-card-bg, var(--sol-bg-surface, #FFFFFF));
      border: var(--sol-card-border, 1px solid var(--sol-border-color-default, #E2E8F0));
      border-radius: var(--sol-card-radius, 12px);
      box-shadow: var(--sol-card-shadow, none);
    }
    .card-title {
      font-size: var(--sol-font-size-lg, 16px);
    }
    .control-row {
      display: flex;
      flex-direction: column;
      gap: 7px;
      min-width: 0;
    }
    .control-label {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      font-size: var(--sol-font-size-sm, 13px);
      color: var(--sol-color-text-secondary, #475569);
    }
    .range-value {
      font-family: var(--sol-font-numeric, var(--sol-font-family, system-ui, sans-serif));
      color: var(--sol-color-text-primary, #0F172A);
    }
    .swatch-row {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
    }
    .field-hint {
      margin: 0;
      font-size: var(--sol-font-size-sm, 13px);
      color: var(--sol-color-text-muted, #64748B);
    }
    .logo-thumb {
      width: 40px;
      height: 40px;
      object-fit: contain;
      border-radius: var(--sol-border-radius-sm, 6px);
      border: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #e5e7eb);
      background: var(--sol-bg-sunken, #f8fafc);
    }
    .swatch {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid var(--sol-border-color-default, #E2E8F0);
      cursor: pointer;
      padding: 0;
    }
    .swatch.active {
      border-color: var(--sol-color-primary, #2563EB);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--sol-color-primary, #2563EB) 35%, transparent);
    }
    .swatch-picker {
      width: 30px;
      height: 26px;
      padding: 0;
      border: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #E2E8F0);
      border-radius: var(--sol-border-radius-sm, 6px);
      background: transparent;
      cursor: pointer;
    }
    .hex-input,
    .text-input {
      background: var(--sol-input-bg, var(--sol-bg-surface, #FFFFFF));
      border: var(--sol-input-border, 1px solid var(--sol-border-color-default, #E2E8F0));
      border-radius: var(--sol-input-radius, 6px);
      box-shadow: var(--sol-input-shadow, none);
      color: var(--sol-color-text-primary, #0F172A);
      outline: none;
    }
    .hex-input {
      width: 92px;
      height: 28px;
      padding: 0 8px;
      font-family: var(--sol-font-family-mono, ui-monospace, monospace);
      font-size: var(--sol-font-size-sm, 13px);
      text-transform: uppercase;
    }
    .text-input {
      width: 100%;
      height: var(--sol-size-input-height, 36px);
      padding: 0 10px;
      font: inherit;
    }
    .hex-input:focus,
    .text-input:focus {
      border: var(--sol-input-focus-border, 1px solid var(--sol-color-primary, #2563EB));
      box-shadow: var(--sol-input-focus-ring, none);
    }
    .font-list {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .font-btn {
      padding: 8px 12px;
      font-size: 15px;
      background: var(--sol-bg-sunken, #F1F5F9);
      color: var(--sol-color-text-primary, #0F172A);
      border: var(--sol-border-width-default, 1px) solid transparent;
      border-radius: var(--sol-border-radius-md, 8px);
      cursor: pointer;
    }
    .font-btn.active {
      border-color: var(--sol-color-primary, #2563EB);
      background: color-mix(in srgb, var(--sol-color-primary, #2563EB) 8%, transparent);
    }
    .font-select {
      width: 100%;
      max-width: 280px;
      height: var(--sol-size-input-height, 36px);
      padding: 0 10px;
      background: var(--sol-input-bg, var(--sol-bg-surface, #FFFFFF));
      border: var(--sol-input-border, 1px solid var(--sol-border-color-default, #E2E8F0));
      border-radius: var(--sol-input-radius, 6px);
      box-shadow: var(--sol-input-shadow, none);
      color: var(--sol-color-text-primary, #0F172A);
      font-size: var(--sol-font-size-sm, 13px);
      outline: none;
      cursor: pointer;
    }
    .font-select:focus {
      border: var(--sol-input-focus-border, 1px solid var(--sol-color-primary, #2563EB));
      box-shadow: var(--sol-input-focus-ring, none);
    }
    .segmented {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      padding: 3px;
      background: var(--sol-bg-sunken, #F1F5F9);
      border-radius: var(--sol-border-radius-md, 8px);
      width: fit-content;
      max-width: 100%;
    }
    .seg-btn,
    .mode-tab {
      font-size: var(--sol-font-size-sm, 13px);
      font-family: inherit;
      background: transparent;
      color: var(--sol-color-text-secondary, #475569);
      border: none;
      border-radius: calc(var(--sol-border-radius-md, 8px) - 2px);
      cursor: pointer;
      transition: background var(--sol-dur-fast, 120ms) var(--sol-ease, ease);
    }
    .seg-btn.active,
    .mode-tab.active {
      background: var(--sol-bg-surface, #FFFFFF);
      color: var(--sol-color-primary, #2563EB);
      box-shadow: var(--sol-shadow-sm, none);
      font-weight: 600;
    }
    .seg-btn {
      padding: 5px 11px;
    }
    .seg-btn:focus-visible,
    .mode-tab:focus-visible,
    .swatch:focus-visible,
    .dir-cell:focus-visible,
    .font-btn:focus-visible,
    .mode-toggle:focus-visible {
      outline: 2px solid var(--sol-color-primary, #2563EB);
      outline-offset: 2px;
    }
    .range {
      width: 100%;
      accent-color: var(--sol-color-primary, #2563EB);
    }
    .mode-tabs-head {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mode-tabs {
      display: flex;
      gap: 4px;
      padding: 3px;
      background: var(--sol-bg-sunken, #F1F5F9);
      border: var(--sol-card-border, 1px solid var(--sol-border-color-default, #E2E8F0));
      border-radius: var(--sol-border-radius-md, 8px);
    }
    .mode-tab {
      flex: 1;
      padding: 7px 12px;
    }
    .dir-grid {
      display: grid;
      grid-template-columns: repeat(3, 30px);
      grid-auto-rows: 30px;
      gap: 4px;
      width: fit-content;
      padding: 3px;
      background: var(--sol-bg-sunken, #F1F5F9);
      border-radius: var(--sol-border-radius-md, 8px);
    }
    .dir-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
      background: transparent;
      color: var(--sol-color-text-secondary, #475569);
      border: var(--sol-border-width-default, 1px) solid transparent;
      border-radius: var(--sol-border-radius-sm, 6px);
      cursor: pointer;
      transition: background var(--sol-dur-fast, 120ms) var(--sol-ease, ease);
    }
    .dir-cell.active {
      background: var(--sol-bg-surface, #FFFFFF);
      color: var(--sol-color-primary, #2563EB);
      border-color: var(--sol-color-primary, #2563EB);
      font-weight: 700;
    }
    .history-panel {
      padding: var(--sol-space-4, 16px);
    }
    .history-list {
      list-style: none;
      padding: var(--sol-space-0, 0px);
    }
    .history-list li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--sol-space-4, 16px);
      padding-block: var(--sol-space-2, 8px);
    }
    /* Card de la vista previa (escritorio): pegajoso bajo el header del shell y acotado al alto
       de la ventana (menos --sol-theme-studio-bottom-inset, p. ej. un pie fijo del shell). */
    .preview-pane {
      display: none;
      position: sticky;
      top: var(--studio-sticky-top);
      max-height: calc(
        100dvh - var(--studio-sticky-top) - var(--sol-theme-studio-bottom-inset, 0px) - var(--sol-space-md, 16px)
      );
      flex-direction: column;
      gap: var(--sol-space-sm, 8px);
      padding: var(--sol-space-md, 16px);
      background: var(--sol-card-bg, var(--sol-bg-surface, #FFFFFF));
      border: var(--sol-card-border, 1px solid var(--sol-border-color-default, #E2E8F0));
      border-radius: var(--sol-card-radius, 12px);
      box-shadow: var(--sol-card-shadow, none);
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .preview-toolbar {
      flex: 0 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sol-space-sm, 8px);
    }
    .preview-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .mode-toggle {
      padding: 5px 11px;
      font-size: var(--sol-font-size-sm, 13px);
      font-family: inherit;
      background: var(--sol-bg-sunken, #F1F5F9);
      color: var(--sol-color-text-secondary, #475569);
      border: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #E2E8F0);
      border-radius: var(--sol-border-radius-full, 999px);
      cursor: pointer;
      white-space: nowrap;
    }
    .json-file-hint {
      flex-basis: 100%;
    }
    .preview-actions {
      flex: 0 0 auto;
      display: flex;
      gap: var(--sol-space-sm, 8px);
      flex-wrap: wrap;
      padding-top: var(--sol-space-sm, 8px);
      border-top: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #E2E8F0);
    }
    .studio-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* ── Botón flotante + panel lateral de la vista previa (bajo 1024px) ── */
    .preview-fab {
      position: fixed;
      right: var(--sol-space-sm, 8px);
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      width: calc(var(--sol-size-control-touch, 44px) + var(--sol-space-sm, 8px));
      height: calc(var(--sol-size-control-touch, 44px) + var(--sol-space-sm, 8px));
      border: none;
      border-radius: var(--sol-border-radius-full, 999px);
      background: var(--sol-color-primary, #2563EB);
      color: var(--sol-color-primary-contrast, #FFFFFF);
      cursor: pointer;
      z-index: calc(var(--sol-z-dropdown, 100) + 10);
      box-shadow:
        var(--sol-shadow-lg, none),
        0 0 0 4px color-mix(in srgb, var(--sol-color-primary, #2563EB) 25%, transparent);
      transition:
        transform var(--sol-dur-fast, 120ms) var(--sol-ease, ease),
        box-shadow var(--sol-dur-fast, 120ms) var(--sol-ease, ease);
    }
    .preview-fab:active {
      transform: translateY(-50%) scale(0.94);
    }
    .preview-fab:focus-visible {
      outline: none;
      box-shadow:
        var(--sol-shadow-lg, none),
        0 0 0 4px color-mix(in srgb, var(--sol-color-primary, #2563EB) 45%, transparent);
    }
    .preview-slide-over {
      position: fixed;
      inset: 0;
      z-index: var(--sol-z-modal, 1000);
    }
    .slide-over-backdrop {
      position: absolute;
      inset: 0;
      background: var(--sol-bg-overlay, rgba(0, 0, 0, 0.5));
      backdrop-filter: var(--sol-overlay-blur, blur(3px));
      -webkit-backdrop-filter: var(--sol-overlay-blur, blur(3px));
      animation: studioFadeIn var(--sol-dur-fast, 120ms) var(--sol-ease, ease);
    }
    .slide-over-panel {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(100vw, 520px);
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: var(--sol-card-bg, var(--sol-bg-surface, #FFFFFF));
      box-shadow: var(--sol-shadow-lg, none);
      /* Paridad exacta: --sol-dur-normal no lo emite la EMIT_TABLE, así que (como en el origen)
         la declaración queda inválida y el panel aparece sin deslizarse. Ver CHANGELOG 0.6.1. */
      animation: studioSlideIn var(--sol-dur-normal) var(--sol-ease, ease);
    }
    @keyframes studioSlideIn {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }
    @keyframes studioFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    .slide-over-header {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: var(--sol-space-sm, 8px);
      padding: var(--sol-space-md, 16px);
      padding-top: calc(var(--sol-space-md, 16px) + env(safe-area-inset-top, 0px));
      border-bottom: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #E2E8F0);
    }
    .slide-over-header .card-title {
      flex: 1 1 auto;
      min-width: 0;
      font-size: var(--sol-font-size-lg, 16px);
    }
    .slide-over-header .mode-toggle,
    .close-btn {
      min-height: var(--sol-size-control-touch, 44px);
    }
    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: var(--sol-size-control-touch, 44px);
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--sol-border-radius-md, 8px);
      color: var(--sol-color-text-secondary, #475569);
      cursor: pointer;
      transition:
        background var(--sol-dur-fast, 120ms) var(--sol-ease, ease),
        color var(--sol-dur-fast, 120ms) var(--sol-ease, ease);
    }
    .close-btn:hover {
      background: var(--sol-bg-sunken, #F1F5F9);
      color: var(--sol-color-text-primary, #0F172A);
    }
    .slide-over-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      padding: var(--sol-space-md, 16px);
    }
    .slide-over-footer {
      flex: 0 0 auto;
      display: flex;
      gap: var(--sol-space-sm, 8px);
      flex-wrap: wrap;
      padding: var(--sol-space-md, 16px);
      padding-bottom: calc(var(--sol-space-md, 16px) + env(safe-area-inset-bottom, 0px));
      border-top: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #E2E8F0);
      background: var(--sol-bg-sunken, #F1F5F9);
    }

    /* ── Escritorio (≥1024px): controles | divisor | vista previa ── */
    @media (min-width: 1024px) {
      .studio-grid {
        grid-template-columns: minmax(0, var(--studio-split)) var(--sol-space-lg, 24px) minmax(0, 1fr);
        gap: 0;
      }
      .grid-divider {
        display: block;
      }
      .preview-pane {
        display: flex;
      }
      .preview-fab,
      .preview-slide-over {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .slide-over-backdrop,
      .slide-over-panel {
        animation: none;
      }
    }
  `,
})
export class SolThemeStudioComponent implements OnInit, OnDestroy {
  private readonly store = inject(THEME_STUDIO_STORE, { optional: true });
  private readonly themeService = inject(ThemeService);
  private readonly bundledDefault = inject(SOL_DEFAULT_THEME);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(SOL_I18N);
  protected readonly t = injectThemeStudioText();

  /** Tema base cuando el tenant no tiene uno guardado (por defecto, `SOL_DEFAULT_THEME`). */
  readonly baseTheme = input<ThemeFile | undefined>(undefined);
  /** Campos opacos del host que viajan intactos a `meta` (y se aceptan al importar JSON). */
  readonly metaExtras = input<Readonly<Record<string, unknown>> | undefined>(undefined);
  /**
   * Forma de campos opacos de `meta` que el host PRESERVA sin escribirlos (p. ej. el
   * comportamiento del menú lateral): solo amplía lo que el importador de JSON acepta.
   */
  readonly metaExtrasSchema = input<Readonly<Record<string, unknown>> | undefined>(undefined);
  /** Secciones y comportamientos opcionales (ver `SolThemeStudioFeatures`). */
  readonly features = input<SolThemeStudioFeatures>({});
  /** Placeholder del texto del pie de página (p. ej. el formato por defecto del pie del host). */
  readonly footerPlaceholder = input<string | undefined>(undefined);
  /** Nombre del archivo de «Exportar JSON». Por defecto, `<tenant>-theme.json`. */
  readonly exportFileName = input<string | undefined>(undefined);
  /** Zona horaria IANA de las fechas del historial (p. ej. `America/Bogota`). Por defecto, la del navegador. */
  readonly versionTimeZone = input<string | undefined>(undefined);
  /** Texto que sigue a cada fecha del historial (p. ej. `(Bogotá)`). */
  readonly versionTimeZoneLabel = input<string | undefined>(undefined);

  /** Tema persistido con éxito por `store.apply(...)`. */
  readonly applied = output<ThemeFile>();
  /** Avisos para que la aplicación los muestre a su manera. */
  readonly notify = output<SolThemeStudioNotice>();

  /** El store permite subir imágenes (logo, favicon, imagen del indicador de carga). */
  protected readonly canUpload = typeof this.store?.uploadLogo === 'function';
  /** El store expone historial completo (listar + leer una versión). */
  protected readonly canBrowseHistory =
    typeof this.store?.listVersions === 'function' && typeof this.store?.getVersion === 'function';

  protected readonly feature = computed<Required<Omit<SolThemeStudioFeatures, 'tableVariantMetaKey'>> & {
    tableVariantMetaKey?: string;
  }>(() => ({
    themeName: true,
    loader: false,
    persistDefaultModeOnApply: false,
    loginAppearance: false,
    ...this.features(),
  }));

  protected readonly loadState = signal<LoadState>(this.store ? 'loading' : 'no-store');
  private readonly savedTheme = signal<ThemeFile | null>(null);
  protected readonly hasSavedTheme = computed(() => this.savedTheme() !== null);

  protected readonly form = signal<ThemeStudioForm>(cloneStudioForm(DEFAULT_STUDIO_FORM));
  /** Modo activo: define QUÉ bloque por modo se edita Y el modo de la vista previa. */
  protected readonly activeMode = signal<ThemeMode>(this.themeService.isDark() ? 'dark' : 'light');
  protected readonly modeForm = computed<ThemeStudioModeForm>(() => this.form()[this.activeMode()]);

  protected readonly brandForm = signal<ThemeLogo>({ url: '', altText: '', width: 120 });
  protected readonly themeName = signal('');
  protected readonly tagline = signal('');
  protected readonly favicon = signal('');
  protected readonly loaderForm = signal<ThemeLoaderConfig>({ ...DEFAULT_LOADER_CONFIG });

  /** Logo que se está subiendo (deshabilita ambos botones de logo mientras dura). */
  protected readonly uploadingLogo = signal<'logo' | 'logoDark' | null>(null);
  protected readonly uploadingFavicon = signal(false);
  protected readonly uploadingLoaderImage = signal(false);
  protected readonly logoAccept = LOGO_ACCEPT;
  protected readonly faviconAccept = FAVICON_ACCEPT;

  protected readonly historyOpen = signal(false);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<StatusMessage | null>(null);
  protected readonly versions = signal<ThemeVersion[]>([]);
  protected readonly nextCursor = signal<ThemeVersionPage['next']>(null);
  protected readonly versionLoading = signal(false);
  private readonly selectedVersion = signal<ThemeVersion['id'] | null>(null);

  protected readonly importing = signal(false);
  protected readonly applying = signal(false);
  protected readonly showApplyConfirm = signal(false);
  /** Bajo 1024px la vista previa vive en el panel lateral que abre el botón flotante. */
  protected readonly previewOpenMobile = signal(false);
  protected readonly status = signal<StatusMessage | null>(null);
  protected readonly busy = computed(() => this.applying() || this.versionLoading() || this.importing());

  private readonly importedTheme = signal<ThemeFile | null>(null);
  private importedGenerated: ThemeFile | null = null;

  private readonly gridContainer = viewChild<ElementRef<HTMLElement>>('gridContainer');
  protected readonly studioSplit = signal(readStoredSplit());
  protected readonly resizing = signal(false);
  protected readonly splitMin = SPLIT_MIN;
  protected readonly splitMax = SPLIT_MAX;

  /** Base del builder: importado/versión en borrador → tema guardado → base del host → empaquetado. */
  private readonly workingBase = computed<ThemeFile>(
    () => this.importedTheme() ?? this.savedTheme() ?? this.baseTheme() ?? this.bundledDefault,
  );

  /** Pestaña visible cuando `features.loginAppearance` está activa. */
  protected readonly section = signal<'general' | 'login'>('general');
  /** `meta.login` de la base, normalizado: lo que el editor muestra mientras nadie lo toque. */
  protected readonly loginBase = computed<ThemeLogin>(
    () => normalizeLogin((this.workingBase().meta as { login?: unknown } | undefined)?.login) ?? {},
  );
  /**
   * Último `meta.login` editado; `null` mientras la persona no cambie nada en la pestaña. Una base
   * nueva (importación, versión del historial) lo descarta: sin cambios, el `meta.login` propio de
   * la base viaja intacto.
   */
  protected readonly loginEdited = linkedSignal<ThemeLogin, ThemeLogin | null>({
    source: this.loginBase,
    computation: () => null,
  });
  /** Hay cambios de inicio de sesión que todavía no se aplicaron. */
  protected readonly loginUnsaved = computed(() => {
    const edited = this.loginEdited();
    if (!edited) return false;
    const saved = normalizeLogin((this.savedTheme()?.meta as { login?: unknown } | undefined)?.login);
    return JSON.stringify(edited) !== JSON.stringify(saved);
  });
  protected readonly loginUploader: LoginPhotoUploader | null = this.store?.uploadLogo
    ? file => this.store!.uploadLogo!(file)
    : null;
  protected readonly describeStoreError = extractStoreErrorMessage;

  /** Indicador de carga para la vista previa (solo con la sección activa). */
  protected readonly previewLoader = computed<ThemeLoaderConfig | undefined>(() =>
    this.feature().loader ? this.loaderForm() : undefined,
  );

  /**
   * TEMA EN EDICIÓN: el formulario construido sobre la base, con la marca, el nombre, el pie, el
   * favicon y las secciones opcionales (indicador de carga, variante de tabla en `meta`)
   * compuestos en `meta`. Un tema importado o una versión en borrador conserva sus tokens no
   * editados (`mergeThemeEditorChanges`).
   */
  protected readonly effectiveTheme = computed<ThemeFile>(() => {
    const built = buildThemeFile(this.form(), this.workingBase(), this.metaExtras());
    const feature = this.feature();
    const meta: ThemeMeta & Record<string, unknown> = {
      ...built.meta,
      logo: { ...this.brandForm() },
      name: this.themeName().trim() || undefined,
      tagline: this.tagline().trim() || undefined,
      favicon: this.favicon().trim() || undefined,
    };
    if (feature.loader) meta['loader'] = { ...this.loaderForm() };
    if (feature.tableVariantMetaKey) meta[feature.tableVariantMetaKey] = this.form().tableVariant;
    const login = feature.loginAppearance ? this.loginEdited() : null;
    if (login) meta['login'] = login;
    const generated: ThemeFile = { ...built, meta };
    const imported = this.importedTheme();
    return imported && this.importedGenerated
      ? mergeThemeEditorChanges(imported, this.importedGenerated, generated)
      : generated;
  });

  protected readonly textureUsesColor = computed(() => TEXTURE_COLOR_TEXTURES.has(this.modeForm().texture));

  // ── Catálogos de controles (cada opción → ruta del contrato) ──
  protected readonly modes: ReadonlyArray<ThemeMode> = ['light', 'dark'];
  protected readonly baseSizeMin = BASE_SIZE_MIN;
  protected readonly baseSizeMax = BASE_SIZE_MAX;
  protected readonly lineHeightMin = LINE_HEIGHT_MIN;
  protected readonly lineHeightMax = LINE_HEIGHT_MAX;
  protected readonly radiusMin = RADIUS_MIN;
  protected readonly radiusMax = RADIUS_MAX;
  protected readonly brandWidthMin = BRAND_WIDTH_MIN;
  protected readonly brandWidthMax = BRAND_WIDTH_MAX;
  protected readonly shadowColorSuggestions = STUDIO_SHADOW_COLOR_SUGGESTIONS;
  protected readonly textureColorSuggestions = STUDIO_TEXTURE_COLOR_SUGGESTIONS;

  protected readonly fontRoles: ReadonlyArray<{
    key: 'displayFont' | 'bodyFont';
    labelKey: string;
    testId: string;
    quick: ReadonlyArray<string>;
    catalog: ReadonlyArray<string>;
  }> = [
    {
      key: 'displayFont',
      labelKey: 'typography.display',
      testId: 'select-display-font',
      quick: STUDIO_DISPLAY_FONTS_QUICK,
      catalog: STUDIO_DISPLAY_FONTS,
    },
    {
      key: 'bodyFont',
      labelKey: 'typography.body',
      testId: 'select-body-font',
      quick: STUDIO_BODY_FONTS_QUICK,
      catalog: STUDIO_BODY_FONTS,
    },
  ];

  protected readonly authLayoutOptions: ReadonlyArray<SegmentOption> = [
    opt('centered', 'auth.layoutCentered'),
    opt('split-left', 'auth.layoutSplitLeft'),
    opt('split-right', 'auth.layoutSplitRight'),
  ];
  protected readonly defaultModeOptions: ReadonlyArray<SegmentOption> = [
    opt('light', 'defaultMode.light'),
    opt('dark', 'defaultMode.dark'),
  ];
  protected readonly tableVariantOptions: ReadonlyArray<SegmentOption> = SOL_TABLE_VARIANTS.map(
    (variant: SolTableVariant) => opt(variant, variant === 'emphasis-header' ? 'table.emphasisHeader' : `table.${variant}`),
  );
  protected readonly loaderPresentationOptions: ReadonlyArray<SegmentOption> = STUDIO_LOADER_PRESENTATIONS.map(value =>
    opt(value, `loader.presentation${value[0].toUpperCase()}${value.slice(1)}`),
  );
  protected readonly loaderAnimationOptions: ReadonlyArray<SegmentOption> = STUDIO_LOADER_ANIMATIONS.map(value =>
    opt(value, `loader.animation${value[0].toUpperCase()}${value.slice(1)}`),
  );

  protected readonly typographyGroups: ReadonlyArray<SegmentGroup<SharedSegmentKey>> = [
    {
      key: 'displayWeight',
      labelKey: 'typography.weight',
      options: [
        opt('auto', 'typography.weightAuto'),
        opt(600, 'typography.weight600'),
        opt(700, 'typography.weight700'),
        opt(800, 'typography.weight800'),
      ],
    },
    {
      key: 'displayTransform',
      labelKey: 'typography.transform',
      options: [
        opt('auto', 'typography.transformAuto'),
        opt('none', 'typography.transformNone'),
        opt('uppercase', 'typography.transformUpper'),
      ],
    },
  ];

  protected readonly shapeGroups: ReadonlyArray<SegmentGroup<SharedSegmentKey>> = [
    {
      key: 'button',
      labelKey: 'shape.button',
      options: [opt('pill', 'shape.buttonPill'), opt('rounded', 'shape.buttonRounded'), opt('sharp', 'shape.buttonSharp')],
    },
    {
      key: 'input',
      labelKey: 'shape.input',
      options: [opt('filled', 'shape.inputFilled'), opt('outline', 'shape.inputOutline'), opt('underline', 'shape.inputUnderline')],
    },
  ];

  protected readonly sharedStructureGroups: ReadonlyArray<SegmentGroup<SharedSegmentKey>> = [
    {
      key: 'density',
      labelKey: 'structure.density',
      options: [
        opt('compact', 'structure.densityCompact'),
        opt('comfortable', 'structure.densityComfortable'),
        opt('spacious', 'structure.densitySpacious'),
      ],
    },
    {
      key: 'border',
      labelKey: 'structure.border',
      options: [
        opt('hairline', 'structure.borderHairline'),
        opt('normal', 'structure.borderNormal'),
        opt('thick', 'structure.borderThick'),
      ],
    },
  ];

  protected readonly motionGroups: ReadonlyArray<SegmentGroup<SharedSegmentKey>> = [
    {
      key: 'intensity',
      labelKey: 'motion.intensity',
      options: [
        opt('none', 'motion.intensityNone'),
        opt('subtle', 'motion.intensitySubtle'),
        opt('smooth', 'motion.intensitySmooth'),
        opt('expressive', 'motion.intensityExpressive'),
      ],
    },
    {
      key: 'reveal',
      labelKey: 'motion.reveal',
      options: [
        opt('rise', 'motion.revealRise'),
        opt('fade', 'motion.revealFade'),
        opt('pop', 'motion.revealPop'),
        opt('slide', 'motion.revealSlide'),
        opt('zoom', 'motion.revealZoom'),
      ],
    },
    {
      key: 'motionDuration',
      labelKey: 'motion.duration',
      options: [opt('fast', 'motion.durationFast'), opt('normal', 'motion.durationNormal'), opt('slow', 'motion.durationSlow')],
    },
    {
      key: 'overlayBlur',
      labelKey: 'motion.overlayBlur',
      options: [
        opt('none', 'motion.overlayNone'),
        opt('soft', 'motion.overlaySoft'),
        opt('medium', 'motion.overlayMedium'),
        opt('strong', 'motion.overlayStrong'),
      ],
    },
  ];

  protected readonly shadowStyleOptions: ReadonlyArray<SegmentOption> = [
    opt('none', 'shadow.none'),
    opt('soft', 'shadow.soft'),
    opt('diffuse', 'shadow.diffuse'),
    opt('hard', 'shadow.hard'),
  ];
  protected readonly shadowSizeOptions: ReadonlyArray<SegmentOption> = [
    opt('sm', 'shadow.sizeSmall'),
    opt('md', 'shadow.sizeMedium'),
    opt('lg', 'shadow.sizeLarge'),
  ];
  protected readonly shadowDirections = STUDIO_SHADOW_DIRECTIONS.map(value => ({ value, glyph: DIRECTION_GLYPHS[value] }));
  protected readonly textureOptions: ReadonlyArray<SegmentOption> = (
    ['none', 'glow', 'grid', 'stripes', 'corners', 'dots', 'mesh', 'vignette', 'waves'] as const
  ).map(texture => opt(texture, `texture.${texture}`));
  protected readonly textureColorFields: ReadonlyArray<{ key: 'textureColor1' | 'textureColor2'; labelKey: string }> = [
    { key: 'textureColor1', labelKey: 'texture.color1' },
    { key: 'textureColor2', labelKey: 'texture.color2' },
  ];
  protected readonly modeStructureGroups: ReadonlyArray<SegmentGroup<ModeSegmentKey>> = [
    {
      key: 'sidebar',
      labelKey: 'structure.sidebar',
      options: [opt('light', 'structure.sidebarLight'), opt('dark', 'structure.sidebarDark'), opt('accent', 'structure.sidebarAccent')],
    },
    {
      key: 'header',
      labelKey: 'structure.header',
      options: [opt('translucent', 'structure.headerTranslucent'), opt('solid', 'structure.headerSolid')],
    },
  ];

  /** Secciones de color por modo (Color + Roles de estado), con sugerencias del modo activo. */
  protected readonly colorSections = computed(() => {
    const dark = this.activeMode() === 'dark';
    const suggestions = dark ? STUDIO_COLOR_SUGGESTIONS_DARK : STUDIO_COLOR_SUGGESTIONS_LIGHT;
    const field = (key: StudioColorFieldKey, labelKey: string, hintKey?: string) => ({
      key: key as StudioModeColorKey,
      labelKey,
      hintKey,
      suggestions: suggestions[key],
    });
    return [
      {
        titleKey: 'color.title',
        fields: [
          field('primary', 'color.primary'),
          field('accent', 'color.accent', 'color.accentHint'),
          field('pageBg', 'color.pageBg'),
          field('surfaceBg', 'color.surfaceBg'),
          field('secondary', 'color.secondary'),
          {
            key: 'textColor' as StudioModeColorKey,
            labelKey: 'color.text',
            hintKey: 'color.textHint',
            suggestions: dark ? STUDIO_TEXT_COLOR_SUGGESTIONS_DARK : STUDIO_TEXT_COLOR_SUGGESTIONS_LIGHT,
          },
        ],
      },
      {
        titleKey: 'stateColor.title',
        fields: [
          field('success', 'stateColor.success', 'stateColor.successHint'),
          field('warning', 'stateColor.warning', 'stateColor.warningHint'),
          field('danger', 'stateColor.danger', 'stateColor.dangerHint'),
          field('info', 'stateColor.info', 'stateColor.infoHint'),
        ],
      },
    ];
  });

  ngOnInit(): void {
    if (this.store) this.load();
    this.injectStudioFonts();
  }

  ngOnDestroy(): void {
    document.head.querySelector('link[data-sol-studio-fonts]')?.remove();
  }

  // ── Carga ──

  /** Pide el tema guardado al store (también es la acción de "Reintentar"). */
  load(): void {
    const store = this.store;
    if (!store) return;
    this.loadState.set('loading');
    store
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: theme => {
          const saved = theme && isRenderableTheme(theme) ? theme : null;
          this.savedTheme.set(saved);
          this.hydrateFrom(saved ?? this.baseTheme() ?? this.bundledDefault);
          this.loadState.set('ready');
        },
        error: () => this.loadState.set('error'),
      });
  }

  /** Vuelca un ThemeFile en el formulario, la marca, el nombre, el pie, el favicon y los opcionales. */
  private hydrateFrom(theme: ThemeFile): void {
    const form = mapThemeFileToForm(theme, DEFAULT_STUDIO_FORM);
    const meta = theme.meta as ThemeMeta & Record<string, unknown>;
    const variantKey = this.feature().tableVariantMetaKey;
    const metaVariant = variantKey ? meta[variantKey] : undefined;
    if (typeof metaVariant === 'string' && SOL_TABLE_VARIANTS.includes(metaVariant as SolTableVariant)) {
      form.tableVariant = metaVariant as SolTableVariant;
    }
    this.form.set(form);
    this.brandForm.set({ ...theme.meta.logo });
    this.themeName.set(theme.meta.name ?? '');
    this.tagline.set(theme.meta.tagline ?? '');
    this.favicon.set(theme.meta.favicon ?? '');
    const loader = meta['loader'];
    this.loaderForm.set({
      ...DEFAULT_LOADER_CONFIG,
      ...(loader && typeof loader === 'object' ? (loader as Partial<ThemeLoaderConfig>) : {}),
    });
  }

  // ── Panel lateral de la vista previa (bajo 1024px) ──

  /** Escape cierra el panel lateral, salvo que la confirmación esté abierta encima (ese Escape es suyo). */
  protected closePreviewPanel(): void {
    if (this.previewOpenMobile() && !this.showApplyConfirm()) {
      this.previewOpenMobile.set(false);
    }
  }

  // ── Edición ──

  protected setField<K extends keyof ThemeStudioForm>(key: K, value: ThemeStudioForm[K]): void {
    this.form.update(form => ({ ...form, [key]: value }));
  }

  protected setChoice(key: SharedSegmentKey, value: string | number): void {
    this.form.update(form => ({ ...form, [key]: value }) as ThemeStudioForm);
  }

  protected setModeColor(key: StudioModeColorKey, value: string): void {
    const mode = this.activeMode();
    this.form.update(form => ({ ...form, [mode]: { ...form[mode], [key]: value } }));
  }

  protected setModeChoice(key: ModeSegmentKey, value: string | number): void {
    const mode = this.activeMode();
    this.form.update(form => ({ ...form, [mode]: { ...form[mode], [key]: value } as ThemeStudioModeForm }));
  }

  protected setBrandField<K extends keyof ThemeLogo>(key: K, value: ThemeLogo[K]): void {
    this.brandForm.update(brand => ({ ...brand, [key]: value }));
  }

  protected setLoaderChoice(key: 'presentation' | 'animation', value: string | number): void {
    this.loaderForm.update(loader => ({ ...loader, [key]: value }) as ThemeLoaderConfig);
  }

  protected onModeHexChange(key: StudioModeColorKey, event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value.trim().toUpperCase();
    const normalized = value.startsWith('#') ? value : `#${value}`;
    if (HEX_COLOR_PATTERN.test(normalized)) {
      this.setModeColor(key, normalized);
    } else {
      this.emitNotice('warning', 'alerts.invalidHex');
      target.value = this.modeForm()[key];
    }
  }

  protected toggleMode(): void {
    this.activeMode.update(mode => (mode === 'light' ? 'dark' : 'light'));
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected numberValue(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  protected fontStackFor(family: string): string {
    return `'${family}', ${SERIF_DISPLAY_FONTS.has(family) ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
  }

  // ── Imágenes (logo, logo oscuro, favicon, imagen del indicador de carga) ──

  /** URL SANITIZADA de una imagen (para la miniatura); `null` sin imagen segura. */
  protected imageUrl(target: ImageTarget): string | null {
    const brand = this.brandForm();
    const raw =
      target === 'logo'
        ? brand.url
        : target === 'logoDark'
          ? brand.urlDark
          : target === 'favicon'
            ? this.favicon()
            : this.loaderForm().image;
    return sanitizeAssetUrl(raw);
  }

  protected onImageSelected(target: ImageTarget, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Limpia la selección para que volver a elegir el MISMO archivo dispare `change`.
    input.value = '';
    this.uploadImage(target, file);
  }

  /** Valida y sube una imagen con `store.uploadLogo`; la URL devuelta queda en el campo destino. */
  uploadImage(target: ImageTarget, file: File | undefined): void {
    const upload = this.store?.uploadLogo?.bind(this.store);
    if (!file || !upload) return;
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      this.emitNotice('warning', 'brand.sizeError');
      return;
    }
    this.setUploading(target, true);
    upload(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: url => {
          this.setUploading(target, false);
          this.setImage(target, url);
          this.emitNotice('success', 'brand.uploaded');
        },
        error: (error: unknown) => {
          this.setUploading(target, false);
          this.emitNotice('error', 'brand.uploadError', undefined, extractStoreErrorMessage(error));
        },
      });
  }

  private setUploading(target: ImageTarget, active: boolean): void {
    if (target === 'favicon') this.uploadingFavicon.set(active);
    else if (target === 'loaderImage') this.uploadingLoaderImage.set(active);
    else this.uploadingLogo.set(active ? target : null);
  }

  protected removeImage(target: ImageTarget): void {
    this.setImage(target, target === 'logoDark' ? undefined : '');
  }

  private setImage(target: ImageTarget, url: string | undefined): void {
    if (target === 'favicon') this.favicon.set(url ?? '');
    else if (target === 'loaderImage') this.loaderForm.update(loader => ({ ...loader, image: url ?? '' }));
    else if (target === 'logoDark') this.setBrandField('urlDark', url || undefined);
    else this.setBrandField('url', url ?? '');
  }

  // ── Aplicar ──

  protected requestApply(): void {
    if (this.busy()) return;
    if (!isRenderableTheme(this.effectiveTheme())) {
      this.emitNotice('error', 'alerts.invalidTheme');
      return;
    }
    this.showApplyConfirm.set(true);
  }

  /**
   * Persiste el tema en edición con `store.apply(...)`. Con el tema persistido lo empuja con
   * `ThemeService.setTenantTheme` (sin volver a pedirlo); sin él, `ThemeService.refresh()`.
   */
  confirmApply(): void {
    const store = this.store;
    if (!store || this.busy()) return;
    const theme = this.effectiveTheme();
    // Guarda final: nunca se envía un tema que no resuelva en ambos modos.
    if (!isRenderableTheme(theme)) {
      this.showApplyConfirm.set(false);
      this.emitNotice('error', 'alerts.invalidTheme');
      return;
    }
    this.applying.set(true);
    store
      .apply(theme, this.selectedVersion())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.applying.set(false);
          this.showApplyConfirm.set(false);
          const persisted = isThemeFileLike(result) ? result : null;
          // Lo persistido puede diferir de lo enviado: uno irresoluble haría caer el shell al
          // tema por defecto en silencio, así que se avisa en vez de empujarlo.
          if (persisted && !isRenderableTheme(persisted)) {
            this.emitNotice('error', 'alerts.applyError');
            return;
          }
          this.emitNotice('success', 'alerts.applied');
          const appliedTheme = persisted ?? theme;
          // El borrador importado (o la versión restaurada) se conserva: sus tokens no editados
          // siguen viajando intactos en lo que se exporte o se vuelva a aplicar.
          this.savedTheme.set(appliedTheme);
          if (persisted) this.themeService.setTenantTheme(persisted);
          else this.themeService.refresh();
          this.selectedVersion.set(null);
          if (this.historyOpen()) this.loadHistory();
          if (this.feature().persistDefaultModeOnApply) {
            const appliedMode = this.form().defaultMode;
            this.themeService.setDarkMode(appliedMode === 'dark');
            this.activeMode.set(appliedMode);
          } else {
            this.activeMode.set(appliedTheme.meta.defaultMode ?? this.activeMode());
          }
          this.applied.emit(appliedTheme);
        },
        error: (error: unknown) => {
          this.applying.set(false);
          this.showApplyConfirm.set(false);
          this.emitNotice('error', 'alerts.applyError', undefined, extractStoreErrorMessage(error));
        },
      });
  }

  // ── Historial ──

  protected toggleHistory(): void {
    this.historyOpen.update(open => !open);
    if (this.historyOpen()) this.loadHistory();
  }

  /** Primera página (o la siguiente con `more`). */
  loadHistory(more = false): void {
    const list = this.store?.listVersions?.bind(this.store);
    if (!list || this.historyLoading()) return;
    this.historyLoading.set(true);
    this.historyError.set(null);
    list(more ? this.nextCursor() : null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.versions.set(more ? [...this.versions(), ...page.versions] : page.versions);
          this.nextCursor.set(page.next);
          this.historyLoading.set(false);
        },
        error: (error: unknown) => {
          this.historyError.set(this.storeError(error, 'history.error'));
          this.historyLoading.set(false);
        },
      });
  }

  /** Fecha del historial en el idioma activo, con la zona horaria configurada. */
  protected versionDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const timeZone = this.versionTimeZone();
    const label = this.versionTimeZoneLabel();
    let text: string;
    try {
      text = new Intl.DateTimeFormat(this.i18n.activeLang(), {
        dateStyle: 'medium',
        timeStyle: 'medium',
        ...(timeZone ? { timeZone } : {}),
      }).format(date);
    } catch {
      text = date.toISOString();
    }
    return label ? `${text} ${label}` : text;
  }

  /** Carga una versión del historial en el borrador (no la guarda: hay que confirmar Aplicar). */
  previewVersion(id: ThemeVersion['id']): void {
    const getVersion = this.store?.getVersion?.bind(this.store);
    if (!getVersion || this.busy()) return;
    this.versionLoading.set(true);
    this.historyError.set(null);
    getVersion(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: theme => {
          try {
            this.loadDraft(parseThemeJson(JSON.stringify(theme), this.effectiveTheme(), this.parseOptions()));
            this.selectedVersion.set(id);
            this.previewOpenMobile.set(true);
            this.status.set({ key: 'history.versionLoaded', params: { id } });
          } catch (error) {
            this.historyError.set(
              error instanceof ThemeImportError ? this.importError(error) : { key: 'history.versionInvalid' },
            );
          } finally {
            this.versionLoading.set(false);
          }
        },
        error: (error: unknown) => {
          this.historyError.set(this.storeError(error, 'history.versionError'));
          this.versionLoading.set(false);
        },
      });
  }

  // ── JSON ──

  protected importJson(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    return this.importFile(file);
  }

  /** Valida un archivo JSON y, si es válido, lo carga en el borrador (no lo guarda). */
  async importFile(file: File | undefined): Promise<void> {
    if (!file || this.busy()) return;
    this.importing.set(true);
    try {
      if (file.size > MAX_THEME_JSON_BYTES) throw new ThemeImportError('too-large');
      const text = await file.text();
      this.loadDraft(parseThemeJson(text, this.effectiveTheme(), this.parseOptions()));
      this.selectedVersion.set(null);
      this.previewOpenMobile.set(true);
      this.status.set({ key: 'import.loaded' });
    } catch (error) {
      this.status.set(error instanceof ThemeImportError ? this.importError(error) : { key: 'import.readError' });
    } finally {
      this.importing.set(false);
    }
  }

  private parseOptions(): ParseThemeJsonOptions {
    const feature = this.feature();
    return {
      metaExtras: this.metaExtras(),
      metaExtrasSchema: feature.loginAppearance
        ? { login: LOGIN_META_SCHEMA, ...this.metaExtrasSchema() }
        : this.metaExtrasSchema(),
      loader: feature.loader,
      tableVariantMetaKey: feature.tableVariantMetaKey,
    };
  }

  /** Texto de un error del importador; la ruta solo se muestra cuando señala el campo a corregir. */
  private importError(error: ThemeImportError): StatusMessage {
    const at = error.pathVisible && error.path ? this.t('import.error.at', { path: error.path }) : '';
    return { key: `import.error.${error.code}`, params: { at } };
  }

  /** Mensaje del store (p. ej. el del backend) o, sin él, el texto por defecto. */
  private storeError(error: unknown, fallbackKey: string): StatusMessage {
    const message = extractStoreErrorMessage(error);
    return message ? { text: message } : { key: fallbackKey };
  }

  /** Borrador desde un tema externo: hidrata los controles y conserva sus tokens no editados. */
  private loadDraft(theme: ThemeFile): void {
    this.hydrateFrom(theme);
    this.importedGenerated = null;
    this.importedTheme.set(theme);
    this.importedGenerated = this.effectiveTheme();
    this.importedTheme.set({ ...theme });
  }

  protected exportJson(): void {
    const theme = this.effectiveTheme();
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      this.exportFileName() ?? `${(theme.meta.tenant || 'theme').replace(/[^a-z0-9_-]/gi, '-')}-theme.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.status.set({ key: 'import.exported' });
  }

  protected copyJson(): void {
    const theme = this.effectiveTheme();
    if (!isRenderableTheme(theme)) {
      this.emitNotice('error', 'alerts.invalidTheme');
      return;
    }
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) {
      this.emitNotice('warning', 'alerts.copyError');
      return;
    }
    clipboard.writeText(JSON.stringify(theme, null, 2)).then(
      () => this.emitNotice('success', 'alerts.copied'),
      () => this.emitNotice('warning', 'alerts.copyError'),
    );
  }

  // ── Divisor arrastrable (escritorio) ──

  /**
   * Inicia el arrastre del divisor. Captura el puntero sobre el propio divisor, así los
   * `pointermove`/`pointerup` llegan aunque el cursor se salga; el reparto se calcula contra el
   * rectángulo del grid medido al empezar.
   */
  protected startResize(event: PointerEvent): void {
    const grid = this.gridContainer()?.nativeElement;
    const divider = event.currentTarget;
    if (!grid || !(divider instanceof HTMLElement) || event.button !== 0) return;
    const rect = grid.getBoundingClientRect();
    if (rect.width === 0) return;
    event.preventDefault();
    try {
      divider.setPointerCapture(event.pointerId);
    } catch {
      // Puntero ya inactivo: se sigue sin captura.
    }
    this.resizing.set(true);
    const onMove = (move: PointerEvent): void => {
      this.studioSplit.set(clampSplit(((move.clientX - rect.left) / rect.width) * 100));
    };
    const onEnd = (): void => {
      divider.removeEventListener('pointermove', onMove);
      divider.removeEventListener('pointerup', onEnd);
      divider.removeEventListener('pointercancel', onEnd);
      this.resizing.set(false);
      this.persistSplit();
    };
    divider.addEventListener('pointermove', onMove);
    divider.addEventListener('pointerup', onEnd);
    divider.addEventListener('pointercancel', onEnd);
  }

  /** Teclado sobre el divisor: flechas mueven de a 2 puntos; Inicio/Fin van a los topes. */
  protected onDividerKeydown(event: KeyboardEvent): void {
    const next =
      event.key === 'ArrowLeft'
        ? this.studioSplit() - SPLIT_STEP
        : event.key === 'ArrowRight'
          ? this.studioSplit() + SPLIT_STEP
          : event.key === 'Home'
            ? SPLIT_MIN
            : event.key === 'End'
              ? SPLIT_MAX
              : null;
    if (next === null) return;
    event.preventDefault();
    this.studioSplit.set(clampSplit(next));
    this.persistSplit();
  }

  /** Doble clic sobre el divisor: vuelve al reparto por defecto. */
  protected resetSplit(): void {
    this.studioSplit.set(SPLIT_DEFAULT);
    this.persistSplit();
  }

  private persistSplit(): void {
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(this.studioSplit()));
    } catch {
      // Sin almacenamiento: la preferencia dura lo que dure la página.
    }
  }

  // ── Utilidades ──

  /** Resuelve un texto de estado (clave traducible o texto ya resuelto). */
  protected text(message: StatusMessage): string {
    return 'text' in message ? message.text : this.t(message.key, message.params);
  }

  /** Texto de la línea de estado del JSON (vacía sin estado). */
  protected statusText(): string {
    const current = this.status();
    return current ? this.text(current) : '';
  }

  private emitNotice(
    kind: SolThemeStudioNotice['kind'],
    key: string,
    params?: Record<string, unknown>,
    message?: string | null,
  ): void {
    this.notify.emit({ kind, messageKey: `sol.themeStudio.${key}`, message: message || this.t(key, params) });
  }

  /** Carga el catálogo curado de fuentes con la URL sanitizada por construcción (`buildGoogleFontsUrl`). */
  private injectStudioFonts(): void {
    if (typeof document === 'undefined' || document.head.querySelector('link[data-sol-studio-fonts]')) return;
    const fonts: ThemeFont[] = [
      ...STUDIO_DISPLAY_FONTS.map(family => ({ family, provider: 'google' as const, weights: [600, 700] })),
      ...STUDIO_BODY_FONTS.map(family => ({ family, provider: 'google' as const, weights: [400, 500] })),
    ];
    const href = buildGoogleFontsUrl(fonts);
    if (href === null) return;
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('data-sol-studio-fonts', '');
    link.setAttribute('href', href);
    document.head.appendChild(link);
  }
}

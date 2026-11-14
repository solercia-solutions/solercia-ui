/*
 * Public API Surface of @solercia/ui/theme-studio
 *
 * Secondary entry point: apps that do not use the Theme Studio never load it.
 */

// Store contract (persistence port implemented by the host).
export { THEME_STUDIO_STORE, extractStoreErrorMessage } from './src/store/theme-studio-store';
export type { ThemeStudioStore, ThemeVersion, ThemeVersionPage } from './src/store/theme-studio-store';

// Screen: <sol-theme-studio> and its isolated preview.
export { SolThemeStudioComponent } from './src/ui/theme-studio.component';
export type { SolThemeStudioNotice, SolThemeStudioFeatures } from './src/ui/theme-studio.component';
export { SolThemeStudioPreviewComponent } from './src/ui/theme-studio-preview.component';

// Default texts (es-CO and en) for hosts that merge them into their i18n engine.
export {
  SOL_THEME_STUDIO_I18N_ES_CO,
  SOL_THEME_STUDIO_I18N_EN,
  THEME_STUDIO_I18N_PREFIX,
} from './src/i18n/theme-studio.i18n';
export type { ThemeStudioDictionary } from './src/i18n/theme-studio.i18n';

// Headless core (pure functions, no Angular injection).
export { buildThemeFile, mapThemeFileToForm } from './src/lib/theme-builder';
export { deepMerge } from './src/lib/deep-merge';
export type { DeepPartial } from './src/lib/deep-merge';
export {
  parseThemeJson,
  mergeThemeEditorChanges,
  ThemeImportError,
  MAX_THEME_JSON_BYTES,
} from './src/lib/theme-json-file';
export type { ThemeImportErrorCode, ParseThemeJsonOptions } from './src/lib/theme-json-file';

// Form model.
export {
  BASE_SIZE_MAX,
  BASE_SIZE_MIN,
  DEFAULT_DARK_MODE_FORM,
  DEFAULT_LOADER_CONFIG,
  DEFAULT_LIGHT_MODE_FORM,
  DEFAULT_STUDIO_FORM,
  DEFAULT_TABLE_VARIANT,
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
} from './src/model/theme-studio-form.model';
export type {
  StudioAuthLayout,
  StudioBorderWidth,
  StudioButtonShape,
  StudioColorFieldKey,
  StudioDensity,
  StudioDisplayTransform,
  StudioDisplayWeight,
  StudioHeaderStyle,
  StudioInputStyle,
  StudioLoaderAnimation,
  StudioLoaderPresentation,
  StudioModeColorKey,
  StudioMotionDuration,
  StudioMotionIntensity,
  StudioOverlayBlur,
  StudioRevealStyle,
  StudioShadowDirection,
  StudioShadowSize,
  StudioShadowStyle,
  StudioSidebarStyle,
  StudioTexture,
  ThemeLoaderConfig,
  ThemeStudioForm,
  ThemeStudioModeForm,
} from './src/model/theme-studio-form.model';

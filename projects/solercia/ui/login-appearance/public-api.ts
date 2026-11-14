/*
 * Public API Surface of @solercia/ui/login-appearance
 *
 * Secondary entry point: the themed sign-in frame driven by `meta.login`. It ships no auth logic
 * and makes no HTTP call; the host projects its own form inside `<sol-login-frame>`.
 */

// Contract of `meta.login` and its bounds.
export {
  LOGIN_BACKGROUNDS,
  LOGIN_CAPTION_POSITIONS,
  LOGIN_DEFAULT_BACKGROUND,
  LOGIN_DEFAULT_EFFECT,
  LOGIN_DEFAULT_POSITION,
  LOGIN_DEFAULT_TRANSITION,
  LOGIN_EFFECTS,
  LOGIN_INTERVAL_DEFAULT_MS,
  LOGIN_INTERVAL_MAX_MS,
  LOGIN_INTERVAL_MIN_MS,
  LOGIN_MAX_IMAGES,
  LOGIN_META_SCHEMA,
  LOGIN_POSITIONS,
  LOGIN_SHAPE_BACKGROUNDS,
  LOGIN_TRANSITIONS,
  hasLoginShapes,
} from './src/model/login-appearance.model';
export type {
  LoginBackground,
  LoginCaptionPosition,
  LoginEffect,
  LoginLogo,
  LoginMode,
  LoginPosition,
  LoginTransition,
  LoginView,
  PublishedLoginAppearance,
  ThemeLogin,
  ThemeLoginCaption,
  ThemeLoginModeConfig,
  ThemeLoginPanel,
  ThemeLoginVeil,
} from './src/model/login-appearance.model';

// Headless core (pure functions, no Angular injection).
export {
  buildLoginView,
  isAllowedLoginImage,
  normalizeLogin,
  normalizeLoginAppearance,
  resolveLoginView,
} from './src/lib/normalize-login';
export type { LoginAppearanceSources } from './src/lib/normalize-login';

// Presentational pieces.
export { SolLoginFrameComponent } from './src/ui/login-frame.component';
export { SolLoginSceneComponent } from './src/ui/login-scene.component';
export { SolLoginPhotosComponent } from './src/ui/login-photos.component';
export { SolLoginShapesComponent } from './src/ui/login-shapes.component';
export { SolLoginPanelBackgroundComponent } from './src/ui/login-panel-background.component';
export { SolLoginBrandComponent } from './src/ui/login-brand.component';
export type { LoginBrandLogo } from './src/ui/login-brand.component';
export { SolLoginPreviewComponent } from './src/ui/login-preview.component';

// Editor (mounted by `sol-theme-studio` with `features.loginAppearance`).
export { SolLoginAppearanceEditorComponent } from './src/ui/login-appearance-editor.component';
export type { LoginPhotoUploader } from './src/ui/login-appearance-editor.component';

// Default texts (es-CO and en) for hosts that merge them into their i18n engine.
export {
  LOGIN_APPEARANCE_I18N_PREFIX,
  SOL_LOGIN_APPEARANCE_I18N_EN,
  SOL_LOGIN_APPEARANCE_I18N_ES_CO,
} from './src/i18n/login-appearance.i18n';
export type { LoginAppearanceDictionary } from './src/i18n/login-appearance.i18n';

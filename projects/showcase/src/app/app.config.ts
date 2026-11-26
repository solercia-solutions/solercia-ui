import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { SOL_I18N, THEME_SOURCE, provideTheme } from '@solercia/ui';
import { routes } from './app.routes';
import { ShowcaseI18nService } from './i18n/showcase-i18n.service';
import { ShowcaseThemeSource } from './theme/showcase-theme-source';

/**
 * Reference integration of @solercia/ui:
 * - provideTheme() boots ThemeService, which writes the --sol-* tokens on :root.
 * - THEME_SOURCE is the host port that loads a tenant ThemeFile; with no
 *   SOL_TENANT_RESOLVER the bundled default theme ("Vértice") is used.
 * - SOL_I18N binds the host translation engine (English catalog by default).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideTheme(),
    { provide: THEME_SOURCE, useExisting: ShowcaseThemeSource },
    { provide: SOL_I18N, useExisting: ShowcaseI18nService },
  ],
};

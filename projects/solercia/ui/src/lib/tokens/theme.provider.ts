import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { ThemeService } from './theme.service';

/**
 * Registers the theming runtime. Instantiating ThemeService eagerly starts its
 * effects: it applies {@link SOL_DEFAULT_THEME} immediately and, if the host
 * wired SOL_TENANT_RESOLVER + THEME_SOURCE, begins reacting to tenant changes.
 *
 * The default theme is bundled in the library (no asset fetch required), so a
 * host that provides nothing still renders with a valid theme.
 */
export function provideTheme(): EnvironmentProviders {
  return provideAppInitializer(() => {
    inject(ThemeService);
  });
}

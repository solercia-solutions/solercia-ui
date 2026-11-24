import { Injectable } from '@angular/core';
import type { ThemeFile, ThemeSource } from '@solercia/ui';

/**
 * THEME_SOURCE adapter. A multi-tenant host fetches the tenant ThemeFile here
 * (HTTP, storage…). Returning null keeps SOL_DEFAULT_THEME, the bundled theme.
 */
@Injectable({ providedIn: 'root' })
export class ShowcaseThemeSource implements ThemeSource {
  async loadTheme(_tenantId: number | string): Promise<ThemeFile | null> {
    return null;
  }
}

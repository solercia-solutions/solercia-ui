import { InjectionToken } from '@angular/core';
import type { ThemeFile } from './theme.model';
import defaultTheme from './themes/default.theme.json';

/**
 * Host-provided contract for resolving the active tenant. The design system is
 * agnostic of how the host identifies tenants; the host application wires its
 * own resolver. When absent, ThemeService behaves as single-theme (default only).
 */
export interface SolTenantResolver {
  /** Active tenant/company id, or null pre-login / on logout. */
  activeTenantId(): number | null;
}

export const SOL_TENANT_RESOLVER = new InjectionToken<SolTenantResolver>('SOL_TENANT_RESOLVER');

/**
 * Host-provided PORT for loading a tenant's theme. This is what keeps the
 * library agnostic: the library asks "give me the theme for this tenant" and
 * does NOT know whether it comes from an HTTP API, a file, localStorage, or a
 * mock. The host supplies the adapter (e.g. an API client).
 *
 * Defaults to a null-object that returns `null` (no tenant theme), so the
 * library works out of the box and falls back to {@link SOL_DEFAULT_THEME}.
 */
export interface ThemeSource {
  /**
   * Resolve the theme for a tenant. Return `null` to fall back to the default.
   * How the theme is fetched is entirely the host's concern.
   */
  loadTheme(tenantId: number | string): Promise<ThemeFile | null>;
}

export const THEME_SOURCE = new InjectionToken<ThemeSource>('THEME_SOURCE', {
  providedIn: 'root',
  // Null-object: no host adapter → no tenant theme → default is used.
  factory: (): ThemeSource => ({ async loadTheme() { return null; } }),
});

/**
 * The bundled "Vértice" ThemeFile as a plain constant (0.6.0). It is the
 * factory value of `SOL_DEFAULT_THEME` and the default base theme of the
 * headless Theme Studio builder (`@solercia/ui/theme-studio`). Treat it as
 * read-only: clone it before mutating.
 */
export const SOL_BUNDLED_DEFAULT_THEME: ThemeFile = defaultTheme as unknown as ThemeFile;

/**
 * The theme the library ships with and applies when there is no tenant theme.
 * Defaults to the bundled "Vértice" theme (a full ThemeFile that mirrors the
 * `jsonb` stored per company in the database). The host may override it with
 * its own brand default:
 *
 *   { provide: SOL_DEFAULT_THEME, useValue: myBrandTheme }
 */
export const SOL_DEFAULT_THEME = new InjectionToken<ThemeFile>('SOL_DEFAULT_THEME', {
  providedIn: 'root',
  factory: (): ThemeFile => SOL_BUNDLED_DEFAULT_THEME,
});

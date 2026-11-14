# Theme Studio — `@solercia/ui/theme-studio`

A **secondary entry point** with a full visual theme editor (`<sol-theme-studio>`) and the
headless core behind it. Apps that never import `@solercia/ui/theme-studio` do not load it.

```ts
import {
  SolThemeStudioComponent,
  THEME_STUDIO_STORE,
  type ThemeStudioStore,
} from '@solercia/ui/theme-studio';
```

The studio is **backend-agnostic**: it never calls HTTP. The host implements one port,
`ThemeStudioStore`, and provides it with `THEME_STUDIO_STORE` — the same pattern as
`THEME_SOURCE` in [`THEMING.md`](./THEMING.md).

---

## 1. The store contract

```ts
export interface ThemeVersion {
  id: number | string;
  userName: string | null;
  userId: number | string | null;
  appliedAt: string;                         // ISO 8601, UTC
  initialCapture: boolean;                   // capture of the theme that existed before the first save
  sourceVersionId: number | string | null;   // base version of a restore
}

export interface ThemeVersionPage {
  versions: ThemeVersion[];                  // newest first
  next: number | string | null;              // cursor of the next page, null when there are no more
}

export interface ThemeStudioStore {
  load(): Observable<ThemeFile | null>;      // null = no saved theme yet (the base theme is used)
  apply(theme: ThemeFile, sourceVersionId?: ThemeVersion['id'] | null): Observable<ThemeVersion | ThemeFile | void>;
  listVersions?(before?: ThemeVersionPage['next']): Observable<ThemeVersionPage>;
  getVersion?(id: ThemeVersion['id']): Observable<ThemeFile>;
  uploadLogo?(file: File): Observable<string>; // returns the published URL
}

export const THEME_STUDIO_STORE = new InjectionToken<ThemeStudioStore>('THEME_STUDIO_STORE');
```

| Method | Required | Used for | Without it |
|---|---|---|---|
| `load` | yes | Initial state of the editor. | — |
| `apply` | yes | "Apply theme" (after confirmation). `sourceVersionId` is the restored version the change is based on, or `null`. Since 0.6.1 it may emit the theme **as persisted**: the studio then pushes it with `ThemeService.setTenantTheme` (no re-fetch); a persisted theme that is not renderable is reported as an error and not pushed. Emitting a `ThemeVersion` or nothing keeps the 0.6.0 behavior (`ThemeService.refresh()`). | — |
| `listVersions` + `getVersion` | no (both) | "Previous versions": paginated history and restore. | The history section is hidden. |
| `uploadLogo` | no | Light logo, dark logo and favicon uploads. | Upload buttons are hidden; a hint explains it. |

The `ThemeFile` itself carries **no version field**: versioning lives in the host backend. Each
app maps its own API shape in its adapter.

Without any `THEME_STUDIO_STORE` provider the component renders a configuration error instead
of the editor.

**Error messages.** When a store call fails, the studio shows the server message if the error
carries one, exactly like an `HttpErrorResponse` body: `error.message` or
`error.errors[0].message` (or a plain `{ userMessage }`). Otherwise it shows its own default
text. Adapters can simply let `HttpErrorResponse` through. The same rule is exported as
`extractStoreErrorMessage(error)`.

---

## 2. Adapter example

A host whose API returns Spanish field names (the PANDORA shape) maps them in the adapter:

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { ThemeFile } from '@solercia/ui';
import type { ThemeStudioStore, ThemeVersion, ThemeVersionPage } from '@solercia/ui/theme-studio';

interface ApiVersion {
  id: number;
  usuario: string | null;
  usuario_id: number | null;
  fecha: string;
  captura_inicial: boolean;
  version_origen: number | null;
}

const toVersion = (v: ApiVersion): ThemeVersion => ({
  id: v.id,
  userName: v.usuario,
  userId: v.usuario_id,
  appliedAt: v.fecha,
  initialCapture: v.captura_inicial,
  sourceVersionId: v.version_origen,
});

@Injectable({ providedIn: 'root' })
export class EntityThemeStudioStore implements ThemeStudioStore {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/admin/v1/entidad/tema';

  load(): Observable<ThemeFile | null> {
    return this.http.get<{ data: { tema: ThemeFile | null } }>(this.base).pipe(map(r => r.data.tema));
  }

  /** Emits the theme as persisted, so the studio pushes it with `setTenantTheme`. */
  apply(theme: ThemeFile, sourceVersionId: ThemeVersion['id'] | null = null): Observable<ThemeFile> {
    return this.http
      .put<{ data: { tema: ThemeFile } }>(this.base, { tema: theme, version_origen: sourceVersionId })
      .pipe(map(r => r.data.tema));
  }

  listVersions(before: ThemeVersionPage['next'] = null): Observable<ThemeVersionPage> {
    const query = before ? `?antes=${encodeURIComponent(String(before))}` : '';
    return this.http
      .get<{ data: { versiones: ApiVersion[]; siguiente: number | null } }>(`${this.base}/versiones${query}`)
      .pipe(map(r => ({ versions: r.data.versiones.map(toVersion), next: r.data.siguiente })));
  }

  getVersion(id: ThemeVersion['id']): Observable<ThemeFile> {
    return this.http
      .get<{ data: { tema: ThemeFile } }>(`${this.base}/versiones/${encodeURIComponent(String(id))}`)
      .pipe(map(r => r.data.tema));
  }

  uploadLogo(file: File): Observable<string> {
    const body = new FormData();
    body.append('logo', file); // never set Content-Type by hand: HttpClient adds the boundary
    return this.http.post<{ data: { url: string } }>(`${this.base}/logo`, body).pipe(map(r => r.data.url));
  }
}
```

Wiring (route-level provider, so only the studio route carries it):

```ts
{
  path: 'theme-studio',
  loadComponent: () => import('@solercia/ui/theme-studio').then(m => m.SolThemeStudioComponent),
  providers: [{ provide: THEME_STUDIO_STORE, useExisting: EntityThemeStudioStore }],
}
```

---

## 3. `<sol-theme-studio>`

```html
<sol-theme-studio
  [baseTheme]="myBrandDefault"
  [metaExtras]="{ loader: { image: '', presentation: 'current', animation: 'spin' } }"
  (applied)="onApplied($event)"
  (notify)="toast($event)"
/>
```

| Member | Type | Notes |
|---|---|---|
| `baseTheme` | `input<ThemeFile \| undefined>` | Starting point when `load()` returns `null`. Default: `SOL_DEFAULT_THEME`. |
| `metaExtras` | `input<Record<string, unknown> \| undefined>` | Opaque host fields copied **as is** into `meta` (e.g. legacy-bridge settings). They are also accepted, with the same shape, when importing JSON. They cannot override the studio-owned `meta.fonts` / `meta.defaultMode`. |
| `metaExtrasSchema` | `input<Record<string, unknown> \| undefined>` | 0.6.1. Shape of opaque `meta` fields the host **preserves but never writes** (e.g. `{ sidebar: { autoCloseOnNavigate: true } }`). Only widens what JSON import accepts; values travel untouched from the base theme. |
| `features` | `input<SolThemeStudioFeatures>` | 0.6.1. Optional sections and behaviors, see 3.1. |
| `footerPlaceholder` | `input<string \| undefined>` | 0.6.1. Placeholder of the footer text input (e.g. the default format of the host footer). Default: `sol.themeStudio.footer.placeholder`. |
| `exportFileName` | `input<string \| undefined>` | 0.6.1. File name of "Export JSON". Default: `<tenant>-theme.json`. |
| `versionTimeZone` | `input<string \| undefined>` | 0.6.1. IANA time zone of the history dates (e.g. `America/Bogota`). Default: the browser's. Dates use `dateStyle` and `timeStyle` `medium` in the active language. |
| `versionTimeZoneLabel` | `input<string \| undefined>` | 0.6.1. Text after every history date (e.g. `(Bogotá)`). |
| `applied` | `output<ThemeFile>` | The theme `store.apply(...)` accepted (the persisted one when the store emits it). |
| `notify` | `output<SolThemeStudioNotice>` | `{ kind: 'success' \| 'error' \| 'warning' \| 'info'; messageKey; message }`. `message` is already resolved in the active language, or is the server message when the store error carries one; `messageKey` is the full `sol.themeStudio.*` key if the host prefers its own copy. The app decides how to show it (toast, banner…). `warning` (0.6.1) covers recoverable input problems: image over 2 MB, invalid hex, clipboard unavailable. |

After a successful apply the component pushes the persisted theme with
`ThemeService.setTenantTheme` when the store emits it, or calls `ThemeService.refresh()`
otherwise (re-load through `THEME_SOURCE`, see [`THEMING.md`](./THEMING.md)). A draft that came
from a JSON import or a restored version stays as the base of the editor after applying, so its
untouched tokens keep travelling in later exports and applies.

Import results, version previews and exports are reported in the status line under the preview
actions (not through `notify`), like the original screen.

### 3.1 Optional features (`SolThemeStudioFeatures`)

| Feature | Default | Effect |
|---|---|---|
| `themeName` | `true` | "Theme name" field (`meta.name`) in the Brand card. |
| `loader` | `false` | "Loader / spinner" card: image (upload), presentation (`current` \| `centered` \| `backdrop`) and animation (`spin` \| `pulse` \| `shake` \| `none`), stored in `meta.loader` (`ThemeLoaderConfig`), plus its sample in the preview. Import validates both enums. |
| `tableVariantMetaKey` | — | Also reads and writes the table variant at `meta[key]` (it wins over `component.table.variant` when hydrating; import validates it against `SOL_TABLE_VARIANTS`). `component.table.variant` keeps being written. |
| `persistDefaultModeOnApply` | `false` | After applying, `ThemeService.setDarkMode(meta.defaultMode === 'dark')` makes the chosen default mode the explicit preference of this browser, so nobody stays stuck in an old mode. |

Layout hook: `--sol-theme-studio-bottom-inset` (CSS custom property, default `0px`) is subtracted
from the sticky preview card height, for shells with a fixed footer.

### 3.2 PANDORA-equivalent configuration

PANDORA's original screen is reproduced exactly (same markup, styles, texts and behavior; the
equivalence harness compared 88 screenshot pairs at 1440×900 and 390×844 in light and dark with
0 different pixels, and the same store calls and payloads in a full journey) with:

```html
<sol-theme-studio
  [features]="{ themeName: false, loader: true, tableVariantMetaKey: 'tableStyle', persistDefaultModeOnApply: true }"
  [metaExtrasSchema]="{ themeName: '', sidebar: { autoCloseOnNavigate: true } }"
  [footerPlaceholder]="year + ' © Hecho con ❤ en ' + entity.nombreCorto + ' | Pandora'"
  exportFileName="pandora-tema.json"
  versionTimeZone="America/Bogota"
  versionTimeZoneLabel="(Bogotá)"
  (notify)="toAlertService($event)"
/>
```

plus, in the host:

- the store adapter of section 2 (with `apply` emitting the persisted theme);
- `:root { --sol-theme-studio-bottom-inset: var(--pandora-footer-h, 0px); }` for the fixed footer;
- three host-specific texts under `sol.themeStudio` in the host i18n files:
  `preview.footerFallback` (`© Hecho con ❤ en tu entidad | Pandora`), `table.hint` (mentions legacy
  and Angular tables) and `loader.hint` (mentions the legacy loaders). Every other es-CO text is
  already PANDORA's.

Known differences, all deliberate:

- The payload additionally carries `modes.*.component.table.variant` when the base theme lacks
  it (the adapter may strip it; keeping it lets `sol-data-table` follow the theme natively).
- In dark mode the preview uses the dark logo (`meta.logo.urlDark`) when there is one; the
  original always showed the light logo.
- The studio waits for `store.load()` (loading, error-with-retry and "no saved theme" states),
  where the original read `ThemeService.activeTheme()`.

What the screen covers:

- **Shared controls** (both modes): brand (theme name, logo, dark logo, favicon, alt text, width),
  footer tagline, sign-in layout, default mode, table variant, typography, shape, density and
  borders, motion.
- **Per-mode controls** (light/dark tabs): colors, state roles, shadow (style, size, color,
  direction), background texture, sidebar and header.
- **Isolated preview**: CSS variables are set on the preview host, never on `:root`; the app keeps
  its real theme while editing.
- **History**: paginated list, preview of a version into the draft, and apply as a new version
  (`sourceVersionId` is sent to `store.apply`).
- **JSON**: export, copy, and import with validation **before** anything changes. Import and
  version previews only load the draft; nothing is saved until "Apply theme" is confirmed.
- **States**: loading, no saved theme (legitimate empty: the base theme is used), load error with
  retry, history empty / history error with retry, success notice after apply.

---

## 4. i18n

Every visible string goes through `SOL_I18N` with keys under `sol.themeStudio.*`. When the host
engine has no translation for a key, the component falls back to its own dictionaries:
**es-CO** (default, formal Colombian Spanish) or **en** when `activeLang()` starts with `en`.

Hosts that want to edit the copy can merge the exported trees into their engine:

```ts
import { SOL_THEME_STUDIO_I18N_ES_CO, SOL_THEME_STUDIO_I18N_EN } from '@solercia/ui/theme-studio';

// Transloco example: register them under sol.themeStudio
translocoService.setTranslation({ sol: { themeStudio: SOL_THEME_STUDIO_I18N_ES_CO } }, 'es-CO', { merge: true });
translocoService.setTranslation({ sol: { themeStudio: SOL_THEME_STUDIO_I18N_EN } }, 'en', { merge: true });
```

Import errors map to `sol.themeStudio.import.error.<code>` (see below), with the `{{at}}`
parameter built from `sol.themeStudio.import.error.at` when the path is visible.

The es-CO dictionary is the copy of PANDORA's original screen, except three texts kept generic
because they name a product or its legacy platform (`preview.footerFallback`, `table.hint`,
`loader.hint`). Note that the history and JSON status texts are formal (usted) in the original
and are copied as is.

---

## 5. Headless core

Pure functions, no Angular injection — usable from a CLI, a test or another UI.

| Export | Purpose |
|---|---|
| `buildThemeFile(form, baseTheme?, metaExtras?)` | Curated form → complete `ThemeFile` v2 (both modes). Deep-merges over `baseTheme` (default `SOL_BUNDLED_DEFAULT_THEME`) and only overwrites what the form controls; everything else survives. The result shares references with `baseTheme`: clone it before mutating. |
| `mapThemeFileToForm(theme, fallback?)` | Inverse mapping (best effort). Unresolvable themes return a copy of the fallback. |
| `deepMerge(base, patch)` | Typed deep merge used by the builder (arrays replace, `undefined` is ignored, `__proto__`/`constructor`/`prototype` are dropped). |
| `parseThemeJson(text, current, { metaExtras, metaExtrasSchema, loader, tableVariantMetaKey }?)` | Validates an imported file and returns the `ThemeFile`, or throws `ThemeImportError` (`code`, `path`, and `pathVisible` when the path names the exact field to fix: unknown or forbidden key, invalid extra brand color, non-hex contrast). The screen shows the path only in those cases. |
| `mergeThemeEditorChanges(original, before, after)` | Keeps imported tokens untouched unless their editor output changed. |
| `DEFAULT_STUDIO_FORM`, `STUDIO_*` catalogs, `ThemeStudioForm` types | Form model and curated suggestions. |

`ThemeImportError.code` (`ThemeImportErrorCode`):

| Code | Meaning |
|---|---|
| `too-large` | Larger than 256 KB (`MAX_THEME_JSON_BYTES`). |
| `invalid-json` | Not JSON. |
| `invalid-structure` | Missing `meta`/`primitives`/`modes`, wrong type, array over 40 items or nesting deeper than 20. |
| `unsupported-key` | A key the contract (or the current theme, or `metaExtras`) does not declare. |
| `unsafe-key` | `__proto__`, `prototype` or `constructor`. |
| `unsafe-value` | `url(`, `javascript:`, `@import`, `expression(`, markup, control characters, or an asset URL (`url`, `urlDark`, `favicon`, `image`) that is not `https://` or same-origin relative. |
| `invalid-value` | Out of domain: `defaultMode`, `table.variant`, `table.mobile`, non-hex `primaryContrast`/`secondaryContrast`, non-hex extra brand color, non-finite or huge numbers. |
| `not-renderable` | The theme does not resolve every variable in both modes (`isRenderableTheme`). |

---

## See also

- [`THEMING.md`](./THEMING.md) — the `ThemeFile` contract (`meta.name`, `meta.favicon`,
  `component.table.variant`, `semantic.color.primaryContrast`).
- [`I18N.md`](./I18N.md) — the `SOL_I18N` contract.

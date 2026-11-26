# Multitenant setup — `@solercia/ui`

How to stand up per-tenant white-label theming with `@solercia/ui`, for two
audiences:

- **(a) New project** bootstrapped from the Solercia starter — everything is
  already wired; this section is a verification checklist.
- **(b) Existing project** adopting `@solercia/ui` — the exact providers to add.

Read [`THEMING.md`](./THEMING.md) first for the port model and the three
degradation levels. This guide is the operational recipe.

---

## Mental model in one paragraph

The library owns the *mechanism* (resolve a `ThemeFile` into `--sol-*` CSS
variables, react to tenant changes, manage light/dark). The host owns the
*policy*: **who** the active tenant is (`SOL_TENANT_RESOLVER`) and **how** to
load its theme (`THEME_SOURCE`). Provide those two and you have per-tenant
theming. Provide neither and the app still runs on the bundled **Vértice**
default. Optionally, the host also provides its i18n engine (`SOL_I18N`) and can
override the default theme (`SOL_DEFAULT_THEME`).

| Provider | Required? | Effect if omitted |
|---|---|---|
| `provideTheme()` | **Yes** | No theming runtime at all — `:root` never gets `--sol-*` vars. |
| `SOL_TENANT_RESOLVER` | For multitenant | Single-theme mode: only the default is applied. |
| `THEME_SOURCE` | For multitenant | No tenant theme ever loads; default is used. |
| `SOL_I18N` | Optional | Identity default: keys render unchanged (components use built-in copy). |
| `SOL_DEFAULT_THEME` | Optional | Bundled **Vértice** theme is the default. |

---

## (a) New project — from the starter

The starter already contains all wiring. Verify it end to end:

1. **Confirm the providers exist** in `src/app/app.config.ts`:
   - `...provideTheme()`
   - `{ provide: SOL_TENANT_RESOLVER, useExisting: <YourResolver> }`
   - `{ provide: THEME_SOURCE, useExisting: <YourThemeSource> }`
   - `{ provide: SOL_I18N, useExisting: <YourI18nService> }` (optional)
2. **Confirm the last-resort net** exists in `styles.css`: a static
   `:root { --sol-*: … }` block (level 3). It only shows if even the default
   fails, but it must be present.
3. **Run it with no backend**: the app should render on **Vértice** (the bundled
   default) before login. If it does, level 2 works.
4. **Log in as a tenant** whose backend returns a theme: the UI should re-skin
   without a reload. If the theme endpoint 404s or the payload is invalid, the UI
   should silently stay on the default (check the console for the `ThemeService`
   warning). That confirms the degradation net.
5. **Toggle dark mode** (`ThemeService.toggleMode()`): the preference persists in
   `localStorage` (`sol-dark-mode`) independently of the tenant theme.

Nothing else to do — skip to [Verification checklist](#verification-checklist).

---

## (b) Existing project — adopting `@solercia/ui`

### Step 1 — Install and expose the package

Add `@solercia/ui` to the workspace (it is an Angular library built with
ng-packagr; consume it via a path mapping or a published package). Peer deps:
`@angular/common`, `@angular/core`, `@angular/forms` (^22), `rxjs` (^7.8),
`chart.js` (^4.5.1).

### Step 2 — Implement `SolTenantResolver` (WHO)

Point the library at your existing notion of "active tenant". If you already have
a signal-backed store (active company, subdomain, slug…), wrap it:

```ts
import { Injectable, inject } from '@angular/core';
import type { SolTenantResolver } from '@solercia/ui';
import { CompanyScopeStore } from '@app/state';   // your existing store

@Injectable({ providedIn: 'root' })
export class ActiveCompanyTenantResolver implements SolTenantResolver {
  private readonly scope = inject(CompanyScopeStore);

  activeTenantId(): number | null {
    return this.scope.activeCompanyId();   // read a signal → reactive
  }
}
```

`ThemeService` reads `activeTenantId()` inside an `effect`, so it must be
reactive (backed by a signal/computed). Return `null` pre-login and on logout to
fall back to the default.

### Step 3 — Implement `ThemeSource` (HOW)

This is the only class that knows your theme transport. For an HTTP backend:

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ThemeSource, ThemeFile } from '@solercia/ui';

@Injectable({ providedIn: 'root' })
export class MyApiThemeSource implements ThemeSource {
  private readonly http = inject(HttpClient);

  async loadTheme(tenantId: number | string): Promise<ThemeFile | null> {
    const url = `${API_BASE}/companies/${tenantId}/theme`;
    const res = await firstValueFrom(this.http.get<{ data: ThemeFile }>(url));
    return res?.data ?? null;   // null or throw → library uses the default
  }
}
```

Do not add a fallback theme here; the library handles that. A thrown error or a
`null` return degrades to the default automatically.

### Step 4 — Register providers in `app.config.ts`

```ts
import { ApplicationConfig } from '@angular/core';
import {
  provideTheme,
  SOL_TENANT_RESOLVER,
  THEME_SOURCE,
  SOL_I18N,
  // SOL_DEFAULT_THEME,   // only if overriding the bundled default
} from '@solercia/ui';
import { ActiveCompanyTenantResolver } from './theme/active-company-tenant.resolver';
import { MyApiThemeSource } from './theme/my-api-theme.source';
import { I18nService } from './i18n/i18n.service';   // your SolI18n facade (optional)

export const appConfig: ApplicationConfig = {
  providers: [
    // ...existing providers (router, http, etc.)

    // Theming runtime (APP_INITIALIZER: applies the default immediately,
    // then reacts to tenant changes).
    ...provideTheme(),

    // WHO the tenant is + HOW to load its theme.
    { provide: SOL_TENANT_RESOLVER, useExisting: ActiveCompanyTenantResolver },
    { provide: THEME_SOURCE, useExisting: MyApiThemeSource },

    // (optional) Route @solercia/ui components through your i18n engine.
    { provide: SOL_I18N, useExisting: I18nService },

    // (optional) Override the bundled default with your brand theme.
    // { provide: SOL_DEFAULT_THEME, useValue: myBrandTheme },
  ],
};
```

> `HttpClient` must be provided (`provideHttpClient(...)`) if your `ThemeSource`
> uses it.

### Step 5 — Add the level-3 safety net in `styles.css` (recommended)

Add a static `:root { --sol-*: … }` block so the app has sane colors even if the
default theme itself fails to render. `ThemeService` removes its inline vars when
it has no applicable theme, letting this block govern. Copy the emitted variable
names from `EMIT_TABLE` (`lib/tokens/theme.service.ts`).

### Step 6 — Provide i18n (optional)

If your components should translate, implement the `SolI18n` facade and bind it
with `{ provide: SOL_I18N, useExisting: YourI18nService }`. Full recipe (Transloco,
ngx-translate, or the bundled engine) in [`I18N.md`](./I18N.md). Skip this step
and the library renders English from its bundled catalog; for Spanish without an
engine provide `createSolI18n({ lang: 'es-CO' })`.

---

## Verification checklist

- [ ] `...provideTheme()` is in `app.config.ts`.
- [ ] With no tenant resolved (pre-login), the app renders on the bundled
      **Vértice** default (level 2).
- [ ] `SOL_TENANT_RESOLVER` returns `null` before login and a real id after.
- [ ] `THEME_SOURCE.loadTheme()` returns a valid `ThemeFile` (or `null`) and
      never invents a fallback theme.
- [ ] Switching tenant re-skins the UI live; a 404 / invalid payload silently
      keeps the default (a `ThemeService` warning appears in the console).
- [ ] Dark mode toggles independently of the tenant theme and persists across
      reloads.
- [ ] `styles.css` has a `:root` `--sol-*` block as the level-3 net.
- [ ] (If translating) `SOL_I18N` is bound to a `SolI18n` facade; otherwise the
      English default is intentionally in use.

---

## See also

- [`THEMING.md`](./THEMING.md) — ports, `ThemeFile` contract, degradation levels.
- [`I18N.md`](./I18N.md) — the `SOL_I18N` contract and engine options.

# Theming — `@solercia/ui`

The design system is **theming-agnostic by design**. The library never talks to
an HTTP API, an endpoint, `localStorage`, or any transport. It only:

1. defines the *ports* (injection tokens) a host implements, and
2. resolves a `ThemeFile` (the per-tenant `jsonb` document) into a flat set of
   `--sol-*` CSS custom properties applied to `:root`.

Where a theme comes from is 100% the host's concern. A host that provides
**nothing** still renders correctly, because the library ships a bundled default
theme ("Vértice").

All symbols below are exported from the package root:

```ts
import {
  ThemeService,
  provideTheme,
  THEME_SOURCE,
  SOL_TENANT_RESOLVER,
  SOL_DEFAULT_THEME,
  type ThemeSource,
  type SolTenantResolver,
  type ThemeFile,
} from '@solercia/ui';
```

---

## 1. The three ports

The library defines three host-provided injection tokens (in
`lib/tokens/theme-host.ts`). Together they answer three questions the library
deliberately does not know how to answer itself.

| Token | Question it answers | Type | Default (no host wiring) |
|---|---|---|---|
| `SOL_TENANT_RESOLVER` | **Who** is the active tenant? | `SolTenantResolver` | not provided → `ThemeService` behaves as single-theme (default only) |
| `THEME_SOURCE` | **How** do I load a tenant's theme? | `ThemeSource` | null-object → `loadTheme()` returns `null` → default is used |
| `SOL_DEFAULT_THEME` | **What** theme applies when there is no tenant theme? | `ThemeFile` | bundled **Vértice** theme (`themes/default.theme.json`) |

### `SolTenantResolver`

```ts
interface SolTenantResolver {
  /** Active tenant/company id, or null pre-login / on logout. */
  activeTenantId(): number | null;
}

const SOL_TENANT_RESOLVER = new InjectionToken<SolTenantResolver>('SOL_TENANT_RESOLVER');
```

`ThemeService` injects it with `{ optional: true }`. When absent, no tenant is
ever resolved and only the default theme is applied. The resolver is expected to
be reactive (e.g. backed by a signal): `ThemeService` reads
`activeTenantId()` inside an `effect`, so returning a new value triggers a
reload.

### `ThemeSource` (the port that keeps the library agnostic)

```ts
interface ThemeSource {
  /**
   * Resolve the theme for a tenant. Return `null` to fall back to the default.
   * How the theme is fetched is entirely the host's concern.
   */
  loadTheme(tenantId: number | string): Promise<ThemeFile | null>;
}

const THEME_SOURCE = new InjectionToken<ThemeSource>('THEME_SOURCE', {
  providedIn: 'root',
  // Null-object: no host adapter → no tenant theme → default is used.
  factory: (): ThemeSource => ({ async loadTheme() { return null; } }),
});
```

The library calls `source.loadTheme(tenantId)` and applies the result. It has no
idea whether the theme came from HTTP, a file, a mock, or `localStorage`.

### `SOL_DEFAULT_THEME`

```ts
const SOL_DEFAULT_THEME = new InjectionToken<ThemeFile>('SOL_DEFAULT_THEME', {
  providedIn: 'root',
  factory: (): ThemeFile => defaultTheme, // bundled "Vértice"
});
```

The host may override it with its own brand default (see §5).

---

## 2. What `ThemeService` does (and does not) do

`ThemeService` (`lib/tokens/theme.service.ts`, `providedIn: 'root'`) is the only
consumer of the three ports. It:

- applies the **effective theme** as `--sol-*` custom properties on
  `document.documentElement`;
- reacts to `SOL_TENANT_RESOLVER` changes and asks `THEME_SOURCE` for the new
  tenant theme (with anti-race protection — a stale response for a tenant that is
  no longer active is discarded);
- validates every incoming `ThemeFile` with `isRenderableTheme()` before applying
  it (a theme with broken refs, missing modes, or null values is rejected and the
  previous/default theme stays);
- manages light/dark mode as a **local user preference** (independent of the
  tenant theme), persisted in `localStorage` under `sol-dark-mode`, toggling the
  `dark` class on `<html>`/`<body>`;
- derives tenant branding: `logo()` (sanitized URL, dual light/dark variant via
  `meta.logo.urlDark`), `brandName()`, favicon, and a single sanitized Google
  Fonts `<link>` from `meta.fonts`.

It does **not** know any endpoint, does not import `HttpClient`, and never
constructs a URL to a theme service.

### Public surface

| Member | Kind | Purpose |
|---|---|---|
| `activeTheme` | `Signal<ThemeFile \| null>` | Effective theme applied to `:root` (tenant → default → `null`). Consume it to re-render on tenant change (e.g. `sol-chart`). |
| `isDark` | `Signal<boolean>` | Current mode. |
| `logo` | `Signal<ThemeLogo \| null>` | Effective, sanitized logo for the active mode. |
| `brandName` | `Signal<string \| null>` | Tenant brand name (logo `altText` or tenant slug). |
| `init()` | method | Bootstrap hook (invoked by `provideTheme` via `APP_INITIALIZER`). |
| `setTenantTheme(theme)` | method | Push a `ThemeFile` (or `null`) directly, bypassing `THEME_SOURCE`. Validated before applying. |
| `refresh()` | method | Re-load the active tenant's theme from `THEME_SOURCE` (e.g. after a Theme Studio save). No-op without a resolver/active tenant. |
| `toggleMode()` | method | Flip light/dark and persist the preference. |

---

## 3. Degradation levels (best → worst)

The theming runtime is a **fallback net**. It never leaves the app unthemed.

| Level | Source | When it applies | Requires a host? |
|---|---|---|---|
| **1 — Tenant theme** | `THEME_SOURCE.loadTheme(tenantId)` | A tenant is active *and* its theme loaded *and* is renderable | Yes (host provides `SOL_TENANT_RESOLVER` + `THEME_SOURCE`) |
| **2 — Bundled default** | `SOL_DEFAULT_THEME` (Vértice, shipped in the lib) | No tenant, or tenant theme failed/invalid | **No** — works out of the box |
| **3 — Inline `:root` CSS** | Host `styles.css` `:root { --sol-*: … }` block | `activeTheme()` is `null` (host explicitly nulled the default and there is no tenant theme) | Host-owned last resort |

Key consequences:

- A project that wires **nothing** falls straight to **level 2 (Vértice)** and
  works identically to a fully wired host — just without per-tenant switching.
- Any load failure (network, 404, 403, permissions) or an invalid `ThemeFile`
  degrades **silently** (a `console.warn`) from level 1 to level 2.
- Level 3 exists only as the ultimate safety net: when `ThemeService` has no
  applicable `ThemeFile`, it *removes* the inline `--sol-*` properties so the
  host's static `:root` block in `styles.css` governs, instead of leaving
  `:root` half-populated.

---

## 4. The `ThemeFile` contract (the per-tenant `jsonb`)

A `ThemeFile` is a **3-level token document** (W3C DTCG-aligned):
`primitives → semantic → component`. It is resolved top-down into the `--sol-*`
variables. Full typing lives in `lib/tokens/theme.model.ts`.

Two rules make the format forward-compatible:

- **`{path}` references** — semantic/component values may be literals or
  references like `"{color.blue.600}"`, resolved against `primitives`. A
  reference can occupy the whole value or be embedded in a shorthand
  (`"1px solid {color.ink.200}"`).
- **v1 vs v2 tokens** — every v2 block is **optional (`?`)**. A v1 `ThemeFile`
  (no v2 blocks) is still valid: each absent v2 token emits its baseline default.
  The emitter produces the full set of variables (47 mandatory v1 + 48 optional
  v2 = **95** `--sol-*` variables) regardless.

### Top-level shape

```ts
interface ThemeFile {
  meta: ThemeMeta;
  primitives: ThemePrimitives;
  modes: {
    light: ThemeModeConfig;   // both modes are REQUIRED
    dark: ThemeModeConfig;
  };
}
```

Light/dark is **not** part of the tenant identity — it is a local user
preference — but a theme **must** define both `modes.light` and `modes.dark`.

### `meta` — mode-invariant metadata (not emitted as CSS vars)

| Field | Type | v | Notes |
|---|---|---|---|
| `tenant` | `string` | v1 | Tenant slug / identifier. |
| `logo.url` | `string` | v1 | Sanitized before use (http/https/relative only). |
| `logo.urlDark` | `string?` | v2 | Dark-mode logo variant; falls back to `url`. |
| `logo.altText` | `string` | v1 | Also used as `brandName`. |
| `logo.width` | `number` | v1 | |
| `name` | `string?` | v2 (0.6.0) | Human-readable theme/template name. Metadata only. |
| `favicon` | `string?` | v2 (0.6.0) | Tenant favicon URL, sanitized like the logo. Missing or unsafe → the favicon follows the effective logo (previous behavior). |
| `tagline` | `string?` | v2 | Brand phrase (login/onboarding). |
| `fonts` | `ThemeFont[]?` | v2 | Google Fonts only; the `<link>` URL is built from `family` + `weights`, never from a raw tenant URL. |

`ThemeFont = { family: string; provider: 'google'; weights: number[] }`.

### `primitives` — level 1 (raw palette & scales, shared across modes)

| Field | Type | v | Notes |
|---|---|---|---|
| `color` | `Record<string, Record<string,string> \| string>` | v1 | e.g. `blue: { "600": "#2C4BFF" }`, or a flat `white: "#FFFFFF"`. |
| `font.family` | `{ sans; mono; display? }` | v1 (+ `display` v2) | |
| `font.size` | `{ sm; base; lg; xl }` | v1 | |
| `font.weight` | `{ normal; bold }` (numbers) | v1 | |
| `font.lineHeight` | `{ base }` | v1 | |
| `radius` | `{ sm; md; lg; full }` | v1 | |
| `space` | `{ xs; sm; md; lg; xl }` | v1 | |
| `size.control` | `{ sm; md; lg }` | v1 | |
| `z` | `Record<'1000'\|'1050'\|'1100', number>` | v1 | |
| `borderWidth` | `{ thin }` | v1 | |
| `motion` | `{ duration:{fast;base;slow}; easing:{standard;entrance} }?` | v2 | |

### `modes[light|dark].semantic` — level 2 (intent; references primitives)

| Field | Type | v | Notes |
|---|---|---|---|
| `color` | `{ primary; secondary; accent; success; warning; danger; info }` | v1 | `TokenRef` each. |
| `color.primaryContrast` | `TokenRef?` | v2 (0.6.0) | Text/icon over the primary → `--sol-color-primary-contrast` (default `#FFFFFF`). Light primaries need a dark value. |
| `color.secondaryContrast` | `TokenRef?` | v2 | Text over `secondary` (Cancel-style buttons) → `--sol-color-secondary-contrast` (default `#1E293B`). |
| `text` | `{ primary; secondary; muted }` | v1 | |
| `surface.page` / `surface.surface` / `surface.overlay` | `TokenRef` | v1 | |
| `surface.sunken` | `TokenRef?` | v2 | Recessed backgrounds (filled inputs, striped rows). |
| `surface.texture` | `string?` | v2 | Page `background-image`; **gradients or `"none"` only** (sanitized, never `url(`). |
| `border` | `{ color; width }` | v1 | |
| `layer` | `{ dropdown; modal; tooltip }` | v1 | |
| `shadow` | `{ sm; md; lg }` (raw box-shadow strings) | v1 | |

### `modes[light|dark].component` — level 3 (per-component decisions)

| Field | Type | v | Notes |
|---|---|---|---|
| `control` | `{ inputHeight; buttonHeight }` | v1 | |
| `layout` | `{ sidebarWidth; headerHeight }` | v1 | |
| `shadow` | `{ card }` | v1 | |
| `alerts` | `{ borderRadius; showIcon; position; duration; positionMobile? }` | v1 (+ `positionMobile` v2) | Preserved for API stability. |
| `typography` | `{ displayWeight; displayTracking; displayTransform; numericFamily? }?` | v2 | Heading/numeric character. |
| `card` | `{ bg; border; radius; shadow; shadowHover; blur; hoverLift }?` | v2 | Flat / elevated / glass. |
| `input` | `{ variant; bg; border; radius; shadow; focusBorder; focusRing }?` | v2 | `variant: 'filled'\|'outline'\|'underline'`. |
| `button` | `{ radius; shadow; weight; transform }?` | v2 | `transform: 'none'\|'uppercase'`. |
| `sidebar` | `{ bg; text; activeBg; activeText; itemRadius; indicator }?` | v2 | May be dark even in light mode. |
| `header` | `{ bg; blur }?` | v2 | Translucent/solid. |
| `auth` | `{ layout; heroBg }?` | v2 | `layout` read by the login template (not a CSS var); `heroBg` gradients only (sanitized). |
| `chart` | `{ palette: string[] }?` | v2 | 3–6 series colors; cyclically expanded/trimmed to 6. |
| `motion` | `{ intensity; revealStyle; revealDistance; pressScale }?` | v2 | `intensity` scales durations/distances before emit; `prefers-reduced-motion` forces `none`. |
| `overlay` | `{ blur }?` | v2 | Dialog backdrop blur → `--sol-overlay-blur` (default `blur(3px)`). |
| `table` | `{ mobile?: 'collapse'\|'scroll'; variant?: SolTableVariant }?` | v2 (+ `variant` 0.6.0) | `mobile`: responsive preference. `variant`: `clean`\|`zebra`\|`bordered`\|`emphasis-header`\|`banded`; `sol-data-table`'s `[variant]` input overrides it. Neither is a CSS var. |
| `calendar` | `{ mobileDays: 5\|7 }?` | v2 | Responsive preference (not a CSS var). |

> The complete emitted-variable table (which `--sol-*` maps to which contract
> path, with its v1/v2 default) is the canonical `EMIT_TABLE` in
> `lib/tokens/theme.service.ts`. Adding/removing a row changes the emitted set.

### Minimal `ThemeFile` (v1 only — still emits all 95 variables)

```jsonc
{
  "meta": {
    "tenant": "acme",
    "logo": { "url": "/assets/acme-logo.svg", "altText": "ACME", "width": 120 }
  },
  "primitives": {
    "color": {
      "brand": { "500": "#7C3AED", "600": "#6D28D9" },
      "ink":   { "100": "#EEF0F4", "500": "#5B6472", "900": "#0B0F1A" },
      "white": "#FFFFFF"
    },
    "font": {
      "family": { "sans": "system-ui, sans-serif", "mono": "monospace" },
      "size":   { "sm": "12px", "base": "14px", "lg": "16px", "xl": "20px" },
      "weight": { "normal": 400, "bold": 600 },
      "lineHeight": { "base": "1.5" }
    },
    "radius": { "sm": "2px", "md": "6px", "lg": "10px", "full": "9999px" },
    "space":  { "xs": "4px", "sm": "8px", "md": "12px", "lg": "20px", "xl": "32px" },
    "size":   { "control": { "sm": "30px", "md": "36px", "lg": "42px" } },
    "z":      { "1000": 1000, "1050": 1050, "1100": 1100 },
    "borderWidth": { "thin": "1px" }
  },
  "modes": {
    "light": {
      "semantic": {
        "color":  { "primary": "{color.brand.600}", "secondary": "{color.ink.500}", "accent": "{color.brand.500}", "success": "#16A34A", "warning": "#D97706", "danger": "#DC2626", "info": "{color.brand.500}" },
        "text":   { "primary": "{color.ink.900}", "secondary": "{color.ink.500}", "muted": "{color.ink.500}" },
        "surface":{ "page": "{color.ink.100}", "surface": "{color.white}", "overlay": "rgba(11,15,26,0.55)" },
        "border": { "color": "{color.ink.100}", "width": "{borderWidth.thin}" },
        "layer":  { "dropdown": "{z.1000}", "modal": "{z.1050}", "tooltip": "{z.1100}" },
        "shadow": { "sm": "none", "md": "0 6px 16px -8px rgba(12,18,32,0.12)", "lg": "0 16px 40px -16px rgba(12,18,32,0.18)" }
      },
      "component": {
        "control": { "inputHeight": "{size.control.md}", "buttonHeight": "{size.control.md}" },
        "layout":  { "sidebarWidth": "224px", "headerHeight": "52px" },
        "shadow":  { "card": "none" },
        "alerts":  { "borderRadius": "{radius.md}", "showIcon": false, "position": "top-right", "duration": 4000 }
      }
    },
    "dark": {
      "semantic": {
        "color":  { "primary": "{color.brand.500}", "secondary": "{color.ink.500}", "accent": "{color.brand.500}", "success": "#22C55E", "warning": "#F59E0B", "danger": "#EF4444", "info": "{color.brand.500}" },
        "text":   { "primary": "#E8EDF6", "secondary": "{color.ink.500}", "muted": "{color.ink.500}" },
        "surface":{ "page": "{color.ink.900}", "surface": "#131926", "overlay": "rgba(0,0,0,0.70)" },
        "border": { "color": "#1C2434", "width": "{borderWidth.thin}" },
        "layer":  { "dropdown": "{z.1000}", "modal": "{z.1050}", "tooltip": "{z.1100}" },
        "shadow": { "sm": "none", "md": "0 6px 16px -8px rgba(0,0,0,0.4)", "lg": "0 16px 40px -16px rgba(0,0,0,0.5)" }
      },
      "component": {
        "control": { "inputHeight": "{size.control.md}", "buttonHeight": "{size.control.md}" },
        "layout":  { "sidebarWidth": "224px", "headerHeight": "52px" },
        "shadow":  { "card": "none" },
        "alerts":  { "borderRadius": "{radius.md}", "showIcon": false, "position": "top-right", "duration": 4000 }
      }
    }
  }
}
```

The bundled reference theme with every v2 block populated is
`lib/tokens/themes/default.theme.json` ("Vértice").

---

## 5. Implementing a `ThemeSource`

A `ThemeSource` is a plain injectable that satisfies the port. This is the only
place that knows *how* a tenant theme is fetched. Real example from the
`boki-front` host (`src/shared/tokens/boki-api-theme.source.ts`):

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ThemeSource, ThemeFile } from '@solercia/ui';

@Injectable({ providedIn: 'root' })
export class BokiApiThemeSource implements ThemeSource {
  private readonly http = inject(HttpClient);

  async loadTheme(tenantId: number | string): Promise<ThemeFile | null> {
    const url = `${API_BASE}/companies/${tenantId}/theme`;
    const res = await firstValueFrom(this.http.get<{ data: ThemeFile }>(url));
    return res?.data ?? null;   // null → ThemeService falls back to the default
  }
}
```

Contract notes:

- Return `null` to fall back to the default (e.g. tenant has no configured theme).
- Throwing is fine: `ThemeService` catches it and degrades silently to the
  default. Do **not** add your own fallback theme here — that is the library's job.
- The returned `ThemeFile` is validated by `isRenderableTheme()` before it is
  applied, so a malformed document never breaks `:root`.

---

## 6. Overriding the default theme

Provide your own brand `ThemeFile` for `SOL_DEFAULT_THEME`. This becomes level 2
(and the pre-login look, since no tenant is resolved yet):

```ts
import { SOL_DEFAULT_THEME, type ThemeFile } from '@solercia/ui';
import myBrandTheme from './my-brand.theme.json';

providers: [
  { provide: SOL_DEFAULT_THEME, useValue: myBrandTheme as ThemeFile },
];
```

If you provide nothing, the bundled **Vértice** theme is used.

---

## 7. Wiring it in `app.config.ts` (real `boki-front` example)

```ts
import { provideTheme, SOL_TENANT_RESOLVER, THEME_SOURCE } from '@solercia/ui';
import { BokiApiThemeSource } from '@shared/tokens';
import { TENANT_RESOLVER, ActiveCompanyTenantResolver } from '@shared/tenant';

export const appConfig: ApplicationConfig = {
  providers: [
    // 1. Register the theming runtime (APP_INITIALIZER → applies the default
    //    immediately and starts reacting to tenant changes).
    ...provideTheme(),

    // 2. WHO is the tenant — the host's resolver.
    { provide: SOL_TENANT_RESOLVER, useExisting: ActiveCompanyTenantResolver },

    // 3. HOW to load a tenant theme — the host's adapter.
    { provide: THEME_SOURCE, useExisting: BokiApiThemeSource },

    // 4. (optional) Override the bundled default with your brand theme.
    // { provide: SOL_DEFAULT_THEME, useValue: myBrandTheme },
  ],
};
```

Drop steps 2–4 and a single `...provideTheme()` still gives you a fully themed
app on Vértice.

---

## See also

- [`I18N.md`](./I18N.md) — the companion `SOL_I18N` contract.
- [`MULTITENANT_SETUP.md`](./MULTITENANT_SETUP.md) — step-by-step wiring for new
  and existing hosts.

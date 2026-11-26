<p align="center">
  <img src="https://raw.githubusercontent.com/solercia-solutions/solercia-ui/main/.github/assets/solercia-mark.svg" alt="Solercia" width="48" height="92">
</p>

<h1 align="center">@solercia/ui</h1>

<p align="center">
  Themeable, host-agnostic Angular 22 design system: 57 standalone components and directives,
  multi-tenant theming through <code>--sol-*</code> tokens, a pluggable i18n contract and
  <code>ng add</code> scaffolding for Feature-Sliced Design projects.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@solercia/ui"><img src="https://img.shields.io/npm/v/@solercia/ui?color=10c1d6" alt="npm version"></a>
  <a href="https://github.com/solercia-solutions/solercia-ui/actions/workflows/ci.yml"><img src="https://github.com/solercia-solutions/solercia-ui/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-45fdae" alt="License: Apache-2.0"></a>
</p>

---

## Highlights

- **Modern Angular only.** Standalone, `OnPush`, signal inputs and outputs. Zoneless-ready: no zone.js required.
- **Theme by data, not by code.** A tenant theme is a JSON `ThemeFile`; the library resolves it into
  about 96 `--sol-*` CSS custom properties, with light and dark modes, favicon and Google Fonts.
- **Host-agnostic.** Theming and i18n are injected through small ports (`THEME_SOURCE`,
  `SOL_TENANT_RESOLVER`, `SOL_I18N`). The library never calls your API or assumes an i18n engine.
- **Works with zero wiring.** Without any provider it renders on the bundled «Vértice» theme.
- **Architecture included.** `ng add @solercia/ui` scaffolds FSD layers, path aliases, theme and i18n
  adapters, [`@solercia/eslint-config`](https://github.com/solercia-solutions/eslint-config), Husky and commitlint.
- **Live showcase.** Every component is demoed in [`projects/showcase`](./projects/showcase) — run `npm start`.

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Theming and i18n](#theming-and-i18n)
- [Components at a glance](#components-at-a-glance)
- [Component reference](#component-reference)
- [Showcase](#showcase)
- [For AI coding agents](#for-ai-coding-agents)
- [Development](#development)

## Installation

```bash
ng add @solercia/ui
# or, without scaffolding
npm install @solercia/ui @angular/cdk chart.js @dagrejs/dagre
```

| Peer dependency | Version | Used by |
| --- | --- | --- |
| `@angular/core`, `@angular/common`, `@angular/forms` | `^22.0.0` | everything |
| `@angular/cdk` | `^22.0.0` | kanban drag and drop |
| `rxjs` | `^7.8.0` | |
| `chart.js` | `^4.5.1` | `sol-chart` |
| `@dagrejs/dagre` | `^3.0.0` | `sol-flow-canvas` auto-layout (lazy chunk) |

## Quick start

```ts
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SOL_I18N, SOL_TENANT_RESOLVER, THEME_SOURCE, provideTheme } from '@solercia/ui';
import { routes } from './app.routes';
import { AppThemeSource, AppTenantResolver } from './shared/tokens';
import { I18nService } from './shared/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideTheme(),
    { provide: THEME_SOURCE, useExisting: AppThemeSource },          // optional
    { provide: SOL_TENANT_RESOLVER, useExisting: AppTenantResolver }, // optional (multi-tenant)
    { provide: SOL_I18N, useExisting: I18nService },                  // optional (English by default)
  ],
};
```

```ts
// Light/dark toggle anywhere
readonly theme = inject(ThemeService);
// template: <sol-icon-button [icon]="theme.isDark() ? 'sun' : 'moon'" ariaLabel="Toggle theme" (clicked)="theme.toggleMode()" />
```

```css
/* styles.css — the snippet ng add appends */
body {
  background: var(--sol-bg-page);
  color: var(--sol-color-text-primary);
  font-family: var(--sol-font-family);
}
```

A complete reference integration (a `SolI18n` engine that merges the bundled catalogs with its own keys) lives in
`projects/showcase/src/app/app.config.ts` and `projects/showcase/src/app/i18n/showcase-i18n.service.ts`.

### What `ng add @solercia/ui` does

Options: `--project` (defaults to the workspace application), `--skip-install`. It:

1. Creates FSD layer stubs `src/{pages,widgets,features,entities}/index.ts`.
2. Scaffolds `src/shared/tokens/app-theme-source.ts` (`AppThemeSource`, returns `null`),
   `app-tenant-resolver.ts` (`AppTenantResolver`, returns `null`) and `index.ts`.
3. Scaffolds `src/shared/i18n/i18n.service.ts` (`I18nService implements SolI18n`, identity) and `index.ts`.
4. Adds tsconfig path aliases `@app/*`, `@pages/*`, `@widgets/*`, `@features/*`, `@entities/*`, `@shared/*`.
5. Appends the `/* @solercia/ui — tokens base */` body snippet to `src/styles.css|scss` (idempotent).
6. Adds `provideTheme()` to the root providers (`app.config.ts`).
7. Creates `eslint.config.{js,mjs}` extending `@solercia/eslint-config` (FSD boundaries, smart/dumb rule,
   Chart.js restriction) unless one exists.
8. Scaffolds Husky (`.husky/pre-commit` → `npx lint-staged`, `.husky/commit-msg` → commitlint),
   `commitlint.config.*`, `lint-staged.config.*` and a `prepare: "husky"` script.
9. Adds dev dependencies `@solercia/eslint-config`, `husky`, `lint-staged`, `@commitlint/cli`,
   `@commitlint/config-conventional` and installs them (unless `--skip-install`).

It does **not** wire `THEME_SOURCE`/`SOL_I18N` providers automatically; the scaffolded adapters say how.

### Providers, tokens and services

| Symbol | Kind | Purpose |
|---|---|---|
| `provideTheme()` | `EnvironmentProviders` | App initializer that instantiates `ThemeService` so the theme is applied before first render. |
| `ThemeService` | service (`providedIn: 'root'`) | Resolves the active `ThemeFile` into ~96 `--sol-*` CSS variables on `:root`; light/dark; favicon; Google Fonts. API: `activeTheme()`, `isDark()`, `logo()`, `brandName()`, `tenantFavicon()` (signals), `setDarkMode(dark)`, `toggleMode()`, `setTenantTheme(theme \| null)`. The user’s mode choice persists in `localStorage`. |
| `THEME_SOURCE` | `InjectionToken<ThemeSource>` | Host port: `loadTheme(tenantId): Promise<ThemeFile \| null>`. Default returns `null`. |
| `SOL_TENANT_RESOLVER` | `InjectionToken<SolTenantResolver>` (optional) | Host port: `activeTenantId(): number \| null`. When provided, `ThemeService` reloads the tenant theme whenever it changes. |
| `SOL_DEFAULT_THEME` | `InjectionToken<ThemeFile>` | Fallback theme; defaults to `SOL_BUNDLED_DEFAULT_THEME` (“Vértice”). Degradation: tenant theme → default theme → inline `:root` CSS. |
| `SOL_I18N` | `InjectionToken<SolI18n>` | Host i18n engine: `activeLang: Signal<string>`, `translate(key, params?)`, `t(key, params?): Signal<string>`, `tMany(keys)`. Default is an English engine backed by the bundled catalog. |
| `createSolI18n(options?)` | function | Catalog-backed `SolI18n` engine with `setLang(lang)`. Options: `lang` (default `'en'`), `catalogs` (default `{ en: SOL_I18N_EN, 'es-CO': SOL_I18N_ES_CO }`). `createSolI18n({ lang: 'es-CO' })` gives Colombian Spanish. |
| `SOL_I18N_EN` / `SOL_I18N_ES_CO` | `SolI18nCatalog` | Bundled `shared.*` catalogs, also shipped as `@solercia/ui/i18n/en.json` and `@solercia/ui/i18n/es-CO.json` to merge into Transloco or ngx-translate. |
| `SOL_CHART_ENGINE` | `InjectionToken<SolChartEngineFactory>` | Chart.js factory used by `sol-chart`; override only to swap or mock the engine. |
| `SOL_CALENDAR_COLOR` | `InjectionToken<SolCalendarColorStrategy>` | Calendar event color strategy (`resolve(event, isDark): { bg, border, text }`). Default derives from `event.color` with `color-mix()` over tokens. |
| `KanbanReorderService` | service | Pure reorder helper: `reorder(columns, rawDropEvent) → { columns, moved } \| null`. Used by the board; reusable by hosts. |
| Helpers | functions/consts | `resolveCssVars`, `isRenderableTheme`, `isSafeBackgroundImage`, `buildGoogleFontsUrl`, `EMIT_TABLE`, `sanitizeAssetUrl`, `SOL_TABLE_VARIANTS`, `computeInitials`, `hashToPaletteIndex`, `normalizeRating`, `resolveScoreTone`, `DEFAULT_SCORE_THRESHOLDS`, `resolveTrendDirection`, `defaultTrendFormat`, timeline (`computeGlobalRange`, `positionRows`, `collectUndatedNodes`, `computeMonthAxisTicks`, `defaultStatusToken`), calendar (`buildDayColumns`, `computeEventTop`, `computeEventHeight`, `computeNowTop`, `dayKey`, `getWeekStart`, `parseEventDate`, `isSafeCssColor`, `NEUTRAL_CALENDAR_COLOR`), `computeAutoLayoutPositions` (flow canvas, dagre), `KANBAN_ADD_ACTION`, `SOL_TREE_MAX_DEPTH` (5), rich-editor serializer (`serializeElementToTcpdfHtml`, `sanitizeHtmlToTcpdf`, `TCPDF_ALLOWED_TAGS`, `TCPDF_ALLOWED_STYLE_PROPERTIES`). |

Peer dependencies: `@angular/{core,common,forms}` ^22, `@angular/cdk` ^22 (kanban drag and drop),
`rxjs` ^7.8, `chart.js` ^4.5.1 (`sol-chart`), `@dagrejs/dagre` ^3 (flow-canvas auto-layout, lazy chunk).
No zone.js required: the library works with `provideZonelessChangeDetection()` (Angular 22 default).

## Theming and i18n

- **Theming.** The host implements two optional ports: `SOL_TENANT_RESOLVER` (who the active tenant is)
  and `THEME_SOURCE` (how to load its `ThemeFile`). Degradation, best to worst: tenant theme from
  `THEME_SOURCE` → `SOL_DEFAULT_THEME` (bundled «Vértice») → inline `:root` CSS in the host's `styles.css`.
- **i18n.** `SOL_I18N` is a `SolI18n` contract (`t`, `translate`, `activeLang`, `tMany`), mirroring
  Angular Material's `*Intl` services. **English is the default**: without a provider every component
  text comes from the bundled English catalog. Every visible default goes through a `shared.*` key;
  an explicit input (`searchPlaceholder`, `actionsLabel`, `confirmLabel`, `label`…) always wins.
- **Bundled catalogs.** `SOL_I18N_EN` and `SOL_I18N_ES_CO` (also `@solercia/ui/i18n/en.json` and
  `@solercia/ui/i18n/es-CO.json`) hold every `shared.*` key. When your engine returns a `shared.*` key
  unchanged, the component falls back to the bundled catalog of the active language (`es*` → Colombian
  Spanish, anything else → English), so a host catalog does not need every library key.
- **Spanish.** Use the bundled engine, or merge the catalog into yours:

  ```ts
  import { SOL_I18N, SOL_I18N_ES_CO, createSolI18n } from '@solercia/ui';

  { provide: SOL_I18N, useFactory: () => createSolI18n({ lang: 'es-CO' }) }   // bundled engine
  // Transloco / ngx-translate: merge SOL_I18N_ES_CO (or @solercia/ui/i18n/es-CO.json) into the
  // es-CO translations and bind SOL_I18N to an adapter whose activeLang() returns 'es-CO'.
  ```

In-depth guides:

| Guide | Covers |
| --- | --- |
| [`THEMING.md`](./projects/solercia/ui/docs/THEMING.md) | Ports, the full `ThemeFile` contract, degradation levels, implementing a `ThemeSource` |
| [`I18N.md`](./projects/solercia/ui/docs/I18N.md) | The `SOL_I18N` contract and engine adapters |
| [`THEME-STUDIO.md`](./projects/solercia/ui/docs/THEME-STUDIO.md) | `@solercia/ui/theme-studio`: `<sol-theme-studio>`, the `ThemeStudioStore` contract |
| [`MULTITENANT_SETUP.md`](./projects/solercia/ui/docs/MULTITENANT_SETUP.md) | Step-by-step wiring for new and existing projects |

### Themed sign-in (`@solercia/ui/login-appearance`)

A theme can carry a `meta.login` block (photos, motion, per-mode composition and caption). The entry
point paints it and ships no auth logic: the host projects its own form.

```ts
import { SolLoginFrameComponent, resolveLoginView } from '@solercia/ui/login-appearance';

// `null` (no photos anywhere) keeps the classic centered card.
readonly view = computed(() => {
  const meta = this.themeService.activeTheme()?.meta as { login?: unknown } | undefined;
  return resolveLoginView({ published: null, theme: meta?.login }, this.themeService.isDark());
});
```

```html
<sol-login-frame [view]="view()" [tagline]="tagline()" [logo]="logo()" [dark]="isDark()">
  <h1>Sign in</h1>
  <app-login-form />
</sol-login-frame>
```

`normalizeLogin` bounds every value; photos must be `https://`, root-relative or `assets/` URLs of PNG,
JPEG, WebP or AVIF images. `<sol-theme-studio [features]="{ loginAppearance: true }">` adds the sign-in
tab with `<sol-login-appearance-editor>`.

## Components at a glance

All symbols are imported from `'@solercia/ui'` and added to the standalone component's `imports`.
**Req** marks a required input; **CVA** means the component implements `ControlValueAccessor`
(`[(ngModel)]`, `formControlName`).

| Category | Selector | Purpose |
| --- | --- | --- |
| Actions | `sol-button` | Text button with variants, sizes and a loading state. |
| Actions | `sol-icon-button` | Icon-only button; `ariaLabel` is mandatory. |
| Actions | `sol-icon` | Inline SVG from the built-in registry (~140 names: `home`, `menu`, `edit`, `trash`, `calendar`, `bell`, `sun`, `moon`, …; full list in the showcase *Icon* page). |
| Forms | `sol-input` | Text input with label and error message (CVA, `string`). |
| Forms | `sol-textarea` | Multi-line text input with label and error message (CVA, `string`). |
| Forms | `sol-form-field` | Label/hint/error wrapper for any projected control. |
| Forms | `sol-search-input` | Search box that emits the typed query. |
| Forms | `sol-number-input` | Stepper input with − / + buttons. |
| Forms | `sol-select` | Searchable single/multi select; bottom sheet below `mobileBreakpoint`. |
| Forms | `sol-checkbox` | Checkbox with sizes, colors, shapes and an optional link (CVA, `boolean`). |
| Forms | `sol-toggle` | On/off switch (CVA, `boolean`). |
| Forms | `sol-chip` | Single filter/choice chip. |
| Forms | `sol-chip-group` | Single or multiple choice as chips (CVA). |
| Forms | `sol-view-toggle` | Segmented control. |
| Forms | `sol-date-picker` | Calendar popover with day/month/year views. |
| Forms | `sol-day-picker` | Horizontal strip of bookable days computed by the host. |
| Forms | `sol-rating-input` | Interactive radiogroup of stars. |
| Forms | `sol-file-upload` | Drag-and-drop image picker with validation and preview. |
| Forms | `sol-rich-editor` | Rich text editor (headings, lists, alignment, links, tables, images, @mentions, #task links); output HTML is TCPDF-safe. |
| Feedback & status | `sol-badge` | Small status or count label with tones. |
| Feedback & status | `sol-message-status` | Delivery ticks with an accessible label. |
| Feedback & status | `sol-score-badge` | Numeric score colored by thresholds. |
| Feedback & status | `sol-trend` | Up/down/flat variation indicator. |
| Feedback & status | `sol-avatar` | Image or initials on a deterministic palette color. |
| Feedback & status | `sol-star-rating` | Read-only stars (`role="img"`). |
| Feedback & status | `sol-spinner` | Indeterminate loading indicator. |
| Feedback & status | `sol-skeleton` | Placeholder shapes while content loads. |
| Feedback & status | `sol-progress-bar` | Continuous or segmented progress with tones. |
| Feedback & status | `sol-empty-state` | Empty or no-results message with an optional action. |
| Feedback & status | `sol-tooltip` | Hover/focus hint for any element. |
| Feedback & status | `sol-notification-panel` | Inbox with loading / error / empty / content states, relative times and unread count. |
| Overlays | `sol-modal` | Host-controlled modal; Escape closes, focus trapped, body scroll locked. |
| Overlays | `sol-drawer` | Side panel or bottom sheet with a footer slot. |
| Overlays | `sol-confirm-dialog` | Confirm/cancel dialog for destructive actions. |
| Navigation | `sol-tabs` | Tab list only; the host renders the active panel. |
| Navigation | `sol-pagination` | Page navigation with page-size options. |
| Navigation | `sol-page-header` | Page title, subtitle and projected actions. |
| Navigation | `sol-stepper` | Progress through ordered steps. |
| Navigation | `sol-wizard` | Wizard = segmented progress bar + stepper pills + one panel per `*solWizardStep` + Back/Next/Finish footer. |
| Navigation | `sol-scope-switcher` | Menu to switch the active organization / workspace / tenant. |
| Navigation | `sol-tree` | Accessible tree (role `tree`), keyboard navigation, max depth 5. |
| Layout & motion | `sol-card` | Surface container with optional padding and hover elevation. |
| Layout & motion | `[solReveal]` | Entrance animation from the theme motion tokens; respects reduced motion. |
| Data | `sol-data-table` | Sorting, per-column filters, global search, pagination, edit/delete actions, row reveal and a collapsed layout below `collapseWidth`. |
| Data | `sol-virtual-scroll` | Windowed list with variable heights; chat-oriented (follows output, loads history at top). Requires an `<ng-template>` child (context `$implicit`, `index`) and a sized container. |
| Data | `sol-chart` | Chart.js wrapper themed from `--sol-*`; re-renders on light/dark. |
| Data | `sol-timeline` | Gantt-like hierarchy on a month axis; undated nodes listed apart. |
| Planning | `sol-kanban-board` | Columns with CDK drag and drop (mouse, touch, keyboard “Move to…”), optimistic mirror and `rollback()`. |
| Planning | `sol-kanban-column` | One column (normally rendered by the board). |
| Planning | `sol-kanban-card` | Draggable card rendered from a consumer template. |
| Planning | `sol-kanban-drag-source` | External list whose items can be dropped into a board’s columns (board emits `externalItemDropped`). |
| Planning | `sol-calendar` | Week/day agenda = header + grid + optional legend. |
| Planning | `sol-calendar-header` | Calendar toolbar: period, navigation and view switch. |
| Planning | `sol-calendar-grid` | Same inputs/outputs as `sol-calendar` minus `legend`. |
| Planning | `sol-flow-canvas` | Pan/zoom node graph: drag nodes, connect ports, keyboard moves with live announcements, “Arrange” auto-layout (dagre, lazy). |

## Component reference

### Actions

#### `sol-button` — `SolButtonComponent`
Text button with variants, sizes and a loading state.

| Input | Type | Default | Req |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost'` | `'primary'` | |
| `size` | `'sm' \| 'md' \| 'lg' \| 'touch'` | `'md'` | |
| `disabled` | `boolean` | `false` | |
| `type` | `string` | `'button'` | |
| `loading` | `boolean` | `false` | |

Outputs: `clicked: void`. Content: label (`<ng-content>`).

```html
<sol-button variant="danger" size="sm" [loading]="saving()" (clicked)="remove()">Delete</sol-button>
```

#### `sol-icon-button` — `SolIconButtonComponent`
Icon-only button; `ariaLabel` is mandatory.

| Input | Type | Default | Req |
|---|---|---|---|
| `icon` | `SolIconName` | — | yes |
| `ariaLabel` | `string` | — | yes |
| `type` | `'button' \| 'submit'` | `'button'` | |
| `variant` | `'default' \| 'danger' \| 'ghost' \| 'outline'` | `'default'` | |
| `size` | `'sm' \| 'md' \| 'lg' \| 'touch'` | `'md'` | |
| `disabled` | `boolean` | `false` | |

Outputs: `clicked: void`.

```html
<sol-icon-button icon="trash" variant="danger" ariaLabel="Delete project" (clicked)="remove()" />
```

#### `sol-icon` — `SolIconComponent`
Inline SVG from the built-in registry (~140 names: `home`, `menu`, `edit`, `trash`, `calendar`, `bell`, `sun`, `moon`, …; full list in the showcase *Icon* page).

| Input | Type | Default | Req |
|---|---|---|---|
| `name` | `SolIconName \| string` | — | yes |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | |
| `variant` | `'outline' \| 'fill'` | `'outline'` | |

```html
<sol-icon name="star" size="lg" variant="fill" />
```

---

### Forms

#### `sol-input` — `SolInputComponent` (CVA, `string`)
| Input | Type | Default | Req |
|---|---|---|---|
| `type` | `string` | `'text'` | |
| `placeholder` | `string` | `''` | |
| `label` | `string` | `''` | |
| `error` | `string` | `''` | |
| `disabled` | `boolean` | `false` | |
| `autocomplete` | `string \| undefined` | `undefined` | |
| `min` | `string \| undefined` | `undefined` | |

```html
<sol-input label="Email" type="email" autocomplete="email" [(ngModel)]="email" [error]="emailError()" />
```

#### `sol-textarea` — `SolTextareaComponent` (CVA, `string`)
| Input | Type | Default | Req |
|---|---|---|---|
| `placeholder` | `string` | `''` | |
| `label` | `string` | `''` | |
| `error` | `string` | `''` | |
| `disabled` | `boolean` | `false` | |
| `rows` | `number` | `3` | |

```html
<sol-textarea label="Notes" [rows]="4" formControlName="notes" />
```

#### `sol-form-field` — `SolFormFieldComponent`
Label/hint/error wrapper for any projected control.

| Input | Type | Default | Req |
|---|---|---|---|
| `label` | `string` | `''` | |
| `error` | `string` | `''` | |
| `hint` | `string` | `''` | |

```html
<sol-form-field label="Website" hint="Include https://"><input formControlName="website" /></sol-form-field>
```

#### `sol-search-input` — `SolSearchInputComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `placeholder` | `string` | `shared.searchInput.placeholder` («Search...») | |

Outputs: `searchChange: string`. (Debounce behavior: not verified.)

```html
<sol-search-input placeholder="Search projects…" (searchChange)="query.set($event)" />
```

#### `sol-number-input` — `SolNumberInputComponent` (CVA, `number \| null`)
Stepper input with − / + buttons.

| Input | Type | Default | Req |
|---|---|---|---|
| `min` | `number` | `0` | |
| `max` | `number` | `Number.MAX_SAFE_INTEGER` | |
| `step` | `number` | `1` | |
| `disabled` | `boolean` | `false` | |
| `ariaLabelKey` | `string` (i18n key) | — | yes |
| `decrementLabelKey` | `string` | `'shared.numberInput.decrement'` | |
| `incrementLabelKey` | `string` | `'shared.numberInput.increment'` | |

```html
<sol-number-input ariaLabelKey="pages.checkout.seats" [min]="1" [max]="20" [(ngModel)]="seats" />
```

#### `sol-select` — `SolSelectComponent` (CVA, `string`; `string[]` when `multiple`)
Searchable single/multi select; bottom sheet below `mobileBreakpoint`.

| Input | Type | Default | Req |
|---|---|---|---|
| `options` | `SolSelectOption[]` (`{ value: string; label: string }`) | `[]` | |
| `placeholder` | `string` | `shared.select.placeholder` («Select...») | |
| `label` | `string` | `''` | |
| `error` | `string` | `''` | |
| `disabled` | `boolean` | `false` | |
| `searchable` | `boolean` | `true` | |
| `multiple` | `boolean` | `false` | |
| `showAllOption` | `boolean` | `false` | |
| `allOptionLabel` | `string` | `shared.select.all` («All») | |
| `ariaLabel` | `string` | `''` | |
| `searchPlaceholder` | `string` | `shared.select.searchPlaceholder` («Search...») | |
| `emptyLabel` | `string` | `shared.select.empty` («No results») | |
| `value` | `string \| null \| undefined` | `undefined` | |
| `mobileBreakpoint` | `number` | `640` | |

Outputs: `valueChange: string`.

```html
<sol-select label="Country" placeholder="Select a country" searchPlaceholder="Search…" emptyLabel="No results"
            [options]="[{ value: 'co', label: 'Colombia' }, { value: 'mx', label: 'Mexico' }]" [(ngModel)]="country" />
```

#### `sol-checkbox` — `SolCheckboxComponent` (CVA, `boolean`)
| Input | Type | Default | Req |
|---|---|---|---|
| `label` | `string` | `''` | |
| `disabled` | `boolean` | `false` | |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | |
| `color` | `'primary' \| 'secondary' \| 'success' \| 'danger' \| 'amber' \| 'teal' \| 'indigo' \| 'purple' \| 'pink'` | `'primary'` | |
| `shape` | `'rounded' \| 'square' \| 'circle'` | `'rounded'` | |
| `ripple` | `boolean` | `true` | |
| `icon` | `'check' \| 'minus' \| 'heart' \| 'star'` | `'check'` | |
| `linkText` | `string` | `''` | |
| `linkHref` | `string` | `''` | |

Outputs: `changed: boolean`.

```html
<sol-checkbox label="I accept the" linkText="terms" linkHref="/terms" formControlName="terms" />
```

#### `sol-toggle` — `SolToggleComponent` (CVA, `boolean`)
| Input | Type | Default | Req |
|---|---|---|---|
| `label` | `string` | `''` | |
| `ariaLabel` | `string` | `''` | |
| `disabled` | `boolean` | `false` | |
| `size` | `'sm' \| 'md'` | `'md'` | |
| `onText` | `string \| undefined` | `undefined` | |
| `offText` | `string \| undefined` | `undefined` | |

```html
<sol-toggle label="Email alerts" [(ngModel)]="alerts" />
```

#### `sol-chip` — `SolChipComponent`
Single filter/choice chip.

| Input | Type | Default | Req |
|---|---|---|---|
| `value` | `string` | — | yes |
| `label` | `string` | — | yes |
| `emoji` | `string` | `''` | |
| `count` | `number \| null` | `null` | |
| `selected` | `boolean` | `false` | |
| `disabled` | `boolean` | `false` | |
| `size` | `'sm' \| 'md'` | `'md'` | |
| `removable` | `boolean` | `false` | |
| `role` | `'button' \| 'radio' \| 'checkbox'` | `'button'` | |
| `tabIndex` | `number` | `0` | |
| `removeLabelKey` | `string` | `'shared.chip.remove'` | |

Outputs: `toggled: string`, `removed: string` (both emit `value`).

```html
<sol-chip value="urgent" label="Urgent" emoji="🔥" [count]="3" [selected]="urgent()" (toggled)="toggle($event)" />
```

#### `sol-chip-group` — `SolChipGroupComponent` (CVA, `string` or `string[]` when `multiple`)
| Input | Type | Default | Req |
|---|---|---|---|
| `options` | `SolChipOption[]` (`{ value, label, emoji?, disabled?, count? }`) | — | yes |
| `multiple` | `boolean` | `false` | |
| `allowDeselect` | `boolean` | `true` | |
| `disabled` | `boolean` | `false` | |
| `size` | `'sm' \| 'md'` | `'md'` | |
| `removable` | `boolean` | `false` | |
| `ariaLabelKey` | `string` (i18n key) | — | yes |
| `removeLabelKey` | `string` | `'shared.chip.remove'` | |

```html
<sol-chip-group ariaLabelKey="pages.projects.categories" [options]="categories" [multiple]="true" [(ngModel)]="selected" />
```

#### `sol-view-toggle` — `SolViewToggleComponent`
Segmented control.

| Input | Type | Default | Req |
|---|---|---|---|
| `options` | `SolViewToggleOption[]` (`{ value, label, icon?: SolIconName }`) | — | yes |
| `value` | `string` | — | yes |

Outputs: `valueChange: string`.

```html
<sol-view-toggle [options]="[{ value: 'list', label: 'List', icon: 'list' }, { value: 'board', label: 'Board', icon: 'view-columns' }]"
                 [value]="view()" (valueChange)="view.set($event)" />
```

#### `sol-date-picker` — `SolDatePickerComponent` (CVA, `Date \| string \| null`; emits ISO `yyyy-mm-dd`)
Calendar popover with day/month/year views.

| Input | Type | Default | Req |
|---|---|---|---|
| `value` | `Date \| string \| null` | `null` (assumed) | |
| `min` | `Date \| string \| null` | `null` (assumed) | |
| `max` | `Date \| string \| null` | `null` (assumed) | |
| `placeholder` | `string` | `''` (falls back to `shared.datePicker.placeholder`) | |
| `disabled` | `boolean` | `false` | |
| `size` | `'sm' \| 'md'` | `'md'` | |

Outputs: `valueChange: string`.

```html
<sol-date-picker min="2026-11-24" max="2026-12-24" formControlName="dueDate" />
```

#### `sol-day-picker` — `SolDayPickerComponent`
Horizontal strip of bookable days computed by the host.

| Input | Type | Default | Req |
|---|---|---|---|
| `days` | `DayPickerItem[]` (`{ dateStr, dayName, dayNumber, isToday?, isPast }`) | — | yes |
| `selectedDate` | `string \| null` | `null` | |

Outputs: `dateSelected: string`.

```html
<sol-day-picker [days]="days()" [selectedDate]="date()" (dateSelected)="date.set($event)" />
```

#### `sol-rating-input` — `SolRatingInputComponent` (CVA, `number \| null`, 1–5)
Interactive radiogroup of stars.

| Input | Type | Default | Req |
|---|---|---|---|
| `size` | `'sm' \| 'md' \| 'lg'` | `'lg'` | |
| `disabled` | `boolean` | `false` | |
| `readOnly` | `boolean` | `false` | |
| `error` | `string` | `''` | |
| `allowClear` | `boolean` | `false` | |
| `ariaLabelKey` | `string` | `'shared.ratingInput.groupLabel'` | |
| `optionLabelKey` | `string` | `'shared.ratingInput.option'` | |
| `clearLabelKey` | `string` | `'shared.ratingInput.clear'` | |

Outputs: `ratingChanged: number \| null`.

```html
<sol-rating-input formControlName="rating" [allowClear]="true" (ratingChanged)="save($event)" />
```

#### `sol-file-upload` — `SolFileUploadComponent`
Drag-and-drop image picker with validation and preview.

| Input | Type | Default | Req |
|---|---|---|---|
| `accept` | `string` | `'image/jpeg,image/png,image/webp,image/gif'` | |
| `maxSizeBytes` | `number` | `5 * 1024 * 1024` | |
| `label` | `string` | `shared.fileUpload.label` («Drag or click to upload») | |
| `hint` | `string` | `shared.fileUpload.hint` («JPG, PNG, WEBP or GIF · max. 5 MB») | |

Outputs: `fileSelected: File`, `previewReady: string` (data URL), `fileError: string`, `fileRemoved: void`.

```html
<sol-file-upload label="Drag your logo here" hint="PNG · max. 200 KB" accept="image/png" [maxSizeBytes]="204800"
                 (fileSelected)="upload($event)" (fileError)="error.set($event)" />
```

#### `sol-rich-editor` — `SolRichEditorComponent` (CVA, HTML `string`)
Rich text editor (headings, lists, alignment, links, tables, images, @mentions, #task links); output HTML is TCPDF-safe.

| Input | Type | Default | Req |
|---|---|---|---|
| `placeholder` | `string` | `''` | |
| `minHeight` | `string` | `'12rem'` | |
| `maxHeight` | `string` | `''` | |
| `ariaLabel` | `string` | `''` | |
| `disabled` | `boolean` | `false` | |
| `imageMaxBytes` | `number` | `5 * 1024 * 1024` | |
| `imageUpload` | `SolRichImageUploader \| null` (`(file: File) => Promise<string>`) | `null` | |
| `mentionableUsers` | `MentionUser[]` (`{ id, name }`) | `[]` | |
| `linkableTasks` | `LinkableTask[]` (`{ key, title }`) | `[]` | |

Outputs: `valueChange: string`, `mentionsChange: string[]`, `taskLinksChange: string[]`.

```html
<sol-rich-editor ariaLabel="Description" [imageUpload]="upload" [mentionableUsers]="users" [(ngModel)]="html" />
```
```ts
upload: SolRichImageUploader = (file) => this.api.uploadImage(file); // resolves the public URL
```

---

### Feedback & status

#### `sol-badge` — `SolBadgeComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `variant` | `'success' \| 'warning' \| 'danger' \| 'info' \| 'neutral'` | `'neutral'` | |
| `size` | `'sm' \| 'md'` | `'sm'` | |

```html
<sol-badge variant="success">Active</sol-badge>
```

#### `sol-message-status` — `SolMessageStatusComponent`
Delivery ticks with an accessible label.

| Input | Type | Default | Req |
|---|---|---|---|
| `status` | `'pending' \| 'sent' \| 'delivered' \| 'read' \| 'failed'` | — | yes |

```html
<sol-message-status [status]="message.status" />
```

#### `sol-score-badge` — `SolScoreBadgeComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `value` | `number \| null` | `null` | |
| `max` | `number` | `100` | |
| `thresholds` | `readonly SolScoreThreshold[]` (`{ upTo, tone }`) | `DEFAULT_SCORE_THRESHOLDS` (≤50 danger, ≤80 warning, else success) | |
| `pending` | `boolean` | `false` | |

```html
<sol-score-badge [value]="lead.score" />
```

#### `sol-trend` — `SolTrendComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `current` | `number` | — | yes |
| `previous` | `number \| null` | `null` | |
| `invert` | `boolean` | `false` | |
| `format` | `(delta: number) => string` | `defaultTrendFormat` | |

```html
<sol-trend [current]="4" [previous]="6" [invert]="true" />  <!-- lower churn is good -->
```

#### `sol-avatar` — `SolAvatarComponent`
Image or initials on a deterministic palette color.

| Input | Type | Default | Req |
|---|---|---|---|
| `name` | `string \| null \| undefined` | — | yes |
| `imageUrl` | `string \| null` | `null` | |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | |

```html
<sol-avatar [name]="user.fullName" [imageUrl]="user.photo" size="lg" />
```

#### `sol-star-rating` — `SolStarRatingComponent`
Read-only stars (`role="img"`).

| Input | Type | Default | Req |
|---|---|---|---|
| `value` | `number \| null` | `null` | |
| `size` | `'sm' \| 'md' \| 'lg'` | `'sm'` | |
| `showValue` | `boolean` | `false` | |

```html
<sol-star-rating [value]="4.5" [showValue]="true" />
```

#### `sol-spinner` — `SolSpinnerComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | |
| `color` | `string` (CSS color) | `''` (theme primary) | |

```html
<sol-spinner size="lg" />
```

#### `sol-skeleton` — `SolSkeletonComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `variant` | `'text' \| 'title' \| 'stat' \| 'card' \| 'row' \| 'circle' \| 'rounded' \| 'square'` | `'rounded'` | |
| `width` | `string` | `''` | |
| `height` | `string` | `''` | |
| `aspectRatio` | `string` | `''` | |
| `count` | `number` (`numberAttribute`) | `1` | |

```html
<sol-skeleton variant="text" count="3" />
```

#### `sol-progress-bar` — `SolProgressBarComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `mode` | `'continuous' \| 'segmented'` | `'continuous'` | |
| `value` | `number` | `0` | |
| `max` | `number` | `100` | |
| `steps` | `number` | `0` | |
| `current` | `number` | `0` | |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | |
| `variant` | `'primary' \| 'success' \| 'warning' \| 'danger'` | `'primary'` | |
| `showLabel` | `boolean` | `false` | |
| `label` | `string` | `''` | |
| `ariaLabel` | `string` | `''` | |

```html
<sol-progress-bar [value]="uploaded()" variant="success" [showLabel]="true" label="Upload" />
<sol-progress-bar mode="segmented" [steps]="5" [current]="2" />
```

#### `sol-empty-state` — `SolEmptyStateComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `icon` | `SolIconName` | `'list'` | |
| `titleKey` | `string` (i18n key) | — | yes |
| `descriptionKey` | `string` (i18n key) | `''` | |

Content: call-to-action (`<ng-content>`).

```html
<sol-empty-state icon="folder-open" titleKey="pages.projects.empty.title" descriptionKey="pages.projects.empty.description">
  <sol-button (clicked)="create()">Create project</sol-button>
</sol-empty-state>
```

#### `sol-tooltip` — `SolTooltipComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `text` | `string` | — | yes |

```html
<sol-tooltip text="Edit the project"><sol-icon-button icon="edit" ariaLabel="Edit" /></sol-tooltip>
```

#### `sol-notification-panel` — `SolNotificationPanelComponent`
Inbox with loading / error / empty / content states, relative times and unread count.

| Input | Type | Default | Req |
|---|---|---|---|
| `items` | `readonly SolNotificationItem[] \| null \| undefined` (`{ id, title, body?, timestamp?, read?, typeLabel?, tone?, data? }`) | `[]` | |
| `loading` | `boolean` | `false` | |
| `error` | `boolean` | `false` | |
| `errorMessage` | `string` | `''` | |
| `emptyTitleKey` | `string` | `'shared.notificationPanel.emptyTitle'` | |
| `emptyDescriptionKey` | `string` | `'shared.notificationPanel.emptyDescription'` | |

Outputs: `itemSelected: T`, `markedRead: T`, `markedAllRead: void`, `retryRequested: void`, `closed: void`.

```html
<sol-notification-panel [items]="notifications()" [loading]="loading()" [error]="failed()"
  (itemSelected)="open($event)" (markedRead)="markRead($event)" (markedAllRead)="markAll()" (retryRequested)="reload()" (closed)="close()" />
```

---

### Overlays

#### `sol-modal` — `SolModalComponent`
Host-controlled modal dialog; Escape closes, focus trapped and restored, body scroll locked.

| Input | Type | Default | Req |
|---|---|---|---|
| `open` | `boolean` | `false` | |
| `title` | `string` | `''` | |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | |
| `closeable` | `boolean` | `true` | |
| `closeOnBackdrop` | `boolean` | `false` | |
| `ariaLabel` | `string` | `''` (used only when there is no `title`) | |

Outputs: `closed: void`. Content: body (single slot; place footer buttons inside). Accessibility: the panel
is `role="dialog"` + `aria-modal="true"`, labelled by the title (or `ariaLabel`); focus moves into it on
open, Tab/Shift+Tab stay inside, Escape closes when `closeable`, focus returns to the previously focused
element and the page scroll is locked while open. The close button reads `shared.modal.close`.

```html
<sol-modal [open]="open()" title="Invite a teammate" (closed)="open.set(false)">
  <sol-input label="Email" [(ngModel)]="email" />
  <sol-button (clicked)="send()">Send invite</sol-button>
</sol-modal>
```

#### `sol-drawer` — `SolDrawerComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `open` | `boolean` | `false` | |
| `title` | `string` | `''` | |
| `side` | `'start' \| 'end'` | `'end'` | |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | |
| `variant` | `'panel' \| 'sheet'` | `'panel'` | |
| `closeable` | `boolean` | `true` | |
| `closeOnBackdrop` | `boolean` | `true` | |
| `ariaLabel` | `string` | `''` (used only when there is no `title`) | |

Outputs: `closed: void`. Content: body + `[drawerFooter]` slot. Same dialog accessibility as `sol-modal`.

```html
<sol-drawer [open]="filtersOpen()" title="Filters" (closed)="filtersOpen.set(false)">
  …
  <div drawerFooter><sol-button (clicked)="apply()">Apply</sol-button></div>
</sol-drawer>
```

#### `sol-confirm-dialog` — `SolConfirmDialogComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `open` | `boolean` | `false` | |
| `title` | `string` | `shared.confirmDialog.title` («Are you sure?») | |
| `message` | `string` | `''` | |
| `confirmLabel` | `string` | `shared.confirmDialog.confirm` («Confirm») | |
| `cancelLabel` | `string` | `shared.confirmDialog.cancel` («Cancel») | |
| `variant` | `'danger' \| 'warning' \| 'info'` | `'danger'` | |

Outputs: `confirm: void`, `cancel: void`. Accessibility: the panel is `role="alertdialog"` +
`aria-modal="true"`, labelled by the title and described by the message; focus starts on Cancel (the
least destructive action), stays inside, returns to the trigger on close, and the page scroll is locked.

```html
<sol-confirm-dialog [open]="confirming()" title="Delete this project?" confirmLabel="Delete" cancelLabel="Cancel"
                    (confirm)="remove()" (cancel)="confirming.set(false)" />
```

---

### Navigation

#### `sol-tabs` — `SolTabsComponent`
Tab list only; the host renders the active panel.

| Input | Type | Default | Req |
|---|---|---|---|
| `tabs` | `SolTabItem[]` (`{ id, label, icon? }`) | — | yes |
| `activeTab` | `string` | `''` | |

Outputs: `tabChange: string`.

```html
<sol-tabs [tabs]="tabs" [activeTab]="tab()" (tabChange)="tab.set($event)" />
```

#### `sol-pagination` — `SolPaginationComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `totalItems` | `number` | `0` | |
| `pageSize` | `number` | `10` | |
| `currentPage` | `number` | `1` | |
| `pageSizeOptions` | `number[]` | `[10, 25, 50]` | |

Outputs: `pageChanged: number`, `pageSizeChanged: number`.

```html
<sol-pagination [totalItems]="total()" [pageSize]="size()" [currentPage]="page()" (pageChanged)="page.set($event)" (pageSizeChanged)="size.set($event)" />
```

#### `sol-page-header` — `SolPageHeaderComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `title` | `string` | — | yes |
| `subtitle` | `string` | `''` | |

Content: actions.

```html
<sol-page-header title="Projects" subtitle="Manage your portfolio"><sol-button>New project</sol-button></sol-page-header>
```

#### `sol-stepper` — `SolStepperComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `steps` | `SolStepperStep[]` (`{ id, labelKey, descriptionKey?, error? }`) | — | yes |
| `activeIndex` | `number` | `0` | |
| `furthestIndex` | `number \| null` | `null` | |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | |
| `interactive` | `boolean` | `false` | |
| `navigation` | `'linear' \| 'free'` | `'linear'` | |
| `ariaLabelKey` | `string` | `'shared.stepper.aria'` | |

Outputs: `stepSelected: number`.

```html
<sol-stepper [steps]="steps" [activeIndex]="step()" [interactive]="true" (stepSelected)="step.set($event)" />
```

#### `sol-wizard` — `SolWizardComponent` + `[solWizardStep]` — `SolWizardStepDirective`
Wizard = segmented progress bar + stepper pills + one panel per `*solWizardStep` + Back/Next/Finish footer.

| Input | Type | Default | Req |
|---|---|---|---|
| `steps` | `SolWizardStep[]` (`{ id, label?, labelKey?, icon? }`) | — | yes |
| `current` | `number` (`model`, use `[(current)]`) | `0` | |
| `showProgressBar` | `boolean` | `true` | |
| `hidePreviousOnFirst` | `boolean` | `true` | |
| `canAdvance` | `boolean \| ((index: number) => boolean)` | `true` | |
| `previousLabel` / `nextLabel` / `finishLabel` | `string` | `''` (library defaults; set explicitly for English) | |

Outputs: `next: void`, `previous: void`, `stepChange: number`, `finish: void`, `currentChange: number`. The directive has no inputs (structural: `*solWizardStep`).

```html
<sol-wizard [steps]="steps" [(current)]="current" [canAdvance]="canAdvance" nextLabel="Next" previousLabel="Back" finishLabel="Create" (finish)="save()">
  <ng-container *solWizardStep><sol-input label="Name" [(ngModel)]="name" /></ng-container>
  <ng-container *solWizardStep>Summary…</ng-container>
</sol-wizard>
```

#### `sol-scope-switcher` — `SolScopeSwitcherComponent`
Menu to switch the active organization / workspace / tenant.

| Input | Type | Default | Req |
|---|---|---|---|
| `scopes` | `readonly SolScope[]` (`{ id, label, sublabel?, icon?, imageUrl?, data? }`) | `[]` | |
| `activeScopeId` | `string \| null \| undefined` | `null` | |
| `status` | `'idle' \| 'loading' \| 'error'` | `'idle'` | |
| `disabled` | `boolean` | `false` | |
| `align` | `'start' \| 'end'` | `'end'` | |
| `errorMessage` / `emptyMessage` / `loadingMessage` | `string` | `''` (i18n defaults) | |
| `triggerAriaLabel` / `panelAriaLabel` | `string` | `''` (i18n defaults) | |

Outputs: `scopeSelected: SolScope`, `openChange: boolean`.

```html
<sol-scope-switcher [scopes]="companies()" [activeScopeId]="activeId()" [status]="status()" (scopeSelected)="switchTo($event)" />
```

#### `sol-tree` — `SolTreeComponent` + `[solTreeNodeDef]` — `SolTreeNodeDefDirective`
Accessible tree (role `tree`), keyboard navigation, max depth 5.

| Input | Type | Default | Req |
|---|---|---|---|
| `nodes` | `readonly SolTreeNode[]` (`{ id, label, children?, data? }`) | — | yes |
| `expandedIds` | `readonly string[] \| null` (`model`, `[(expandedIds)]`) | `null` | |
| `defaultExpandedDepth` | `number` | `1` | |
| `maxDepth` | `number` | `SOL_TREE_MAX_DEPTH` (5) | |
| `indent` | `number` (px) | `16` | |
| `ariaLabel` | `string` | `''` | |

Outputs: `nodeSelected: SolTreeNode`, `nodeToggled: SolTreeToggleEvent` (`{ node, expanded, expandedIds }`), `expandedIdsChange`.
Template context of `solTreeNodeDef`: `$implicit`/`node`, `depth`, `expanded`, `hasChildren` (its `data` is typed `unknown`).

```html
<sol-tree [nodes]="tree()" [(expandedIds)]="expanded" (nodeSelected)="open($event)">
  <ng-template solTreeNodeDef let-node let-depth="depth"><span>{{ node.label }}</span></ng-template>
</sol-tree>
```

---

### Layout & motion

#### `sol-card` — `SolCardComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `padding` | `boolean` | `true` | |
| `hoverable` | `boolean` | `false` | |

```html
<sol-card [hoverable]="true">…</sol-card>
```

#### `[solReveal]` — `SolRevealDirective`
Entrance animation from the theme motion tokens; respects reduced motion.

| Input | Type | Default | Req |
|---|---|---|---|
| `solRevealIndex` | `number` (stagger index) | `0` | |
| `solRevealReplay` | `unknown` (change to replay) | `undefined` | |

```html
@for (item of items(); track item.id; let i = $index) {
  <sol-card solReveal [solRevealIndex]="i" [solRevealReplay]="filter()">{{ item.name }}</sol-card>
}
```

---

### Data

#### `sol-data-table` — `SolDataTableComponent`
Sorting, per-column filters, global search, pagination, edit/delete actions, row reveal and a collapsed layout below `collapseWidth`.

| Input | Type | Default | Req |
|---|---|---|---|
| `data` | `SolDataTableRow[]` (`Record<string, unknown>`) | `[]` | |
| `columns` | `DataTableColumn[]` (`{ key, label, sortable?, width?, badge?, filter?: 'text' \| 'select', cellTemplate? }`) | `[]` | |
| `loading` | `boolean` | `false` | |
| `searchPlaceholder` | `string` | `shared.table.searchPlaceholder` («Search...») | |
| `emptyMessage` | `string` | `shared.table.empty` («No data available») | |
| `paginated` | `boolean` | `true` | |
| `showToolbar` | `boolean` | `true` | |
| `filterPosition` | `'left' \| 'right'` | `'left'` | |
| `showActions` / `showEditAction` / `showDeleteAction` | `boolean` | `true` | |
| `trackByKey` | `string` | `'id'` | |
| `actionsLabel` | `string` | `shared.table.actions` («Actions») | |
| `actionsPosition` | `'start' \| 'end'` | `'end'` | |
| `toggleDetailsLabel` | `string` | `shared.table.toggleDetails` («Show or hide the row details») | |
| `rowReveal` | `boolean` | `true` | |
| `collapseWidth` | `number` (px) | `767` | |
| `variant` | `'clean' \| 'zebra' \| 'bordered' \| 'emphasis-header' \| 'banded' \| null` | `null` (theme) | |

Outputs: `editClicked: SolDataTableRow`, `deleteClicked: SolDataTableRow`.
Content: `[tableFilters]` and `[tableActions]` slots; `<ng-template #rowActions let-row>` replaces the action buttons.

```html
<sol-data-table [data]="people()" [columns]="columns" searchPlaceholder="Search…" actionsLabel="Actions"
                (editClicked)="edit($event)" (deleteClicked)="remove($event)">
  <sol-button tableActions size="sm" (clicked)="create()">New</sol-button>
</sol-data-table>
```
```ts
columns: DataTableColumn[] = [
  { key: 'name', label: 'Name', sortable: true, filter: 'text' },
  { key: 'status', label: 'Status', badge: true, filter: 'select' },
];
```

#### `sol-virtual-scroll` — `SolVirtualScrollComponent`
Windowed list with variable heights; chat-oriented (follows output, loads history at top). Requires an `<ng-template>` child (context `$implicit`, `index`) and a sized container.

| Input | Type | Default | Req |
|---|---|---|---|
| `items` | `readonly T[]` | — | yes |
| `itemKey` | `(item: T, index: number) => string \| number` | `(_, i) => i` | |
| `estimatedItemHeight` | `number` | `56` | |
| `bufferPx` | `number` | `240` | |
| `followOutput` | `boolean` | `true` | |
| `nearTopThreshold` | `number` | `120` | |

Outputs: `nearTop: void`, `atBottomChange: boolean`.

```html
<sol-virtual-scroll [items]="messages()" [itemKey]="byId" [estimatedItemHeight]="64" (nearTop)="loadOlder()">
  <ng-template let-msg let-index="index"><app-message [message]="msg" /></ng-template>
</sol-virtual-scroll>
```

#### `sol-chart` — `SolChartComponent`
Chart.js wrapper themed from `--sol-*`; re-renders on light/dark.

| Input | Type | Default | Req |
|---|---|---|---|
| `type` | `'line' \| 'bar' \| 'doughnut' \| 'sparkline'` | — | yes |
| `data` | `SolChartData` (`{ labels: string[]; series: { label, data: number[], color? }[] }`) | — | yes |
| `options` | `SolChartOptions` (`{ legend?, yMax? }`) | `{}` | |
| `ariaLabelKey` | `string` (i18n key) | — | yes |
| `height` | `string` | `'260px'` | |

```html
<sol-chart type="line" ariaLabelKey="pages.dashboard.revenue" [data]="{ labels: months, series: [{ label: '2026', data: revenue }] }" />
```

#### `sol-timeline` — `SolTimelineComponent`
Gantt-like hierarchy on a month axis; undated nodes listed apart.

| Input | Type | Default | Req |
|---|---|---|---|
| `nodes` | `TimelineNode[]` (`{ id, label?, labelKey?, start?, end?, status?, children?, collapsed? }`) | — | yes |
| `statusToken` | `SolTimelineStatusResolver \| null` (`(status) => cssColor`) | `null` (`defaultStatusToken`: done/completed/closed, active/in progress, blocked, at risk, pending) | |
| `legend` | `TimelineLegendItem[]` (`{ status, labelKey }`) | `[]` | |
| `collapsible` | `boolean` | `true` | |

Outputs: `nodeToggled: { id, collapsed }`, `nodeClicked: TimelineNode`.

```html
<sol-timeline [nodes]="plan()" [legend]="[{ status: 'done', labelKey: 'pages.plan.done' }]" (nodeClicked)="open($event)" />
```

---

### Planning

#### `sol-kanban-board` — `SolKanbanBoardComponent`
Columns with CDK drag and drop (mouse, touch, keyboard “Move to…”), optimistic mirror and `rollback()`.

| Input | Type | Default | Req |
|---|---|---|---|
| `columns` | `KanbanColumn<T>[]` (`{ id, title?, titleKey?, items: T[], accent?, droppable?, terminalAnchor? }`) | — | yes |
| `cardTemplate` | `TemplateRef<{ $implicit: T; item: T }>` | — | yes |
| `headerTemplate` | `TemplateRef<{ $implicit: KanbanColumn }> \| null` | `null` | |
| `anchorTemplate` | `TemplateRef<{ $implicit: KanbanColumn }> \| null` (shown when `terminalAnchor`) | `null` | |
| `emptyTemplate` | `TemplateRef<unknown> \| null` | `null` | |

Outputs: `itemMoved: KanbanItemMoved<T>` (`{ item, fromColumnId, toColumnId, previousIndex, currentIndex }`), `columnAction: KanbanColumnAction`, `addRequested: string` (column id), `externalItemDropped: { toColumnId, data }`. Public method: `rollback()`.

```html
<ng-template #card let-task><p>{{ task.title }}</p></ng-template>
<sol-kanban-board #board [columns]="columns()" [cardTemplate]="card" (itemMoved)="persist($event, board)" (addRequested)="create($event)" />
```
```ts
async persist(move: KanbanItemMoved<Task>, board: SolKanbanBoardComponent<Task>) {
  try { await this.api.move(move); } catch { board.rollback(); }
}
```

#### `sol-kanban-column` — `SolKanbanColumnComponent`
One column (normally rendered by the board).

| Input | Type | Default | Req |
|---|---|---|---|
| `column` | `KanbanColumn<T>` | — | yes |
| `cardTemplate` | `TemplateRef<KanbanCardTemplateContext<T>>` | — | yes |
| `headerTemplate` / `anchorTemplate` / `emptyTemplate` | as board | `null` | |
| `allColumns` | `KanbanColumn<T>[] \| null` (targets for keyboard moves) | `null` | |

Outputs: `action: KanbanColumnAction`, `dragActiveChanged: boolean`, `itemDropped: KanbanRawDropEvent`.

```html
<sol-kanban-column [column]="{ id: 'todo', title: 'To do', items: tasks, droppable: false }" [cardTemplate]="card" />
```

#### `sol-kanban-card` — `SolKanbanCardComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `item` | `T extends KanbanItem` (`{ id }`) | — | yes |
| `cardTemplate` | `TemplateRef<KanbanCardTemplateContext<T>>` | — | yes |

Outputs: `dragActiveChanged: boolean`.

```html
<sol-kanban-card [item]="task" [cardTemplate]="card" />
```

#### `sol-kanban-drag-source` — `SolKanbanDragSourceComponent`
External list whose items can be dropped into a board’s columns (board emits `externalItemDropped`).

| Input | Type | Default | Req |
|---|---|---|---|
| `items` | `T[]` | — | yes |
| `itemTemplate` | `TemplateRef<{ $implicit: T }>` | — | yes |
| `connectedTo` | `string[]` (column ids) | `[]` | |
| `disabledIds` | `ReadonlySet<string \| number>` | `new Set()` | |
| `listId` | `string` | `'sol-kanban-drag-source'` | |

```html
<sol-kanban-drag-source [items]="backlog()" [connectedTo]="['todo', 'doing']" [itemTemplate]="card" />
```

#### `sol-calendar` — `SolCalendarComponent`
Week/day agenda = header + grid + optional legend.

| Input | Type | Default | Req |
|---|---|---|---|
| `events` | `SolCalendarEvent[]` (`{ id, start, end, title, color?, data? }`) | — | yes |
| `view` | `'week' \| 'day'` | — | yes |
| `currentDate` | `Date` | — | yes |
| `eventTemplate` | `TemplateRef<{ $implicit: T; event: T }> \| null` | `null` | |
| `legend` | `SolCalendarLegendItem[]` (`{ color, labelKey }`) `\| null` | `null` | |

Outputs: `eventClicked: T`, `slotClicked: { date: Date; time: string }`. `color` accepts hex, functional colors or `var(--sol-*)`.

```html
<sol-calendar [events]="appointments()" view="week" [currentDate]="today" (slotClicked)="book($event)" (eventClicked)="open($event)" />
```

#### `sol-calendar-header` — `SolCalendarHeaderComponent`
| Input | Type | Default | Req |
|---|---|---|---|
| `currentDate` | `Date` | — | yes |
| `view` | `'week' \| 'day'` | — | yes |

Outputs: `dateChange: Date`, `viewChange: SolCalendarView`.

```html
<sol-calendar-header [currentDate]="date()" [view]="view()" (dateChange)="date.set($event)" (viewChange)="view.set($event)" />
```

#### `sol-calendar-grid` — `SolCalendarGridComponent`
Same inputs/outputs as `sol-calendar` minus `legend`.

```html
<sol-calendar-grid [events]="events()" view="day" [currentDate]="date()" [eventTemplate]="eventTpl" />
```

#### `sol-flow-canvas` — `SolFlowCanvasComponent`
Pan/zoom node graph: drag nodes, connect ports, keyboard moves with live announcements, “Arrange” auto-layout (dagre, lazy).

| Input | Type | Default | Req |
|---|---|---|---|
| `nodes` | `SolFlowCanvasNode[]` (`{ id, label, kind, position: { x, y }, visualState?: 'idle' \| 'running' \| 'ok' \| 'error', badges?, metadata? }`) | `[]` | |
| `edges` | `SolFlowCanvasEdge[]` (`{ id, sourceId, targetId, kind: 'condition' \| 'intent' \| 'always', label?, priority? }`) | `[]` | |
| `readonly` | `boolean` | `false` | |
| `selectedId` | `string \| null` | `null` | |
| `highlightedNodeId` | `string \| null` | `null` | |
| `nodeTemplate` | `TemplateRef<{ $implicit, node, selected, highlighted }> \| null` | `null` | |

Outputs: `nodeMoved: { id, position }`, `nodeSelected: { id }`, `connectionCreated: { sourceId, targetId }`, `connectionRemoved: { id }`. The host owns positions and edges.

```html
<div style="height: 400px">
  <sol-flow-canvas [nodes]="nodes()" [edges]="edges()" (nodeMoved)="move($event)" (connectionCreated)="connect($event)" />
</div>
```

---

### Secondary entry points (not demoed in the showcase)

- `@solercia/ui/theme-studio`: `sol-theme-studio`, `sol-theme-studio-preview`, token `THEME_STUDIO_STORE`
  (host store contract), catalogs `SOL_THEME_STUDIO_I18N_EN` / `SOL_THEME_STUDIO_I18N_ES_CO`, form/theme
  helpers (`buildThemeFile`, `mapThemeFileToForm`, `parseThemeJson`, …). See `docs/THEME-STUDIO.md`.
- `@solercia/ui/login-appearance`: `sol-login-frame`, `sol-login-brand`, `sol-login-scene`, `sol-login-photos`,
  `sol-login-shapes`, `sol-login-panel-background`, `sol-login-preview`, `sol-login-appearance-editor`, plus
  `resolveLoginView`, `normalizeLogin`, `normalizeLoginAppearance`, catalogs
  `SOL_LOGIN_APPEARANCE_I18N_EN` / `SOL_LOGIN_APPEARANCE_I18N_ES_CO`. See [Themed sign-in](#themed-sign-in-solerciauilogin-appearance).

## Showcase

```bash
npm ci
npm start   # builds the library and serves the showcase on http://localhost:4200
```

The showcase is also the reference integration: zoneless bootstrap, `provideTheme()`, a `THEME_SOURCE`
adapter and a `SolI18n` engine that merges the bundled English and Spanish catalogs with its own keys
([`app.config.ts`](./projects/showcase/src/app/app.config.ts)). Each page shows live variants, sizes and
states with a collapsible code snippet, in light and dark mode, down to 390 px.

## For AI coding agents

If you are an AI agent building UI with this library:

1. **Reuse before you build.** Check [Components at a glance](#components-at-a-glance) first; do not
   hand-roll a button, table, modal, date picker or chart that already exists.
2. **Style only with tokens.** Use `var(--sol-*)` for color, typography, spacing and radius. Never
   hardcode colors or fonts, never use `!important` or `::ng-deep`. The
   [`@solercia/eslint-config`](https://github.com/solercia-solutions/eslint-config) preset enforces it.
3. **Respect required inputs** (marked **Req**) and give every icon-only control an `ariaLabel`.
4. **Wrap engines, don't import them.** Use `<sol-chart>` instead of Chart.js and `sol-kanban-*` instead of
   `@angular/cdk` drag and drop.
5. **Cover every state.** Loading (`sol-skeleton`, `sol-spinner`), empty (`sol-empty-state`), error and
   success are part of each screen.
6. Look at the matching page in `projects/showcase/src/app/pages/` for a working example.

A machine-readable summary is available in [`llms.txt`](./llms.txt).

## Development

```bash
npm ci
npm test               # builds the library and schematics, then runs Vitest (zoneless)
npm run build          # dist/solercia/ui
npm run build:showcase # library + showcase
```

Text-asserting tests use the library's own catalogs, `projects/solercia/ui/i18n/en.json` and `es-CO.json`
(add every new `shared.*` key to both; `catalog-*.ts` mirror them and a spec keeps them in sync).
Rebuilding the library while `ng serve showcase` runs deletes `dist/solercia/ui`: restart the dev server.

### Releasing

1. Bump `version` in `projects/solercia/ui/package.json` and add the entry to
   [`CHANGELOG.md`](./projects/solercia/ui/CHANGELOG.md).
2. Validate: `npm run build && cd dist/solercia/ui && npm publish --dry-run`.
3. Push a tag `v<version>`. `.github/workflows/publish.yml` checks that the tag matches the version and
   publishes with npm Trusted Publishing (OIDC, no token) and provenance. The package's Trusted Publisher
   on npmjs.com is organization `solercia-solutions`, repository `solercia-ui`, workflow `publish.yml`;
   `ENEEDAUTH` means one of the three does not match.

## Related packages

- [`@solercia/eslint-config`](https://github.com/solercia-solutions/eslint-config) — architecture and styling lint rules.
- [`@solercia/chat`](https://github.com/solercia-solutions/solercia-chat) — embeddable AI assistant chat.

## License

[Apache-2.0](./LICENSE) © 2026 Solercia Solutions SAS. See [`NOTICE`](./projects/solercia/ui/NOTICE).

# Changelog — @solercia/ui

All notable changes to this package are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versioning follows
[SemVer](https://semver.org/). The package started at `0.1.0`; while it is pre-1.0 and has only a
few consumers, `minor` versions may include breaking changes.

## [0.8.1] - 2026-11-25

### Fixed

- `chart.js` no longer lands in the initial bundle of apps that do not render `sol-chart`. The
  `Chart.register()` call ran at module load, a side effect that kept chart.js in every app importing
  anything from `@solercia/ui`; it now runs once, lazily, when the first chart is created. Measured
  with an Angular production build of an app that only imports `SOL_I18N`: initial bundle from
  305.8 kB to 115.4 kB.

## [0.8.0] - 2026-11-25

### Changed

- **English is the default language.** Without a `SOL_I18N` provider, `SOL_I18N` is now an English
  engine backed by the bundled catalog (it used to be an identity engine with `activeLang` `es-CO`), and
  every visible default goes through a `shared.*` key: `sol-data-table` (`searchPlaceholder`,
  `emptyMessage`, `actionsLabel`, `toggleDetailsLabel`, column filter «All»), `sol-search-input`,
  `sol-select` (`placeholder`, `allOptionLabel`, `searchPlaceholder`, `emptyLabel`, All/None buttons),
  `sol-confirm-dialog` (`title`, `confirmLabel`, `cancelLabel`), `sol-file-upload` (`label`, `hint`,
  preview texts and validation messages), `sol-modal`, `sol-pagination`, `sol-wizard` and
  `sol-progress-bar`. `@solercia/ui/theme-studio` and `@solercia/ui/login-appearance` also default to
  English (`es*` languages keep Spanish). `sol-star-rating` formats the value with the active locale.
- **Behavior change for hosts without a catalog:** a host that relied on the hard-coded Spanish
  defaults now sees English. To keep Spanish, provide
  `{ provide: SOL_I18N, useFactory: () => createSolI18n({ lang: 'es-CO' }) }`, or merge
  `SOL_I18N_ES_CO` (`@solercia/ui/i18n/es-CO.json`) into your engine. A host engine whose
  `activeLang()` starts with `es` keeps Spanish even for keys it does not know: unknown `shared.*` keys
  fall back to the bundled catalog of the active language. Explicit inputs always win.
- Those text inputs now default to `undefined` (type `string | undefined`) instead of a literal; an
  explicit value, including `''`, is rendered as given.

### Added

- Bundled catalogs `SOL_I18N_EN` and `SOL_I18N_ES_CO` (type `SolI18nCatalog`), also shipped as
  `@solercia/ui/i18n/en.json` and `@solercia/ui/i18n/es-CO.json` to merge into Transloco or ngx-translate.
- `createSolI18n({ lang?, catalogs? })`: catalog-backed `SolI18n` engine with `setLang(lang)`.
- New `shared.*` keys: `modal`, `confirmDialog`, `searchInput`, `select`, `fileUpload`, `pagination`,
  `wizard`, `progressBar` and `table.searchPlaceholder|empty|actions|filterAll`.
- `ariaLabel` input on `sol-modal` and `sol-drawer`, used as the accessible name when there is no title.

### Fixed

- `sol-modal` is now an accessible modal dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
  bound to the title (or `aria-label`), focus moves inside on open and is trapped (Tab/Shift+Tab), focus
  returns to the previously focused element on close, the page scroll is locked while open, and the
  close button has an i18n label (it was a hard-coded «Cerrar»). No empty heading without a title.
- `sol-confirm-dialog`: `role="alertdialog"` moved to the panel with `aria-labelledby`/`aria-describedby`,
  focus starts on Cancel, is trapped and restored, and the page scroll is locked while open.
- `sol-pagination`: the page-size label is tied to its select and the previous/next buttons have labels.

## [0.7.2] - 2026-11-24

### Added

- `AGENTS.md` (with `CLAUDE.md` symlink) for AI coding agents: commands, conventions and the rule that
  every commit on `main` is a tagged release. No changes to the published code.

## [0.7.1] - 2026-11-24

The repository moved to [solercia-solutions/solercia-ui](https://github.com/solercia-solutions/solercia-ui)
as a standalone open-source workspace. No changes to the library code or its public API.

### Added

- Component showcase application (`projects/showcase`, `npm start`) with a live demo of every public
  component in light and dark mode.
- English README with the full component reference and a guide for AI coding agents, plus `llms.txt`.

### Changed

- The library is tested zoneless, as Angular 22 runs by default; zone.js is no longer a workspace
  dependency. Three calendar and kanban specs now resolve their templates before the component under
  test, which removes the `NG0950` errors seen without zone.js.
- Documentation and changelog translated to English.

## [0.7.0] - 2026-11-14

Login appearance customizable from the theme, full keyboard support and a controlled mode in
`sol-select`, and mobile adjustments. Everything is additive relative to 0.6.1: without enabling the
new option, `<sol-theme-studio>` looks and behaves the same.

### Added

- `sol-select`: full keyboard support (arrows, Home, End, Enter, Esc, Tab) with an active option and
  `aria-activedescendant`, with and without the search box; `role="option"` and `aria-selected` on
  the options, `aria-haspopup="listbox"` on the button; focus returns to the button when closing
  with the keyboard or after choosing.
- `sol-select`: optional inputs `ariaLabel`, `searchPlaceholder` and `emptyLabel` (defaulting to the
  existing texts), and a controlled mode `[value]` + `(valueChange)` that renders the value from the
  first render, including in prerendered HTML.

- `@solercia/ui/login-appearance` entry point:
  - The theme's `meta.login` contract and `normalizeLoginAppearance`: default values, closed lists,
    safe image and logo URLs (`https://`, `/…` or `assets/…`, PNG, JPEG, WebP or AVIF only) and the
    default login mode.
  - `<sol-login-frame>`: themed login frame (scene, rotating photos, shapes, panel background, brand
    with a per-mode logo, and tagline). The application places its own form inside it with
    `ng-content`; the library ships no authentication logic or HTTP calls.
  - `<sol-login-appearance-editor>`: appearance editor with a live preview.
- `@solercia/ui/theme-studio`: `features.loginAppearance` option (off by default) that adds the
  "General appearance" and "Login" tabs; `meta.login` is saved with "Apply theme" and is accepted
  when importing JSON.

### Changed

- `<sol-select>` on touch screens opens as a bottom sheet (full width, up to 70% of the height, 44 px
  options, 16 px font, and respecting the iPhone home indicator) and does not focus the search box
  on open, so the keyboard does not cover the list: focus stays on the list.
- `sol-select`: an option with value `''` is shown by its name instead of the placeholder; `label`
  is associated with the button (`for`); the search ignores accents; options grow to 44 px tall on
  mobile; the options' `hover` is also visible in dark mode.
- `solFloatingPanel`: the panel inherits its trigger's `--sol-z-modal`, so it stays above a sheet
  that has raised it.

### Fixed

- `sol-data-table`: the host becomes `display: block`. The collapse to cards measures the host's
  width with `ResizeObserver`, which reports 0 on an inline element, so the table also collapsed on
  desktop when its container was neither flex nor grid.

## [0.6.1] - 2026-10-02

Full parity of `<sol-theme-studio>` with PANDORA's Theme Studio, from which it was ported. This was
verified with a side-by-side harness over the same data: 88 screenshot pairs (1440×900 and
390×844, light and dark: initial state, each section, history and its second page, restore dialog,
invalid JSON error, floating button and side panel) with 0 differing pixels, and a functional
walkthrough with the same calls and the same payloads. Everything is additive relative to 0.6.0.

### Added

- `SolConfirmDialogComponent` (`<sol-confirm-dialog>`): confirmation dialog with an icon per variant
  (`danger` | `warning` | `info`); Escape and a click on the backdrop cancel it.
- `SolRevealDirective` (`[solReveal]`): scroll-triggered entrance animation driven by the theme's
  motion tokens (`--sol-reveal-name`, `--sol-dur-slow`, `--sol-ease-entrance`), with index-based
  stagger and replay. It injects its global keyframes only once (with the `CSP_NONCE` nonce if
  present).
- `@solercia/ui/theme-studio`:
  - `features` input (`SolThemeStudioFeatures`) with optional sections and behaviors:
    `themeName` (default `true`), `loader` ("Loader / spinner" section in `meta.loader`, with its
    sample in the preview), `tableVariantMetaKey` (mirrors the table variant into a `meta` key) and
    `persistDefaultModeOnApply` (stores the default mode as the browser preference on apply).
  - Inputs `metaExtrasSchema`, `footerPlaceholder`, `exportFileName`, `versionTimeZone` and
    `versionTimeZoneLabel`; CSS variable `--sol-theme-studio-bottom-inset`.
  - `ThemeStudioStore.apply` can emit the persisted theme: the screen pushes it with
    `ThemeService.setTenantTheme` (without fetching it again) and warns if it is not renderable.
  - Store errors show the backend's message (`error.message`, `error.errors[0].message` or
    `userMessage`); the rule is exported as `extractStoreErrorMessage`.
  - `SolThemeStudioNotice.kind` supports `warning` (image over 2 MB, invalid hex, clipboard
    unavailable).
  - `parseThemeJson` accepts `metaExtrasSchema`, `loader` and `tableVariantMetaKey`;
    `ThemeImportError.pathVisible` indicates when the path points to the exact field to fix.
  - Loading-indicator model: `ThemeLoaderConfig`, `DEFAULT_LOADER_CONFIG`,
    `STUDIO_LOADER_PRESENTATIONS`, `STUDIO_LOADER_ANIMATIONS`.

### Changed

- `<sol-theme-studio>` uses the original's markup, styles and texts: cards with an entrance
  animation, its own side panel below 1024 px (instead of `sol-drawer`) that closes with Escape,
  `sol-confirm-dialog` (instead of `sol-modal`), history with `medium` date and time, an
  always-present JSON status line, and a footer of up to 200 characters. Importing and previewing a
  version no longer emit `notify`: they are reported on the status line, as in the original.
- The es-CO texts are the original's (except `preview.footerFallback`, `table.hint` and
  `loader.hint`, which stay generic); the history and JSON texts keep the original's formal
  second-person ("usted") form of address.
- After applying, the imported draft or restored version remains the editor's base: its unedited
  tokens carry through intact into whatever is exported or applied again.
- The color chosen with the picker or a suggestion is stored as is (not converted to uppercase), as
  in the original.

### Fixed

- The 2 `ThemeService` tests on `meta.defaultMode` expected the saved preference to win; the code
  (the DB mode wins on each load and is synchronized to `localStorage`) is the correct behavior and
  the one PANDORA depends on. The tests and the documentation of `setTenantTheme` and
  `setDarkMode` were fixed.

### Notes

- The preview's side panel uses `--sol-dur-normal`, which `EMIT_TABLE` does not emit: as in the
  original, it appears without sliding. It is kept this way for parity.

## [0.6.0] - 2026-10-01

Stable release. It includes everything in `0.6.0-rc.1` (below) plus what PANDORA, the first
external consumer, built or patched outside the library. Everything is additive except the note
under "Changed".

### Added

- **`@solercia/ui/theme-studio` secondary entry point** (apps that do not import it do not load it):
  - `<sol-theme-studio>`: full visual theme editor — shared and per-mode (light/dark) controls,
    isolated preview (variables are applied to the preview host, never to `:root`), apply with
    confirmation (`sol-modal`), paginated history with version restore, JSON import and export,
    logo and favicon upload. Inputs `baseTheme` and `metaExtras`; outputs `applied` (saved theme)
    and `notify` (`SolThemeStudioNotice`; the app decides how to show it). Loading, legitimate-empty,
    error-with-retry and success states.
  - `ThemeStudioStore` persistence contract + `THEME_STUDIO_STORE` token, with the `ThemeVersion`
    and `ThemeVersionPage` types. The optional methods (`listVersions`, `getVersion`,
    `uploadLogo`) turn their section off if the host does not implement them.
  - Headless core with no Angular injection: `buildThemeFile(form, baseTheme?, metaExtras?)`,
    `mapThemeFileToForm`, `deepMerge`, `parseThemeJson` (256 KB limit, depth 20, blocks
    `__proto__`, `url(`, `javascript:`, `@import`, `expression(`, markup and asset URLs that are
    neither https nor relative; extra brand colors in hex only) and `mergeThemeEditorChanges`.
  - `parseThemeJson` throws `ThemeImportError` with a translatable `ThemeImportErrorCode` instead
    of hardcoded Spanish messages.
  - Texts via `SOL_I18N` with `sol.themeStudio.*` keys; built-in fallbacks in es-CO (informal
    second-person form) and en, exported as `SOL_THEME_STUDIO_I18N_ES_CO` and `SOL_THEME_STUDIO_I18N_EN`.
- Theme contract (main entry point):
  - `ThemeMeta.name?` (template name, metadata only) and `ThemeMeta.favicon?` (sanitized with
    `sanitizeAssetUrl`; with no value or an unsafe URL, the favicon follows the logo as before).
    `ThemeService.tenantFavicon` exposes the effective URL.
  - `component.table.variant` (`SolTableVariant`: `clean` | `zebra` | `bordered` |
    `emphasis-header` | `banded`) and the `SOL_TABLE_VARIANTS` catalog.
  - `semantic.color.primaryContrast?` → `--sol-color-primary-contrast` (default `#FFFFFF`). The
    emit table grows to 96 variables.
  - `semantic.color.secondaryContrast?` is now declared in the type (`EMIT_TABLE` already emitted
    it).
  - `SOL_BUNDLED_DEFAULT_THEME`: the bundled theme as a constant (factory value of
    `SOL_DEFAULT_THEME` and default base of the builder).
- `sol-data-table`: `variant` input that overrides the theme's `component.table.variant`. Each
  variant's styles live in the component and use only `var(--sol-*, fallback)`; without a variant
  the table keeps its usual look.
- `sol-select`: `mobileBreakpoint` input (default `640`). It extends the iOS anti-zoom protection
  (16 px on the trigger and the search box) to hosts whose mobile layout breaks higher up (e.g.
  768).

### Changed

- `ThemeTableComponent.mobile` becomes optional so a theme can declare only `variant`. Code that
  read `table.mobile` already had to treat the block as optional (`table?`); the default remains
  `collapse`.

### Fixed

- The package includes `schematics/` again (the `0.6.0-rc.1` tarball was generated without
  `npm run build:schematics`, even though `package.json` declares `schematics` and `ng-update`).

## [0.6.0-rc.1] - 2026-09-01

> Prerelease (`-rc.1`): published as a local tarball so PANDORA, the first external consumer of
> `@solercia/ui`, could test it before the final publication to npm. Everything below is additive —
> no existing input or type changes in an incompatible way.

### Added

- `sol-data-table` (`ui/data-table/data-table.component.ts`):
  - Input `actionsPosition: 'start' | 'end'` (default `'end'`, breaks nobody): moves the actions
    th/td (the projected `#rowActions` and the default edit/delete buttons) to the first column
    instead of the last. No effect in the mobile collapsed mode — there the actions still live only
    in the card's expanded detail, as always.
  - Per-column filters, opt-in (`DataTableColumn.filter: 'text' | 'select'`): when at least one
    column declares it, a row of controls appears under the header
    (`sol-data-table__filters-row`), hidden in the mobile collapsed mode. `'text'` filters by
    case-insensitive containment; `'select'` fills a native `<select>` with the unique options from
    that column's current `data` (sorted, with an empty option = "All") and filters by exact
    equality. Both criteria combine (AND) with each other and with the existing global search of
    `filteredData`, always client-side.
  - Input `collapseWidth: number` (default `767`, the same breakpoint as before) — see the change
    in the source of truth for the mobile collapse under "Changed".
- `sol-icon-button` (`ui/icon-button/icon-button.component.ts`): `outline` variant — the same
  border and text color as `default`, but with a transparent background, so a group of action
  icon-buttons looks uniform (all with an outline) without each one carrying its own solid surface
  competing with its neighbor.
- `ICON_REGISTRY`: `arrow-down-tray`, `book-open`, `light-bulb`, `hand-thumb-up`,
  `presentation-chart-line`, `printer`, `folder` and `folder-open` (Heroicons v2.1.5, MIT — `d`
  copied unedited, outline and solid for all eight).
- `sol-rating-input` (`ui/rating-input/rating-input.component.ts`): INTERACTIVE 1-to-5 star rating,
  so a customer can rate her appointment. It is a **separate** component from `sol-star-rating`,
  which stays untouched and read-only: displaying a value and capturing one are different
  accessibility contracts — the read-only one is a `role="img"` with the value in the `aria-label`
  and `aria-hidden` stars, while this one is a `role="radiogroup"` with five `role="radio"`,
  `aria-checked` per star, keyboard navigation and a single tab stop. Putting both behaviors in one
  class behind a flag would force toggling role, focus, tabindex and semantics on every star, and
  would degrade both.
  - **It starts with no value, on purpose**: `value` begins as `null` and no star is checked. This
    is the ethical limit of the "default values" principle: a pre-checked rating anchors the answer
    and serves the business, not the person answering — if it starts at 5, the average goes up
    without anyone having decided it and the data stops measuring the experience. A radiogroup with
    no option checked is valid in ARIA. This is documented in the class JSDoc.
  - Full `ControlValueAccessor`, like the rest of the library's controls. Unlike `sol-select` and
    `sol-number-input` —which leave `setDisabledState` empty— here the form **does** take control:
    a `control.disable()` truly disables the control. The `disabled` input still works; the
    effective state is the union of both.
  - Keyboard: `←`/`↑`/`→`/`↓` move focus and check (radiogroup pattern), without wrapping at the
    ends —`←` on the first star checks it, which is the only way to choose "1" with the keyboard
    from the empty group—; `Home`/`End` jump to the ends and check; `Space` checks the focused star;
    `Delete`/`Backspace` clear when `allowClear` is enabled.
  - States: normal, `disabled` (`aria-disabled`, no focus), `readOnly` (`aria-readonly`, value
    frozen but with full contrast and focusable — "this can no longer be changed" is not the same as
    "this is not for you") and `error` (visible message with the same text contract as `sol-input`,
    plus `aria-invalid` and `aria-describedby`).
  - The hover preview paints the stars but never touches `value` or `aria-checked`: when the pointer
    leaves, the chosen value returns, so hovering never loses the answer.
  - `allowClear` (optional) enables removing the rating with a visible button —outside the
    radiogroup, so as not to break the single tab stop— and with `Delete`/`Backspace`.
  - Each star reserves a real 44×44 px touch area (Fitts's law) because it is used from mobile
    phones; that is why the default size is `lg` and not the `sm` of the read-only component.
  - Styles use only `var(--sol-*)` tokens (chosen star on `--sol-color-warning`, unchosen on
    `--sol-color-text-muted`, error on `--sol-color-danger`), without a single hardcoded color, and
    respect `prefers-reduced-motion`. Icons go through `<sol-icon>` (`star`, `x-mark`), never inline
    markup.
  - `normalizeRating` is also exported, the pure function that clamps any input to `1..5` or
    `null`: a `0`, a `NaN` or an `undefined` mean "unanswered", not "zero stars".
- i18n keys `shared.ratingInput.{groupLabel,option,clear}` in the consumer application's `es-CO`
  catalog. All three can be overridden per input (`ariaLabelKey`, `optionLabelKey`,
  `clearLabelKey`) and all three have their own es-CO fallback in the component, so a host that does
  not translate announces "3 of 5" rather than the raw key.

### Changed

- `sol-data-table`: the collapse to cards on mobile NO longer decides by the browser viewport
  (`matchMedia`) but by the width of the host element itself, measured with `ResizeObserver` (new
  `collapseWidth` input, see "Added"). A table inside a narrow container (sidebar, two-column grid)
  now collapses even if the browser window is still at desktop width. `matchMedia` against the
  canonical breakpoint (767px) is kept only as an initial anti-flicker value until the observer's
  first real measurement.

### Fixed

- `sol-card` (`ui/card/card.component.ts`): adds `:host { display: block; }`. The component declared
  no `display` of its own, so its host collapsed to `max-content` when the parent made it a
  flex/grid item — the border and background of `.sol-card` were still painted at full size, but the
  host's actual box did not reserve space, and a flex layout with several `sol-card` children came
  out broken (a real bug reported from PANDORA).

## [0.5.0] - 2026-08-23

First batch of contributions that come **from a consumer**: the three components were born inside
Solercia Command and are contributed here without their domain. The cutoff criterion is the same
for all three: **the mechanism belongs to the library, the orchestration stays in the application**.
That product's own UI audit already had them listed as "pending contribution to the library".

### Added

- `sol-tree` (`ui/tree/tree.component.ts`): generic hierarchical tree with a recursive node, native
  ARIA (`tree`/`treeitem`/`group`, `aria-expanded`, `aria-level`), roving tabindex and a full
  keyboard map (arrows, Home/End, Enter/Space). Each node's content is provided by the consumer via
  `ng-template` through `SolTreeNodeDefDirective` (`[solTreeNodeDef]`), with a typed context
  `{ $implicit, node, depth, expanded, hasChildren }`. `expandedIds` is a dual-mode `model()`:
  `null` leaves expansion in the component's hands (seeded by `defaultExpandedDepth`, 1 by default),
  and any array —including `[]`— switches to controlled mode; the distinction exists to separate
  "do not control me" from "everything collapsed". The seed is recomputed from a structural key of
  ids, so recreating `nodes` with the same content does not erase what the user already expanded.
  Depth is bounded by `SOL_TREE_MAX_DEPTH` (5). It emits `nodeSelected` and `nodeToggled` instead
  of navigating: the library does not know the router.
- `sol-notification-panel` (`ui/notification-panel/notification-panel.component.ts`): notification
  panel with `items` as an input and zero injected services. Its `state()` is an exclusive, ordered
  `computed()` — `loading` › `error` › `empty` › `content` — with `error` **before** `empty` on
  purpose: a failed load also leaves the list empty, and if `empty` won the panel would claim "you
  have no notifications" when the truth is "we could not find out". The error is rendered with its
  own structure and `role="alert"`, never by recycling `sol-empty-state`. It emits `itemSelected`,
  `markedRead`, `markedAllRead`, `retryRequested` and `closed`; it keeps no internal mirror of
  `read`, so the interface never claims a change the backend rejected.
- `sol-scope-switcher` (`ui/scope-switcher/scope-switcher.component.ts`): active-scope selector
  (company, organization, site) built on the shared `solFloatingPanel` directive. It lists scopes
  with a label and a secondary label, resolves the avatar by `imageUrl` or by initials, and
  distinguishes `idle`/`loading`/`error` as separate states while keeping the previous context when
  something fails. With a single scope it shows it as active without forcing a choice.
  `effectiveActiveId` validates that the received id exists in the list before using it and falls
  back to the first one if not: a persisted id that was no longer valid left the trigger blank. It
  emits `scopeSelected` and `openChange`; persistence, context refresh and any HTTP headers are the
  host's responsibility.
- `ICON_REGISTRY`: `arrow-left`, `arrow-right-on-rectangle` and `flag` (Heroicons v2, `d` copied
  unedited). They close the gap that Solercia Command had documented in its UI audit, where they
  survived as inline SVG because they did not exist here. `sitemap`, also requested by that audit,
  is **not** added: it does not exist in Heroicons v2 and the registry header forbids inventing path
  data.

### Upgrade notes

- Solercia Command maintains a local `SolDrawerComponent` with the **same class name and the same
  selector** as this library's. Its barrel does `export *` from both sources, so going from 0.3.0
  to 0.5.0 the symbol becomes ambiguous. The local drawer must be deleted in the same change that
  bumps the version. The migration is short: `position="right"` becomes `side="end"`, and the
  `blur` input disappears because here the `--sol-overlay-blur` token handles it.

## [0.4.1] - 2026-08-23

### Added

- `sol-input` (`ui/input/input.component.ts`): optional `min` input (`string | undefined`,
  `undefined` by default), passed through to the native `<input>`'s `min` attribute via
  `[attr.min]`. Its use case is `type="date"`: it sets the minimum selectable date so the browser's
  native picker does not allow scheduling in the past. With `[attr.min]` Angular omits the attribute
  entirely when the value is `undefined`, so no existing consumer changes behavior — the same
  additive pattern as the `autocomplete` input.

## [0.4.0] - 2026-08-08

> Entry reconstructed after the fact (2026-08-23): the version was published to npm without being
> recorded in this file.

### Added

- `sol-star-rating` (`ui/star-rating/star-rating.component.ts`): star rating component, exported
  from the public API (`ui/index.ts`).
- Star icons in `ICON_REGISTRY` (`ui/icon/icon.registry.ts`) consumed by the component above.

## [0.3.1] - 2026-07-20

### Added

- `solFloatingPanel` (`ui/overlay/floating-panel.directive.ts`): shared primitive that portals a
  floating panel to `document.body` with `position: fixed` and manually computed viewport
  coordinates (without `@floating-ui/dom` or `popper.js`, which the project rules out). It comes
  from extracting the fix that lived inline in `sol-select`, so that any component whose panel must
  float ABOVE a `sol-modal` or a `sol-drawer` is not clipped by ancestors with `overflow` or
  `backdrop-filter` (typically `.sol-modal-body`). API: required `trigger` input (alias of the
  selector itself), `gap` (4), `flipThreshold` (300), `matchTriggerWidth` (`true`), `align`
  (`'start'`/`'end'`), a read-only `dropUp` signal + `dropUpChange` output so the host can apply its
  modifier class, and a public `reposition()` method. It contributes the shared `.sol-floating-panel`
  class with `z-index: calc(var(--sol-z-modal, 1050) + 10)`, injected only once into
  `document.head` (the portaled panel no longer inherits from the host, so the `z-index` cannot live
  in component-encapsulated styles).

### Changed

- `sol-select` consumes the directive instead of its inline portal: `attachPanel`/`detachPanel`/
  `positionPanel`, the constructor's `effect` and the `portalPanel` state are removed. Identical
  observable behavior — the 7 portal specs pass untouched. The `z-index` leaves
  `.sol-select__dropdown` and is provided by the shared class.
- `sol-date-picker` migrates its calendar popover to the shared portal (`matchTriggerWidth: false`
  because the calendar has its own 300px width, `align` to the right edge when it does not fit
  toward the right, `flipThreshold` equal to its estimated height of 340px). It keeps the `dropUp`
  flip and gains repositioning on scroll and resize, which it did not have before. The popover is no
  longer a descendant of the host, so click-outside closing and the focus of the active cell
  (roving tabindex) now query the portaled node.

### Notes

- Deliberately narrow scope: the directive applies ONLY to components with an element that floats
  above the modal or `sol-drawer`. `sol-rich-editor` is NOT touched — its popovers are clamped
  inside the host on purpose and do not overflow; neither is `sol-tooltip` (no uses in the
  application).
- Public surface unchanged: the directive is internal to the library (it lives in `ui/overlay/`,
  next to `body-scroll-lock`, `focus-trap` and `overlay-interactions`, which are also not exported
  from `lib/ui/index.ts`) — no external consumer needs it yet.
- Two details of the portal were preserved literally when extracting it, because without them the
  fix stops working: the `scroll` listener uses `{ capture: true }` (scroll events do not bubble,
  and without capture the panel does not learn about `.sol-modal-body`'s scroll), and the
  `removeChild` is guarded by `parentNode === document.body` (Angular may have destroyed the node
  on its own).
- 1280/1280 library tests passing (20 new: 12 for `solFloatingPanel` and 8 for the
  `sol-date-picker` popover portal).

## [0.3.0] - 2026-07-16

### Added

- `sol-drawer`: side panel (drawer / side sheet) at full height (`100dvh`), a sibling of
  `sol-modal` for long forms with collapsible content. `start`/`end` side (`end` = right, default),
  `sm`/`md`/`lg` width via tokens, header with projectable title and close, content with its own
  scroll, projectable footer (`[drawerFooter]`), `role="dialog"` + `aria-modal="true"` +
  `aria-labelledby`, its own focus trap with focus returning to the trigger, body scroll lock, and
  closing via backdrop/Escape/button (backdrop-close defaults to `true`, unlike `sol-modal`). Motion
  via tokens (`--sol-dur-base`/`--sol-ease-entrance`) degrading under `prefers-reduced-motion`.
  Shared overlay (`ui/overlay/`): `overlay-interactions` (pure Escape/backdrop predicates),
  `body-scroll-lock` (a lock with a reference counter) and `focus-trap` (an in-house `Tab` cycle,
  without `@angular/cdk/a11y`) — extracted from `sol-modal` without changing its observable
  behavior (regression specs passing).
- `sol-chip` / `sol-chip-group`: presentational selection atom (emoji, count, removable, disabled,
  size) + CVA container with a single-selection (`radiogroup`/`radio`) or multiple-selection
  (`group`/`checkbox`) policy resolved by a Strategy (`SolChipSelectionStrategy`), roving-tabindex
  with arrows/Home/End, `aria-pressed` vs `aria-checked` depending on role, i18n
  (`shared.chip.remove`).
- `sol-number-input` (`SolNumberInputComponent`, deliberately different from `sol-stepper`, which
  indicates steps): numeric CVA stepper with `min`/`max`/`step`, `role="spinbutton"` +
  `aria-valuemin/max/now`, `−`/`+` buttons disabled at the limit (no wrap), arrows ± one `step` and
  Home/End to the limits, reactive re-clamp if `min`/`max` change at runtime, i18n
  (`shared.numberInput.decrement/increment`).
- `minus` icon added to the registry (`icon.registry.ts`) for the `sol-number-input` buttons.

### Fixed

- Automatic iOS zoom on mobile (`<640px`) in 5 atoms that already used native `<input>`/`<textarea>`:
  `sol-input`, `sol-textarea`, `sol-search-input` (previously 12px via `--sol-font-size-sm`),
  `sol-select` (search box + trigger, visual parity) and `sol-date-picker` (normal and `--sm`
  variants). The fix is encapsulated per atom via `@media (max-width:640px){ font-size:16px }` in
  each component's inline `styles` — without touching the global token `--sol-font-size-base` (a
  tenant contract, which also affects desktop) or the `viewport` in `index.html` (WCAG 1.4.4 is
  preserved).

### Notes

- Curated public surface: `SolChipSelectionStrategy`, `SINGLE_SELECT_STRATEGY` and
  `MULTIPLE_SELECT_STRATEGY` are internal to `chip/` (not exported from `lib/ui/index.ts`) — there is
  no `strategy` input that consumes them yet (YAGNI, no real consumers yet); the component still
  decides the SHAPE of the CVA value (`string` vs `string[]`) directly from `multiple()`.
- Publication to `registry.npmjs.org` was **not executed** for this release (same as `0.2.0`); it
  was only packaged locally (`npm pack`) for consumption via `.tgz` in Solercia Command and to
  validate `ThemeFile`/`EMIT_TABLE` compatibility (no contract changes).
- 1023/1023 library tests passing (1016 from the new additions of
  `sol-chip`/`sol-chip-group`/`sol-number-input` + 7 from the post-review robustness fix on
  focus/CVA/bounds).
- `sol-drawer`: 1070/1070 library tests passing (29 new: 13 for `sol-drawer`, 6 for
  `overlay-interactions`, 6 for `focus-trap`, 4 for `body-scroll-lock`); `sol-modal` keeps the same
  observable behavior after delegating Escape/backdrop to the shared helper (regression specs
  untouched).

## [0.2.0] - 2026-07-16

### Added

- `sol-avatar`, `sol-score-badge`, `sol-trend`, `sol-message-status`: presentational atoms
  (initials + stable color by an 8-tone hash, configurable threshold ≥80/≥50, signed trend, 5
  message states via `sol-icon` without inline SVG).
- `sol-stepper`: new input `navigation:'linear'|'free'` — in `free` any step is navigable
  (actionable CRM pipeline), emitting `stepSelected`; backward compatible with the `0.1.x`
  horizontal API.
- `sol-timeline`: generic N-level hierarchical timeline (it never knows `epic`/`sprint`/the
  consumer's domain), pure positioning engine `positionRows(nodes, range)`, automatic envelope for
  parent nodes without their own dates, collapse/expand with an internal "mirror", no new external
  dependencies.
- `sol-kanban-board` / `-column` / `-card`: generic kanban board with drag and drop. `@angular/cdk`
  as a `peerDependency` encapsulated behind `sol-kanban` (the `no-restricted-imports` lint prevents
  the consumer from importing it directly). Terminal anchors via projected template, a fully
  keyboard-accessible alternative mechanism (a move-card `<select>`) and an `aria-live`
  announcement for each move (real drag or select).
- `sol-calendar`: generic week/day calendar with view parity against the consumer application's
  legacy widget, color resolution via an injectable Strategy (`SOL_CALENDAR_COLOR`, null-object
  default from `event.color`), event body via projected template and a configurable legend (`view`
  is typed only as `'week' | 'day'`).
- `sol-data-table`: `rowActionsTemplate` (`contentChild('rowActions')`), `actionsLabel` and
  `toggleDetailsLabel` consolidated, with the `toggleDetailsLabel` default corrected to match the
  actual text consumers were using.
- Icon registry: +45 Heroicons v2 (outline) entries + 7 custom SVGs
  (`robot`/`gauge`/`plug`/`git-branch`/`webhook`/`state-machine`/`double-check`). An automated gate
  (`icon.registry.spec.ts` + `svg-inline-gate.spec.ts`) prevents adding new inline SVG inside
  `projects/solercia/ui/src/lib/**` (full-content scan, not line by line — it covers
  `<svg>`/`<path>`/`<circle>`/`<polyline>`/`<polygon>`/`<line>`/`<rect>` in any position, excluding
  comments).

### Fixed

- Migration of the library's inline SVG (`pagination`/`modal`/`select`/`search-input`) to `sol-icon`
  from the expanded registry.

### Notes

- `0.1.0` and `0.1.1` are already published on `registry.npmjs.org` (`npm view @solercia/ui
  versions`), published **manually** (not by CI). `0.1.2` was prepared (see the entry below) but was
  never published separately — its content is absorbed into this release.
- Publication of `0.2.0` was **prepared, not executed** — see the package publishing section of
  `README.md` for the exact step (`git tag v0.2.0` + push, or manual publish as a fallback). Pending
  before publishing through CI: configure the repository's `NPM_TOKEN` secret (currently
  empty/absent) and **rotate** the npm token used in the manual publication of `0.1.1`.
- 961/961 library tests passing (283 from `0.1.2` + the new ones for
  `sol-avatar`/`sol-score-badge`/`sol-trend`/`sol-message-status`/`sol-stepper`/`sol-timeline`/`sol-kanban`/
  `sol-calendar`/`sol-data-table`/icon registry accumulated during this release).

## [0.1.2] - 2026-07-16

### Fixed

- `ng-add` (schematic): 5 fixes discovered when setting up a real project (`ng new` +
  `ng add @solercia/ui@0.1.0`) against the published package, with no prior backport to the
  schematic:
  1. **`TS5090`**: `wireTsconfigPaths` wrote the FSD aliases (`@pages/*`, `@widgets/*`, etc.)
     without a `./` prefix (e.g. `"src/pages/*"`); an `ng new` `tsconfig.json` does not define
     `baseUrl`, so the compiler rejected the non-relative path. The generated `paths` now always
     carry an explicit `./`.
  2. **`appendGlobalStyles` ignored SCSS**: it only detected `src/styles.css`; in an
     `ng new --style=scss` project the example `--sol-*` tokens were not injected. It now also
     detects `src/styles.scss`.
  3. **`@solercia/eslint-config` was not installed**: the schematic only left an informational log
     ("not published yet"). It is now added as a real `devDependency` via `addDependency` (the
     preset has been published on npm since `0.1.1`).
  4. **`TS2571` for lack of `@shared/i18n`**: the `page`/`feature`/`widget` schematics generate
     components that import `I18nService` from `@shared/i18n`, a layer that `ng-add` never
     scaffolded. It is now created as `shared/i18n/i18n.service.ts` (an identity adapter of
     `SolI18n`, ready to be wired to `SOL_I18N`) + `shared/i18n/index.ts`.
  5. **`eslint.config.js` without `"type":"module"`**: it was generated in ESM syntax
     (`import ... from`) on a default-CommonJS `ng new` `package.json`, producing `ERR_REQUIRE_ESM`.
     The file is now emitted as `eslint.config.mjs` when the host `package.json` does not declare
     `"type":"module"`.
- Husky configs as `.cjs` for ESM hosts: a finding from the code review of fix 5 — if
  the host `package.json` DOES declare `"type":"module"` (for example, by hand or through a future
  default), Node interpreted `commitlint.config.js`/`lint-staged.config.js` (both in CommonJS
  syntax, `module.exports`) as ESM and the Husky hooks blew up with
  `ReferenceError: module is not defined in ES module scope`. `scaffoldHusky` now emits both files
  with a `.cjs` extension (same CommonJS content, unchanged) when the host is already ESM; in the
  default (CommonJS) case `.js` is kept with no change in behavior.
- Coverage: 7 new/updated cases in `ng-add.spec.ts` using `SchematicTestRunner` over a simulated
  `ng new` tree (no network) — 5 for the fixes + 2 from the post-review correction
  (exact version of `@solercia/eslint-config`, Husky in `.cjs` for ESM hosts, and coverage of the
  branch without `styles.css`/`styles.scss`). 283 library tests passing (277 base + 6 net new).

## [0.1.1] - 2026-07-15

### Added

- `sol-data-table`: generic column-driven table (`DataTableColumn`), with search, pagination,
  sorting, loading/empty states, a collapsible mobile mode and a `#rowActions` slot for per-row
  actions (convenience edit/delete). Self-contained (no domain dependencies or host utilities).
- `sol-page-header`: page header (`title` required, `subtitle` optional, actions slot).
- `sol-icon-button`: icon-only button on top of the library's icon registry, with a required
  `ariaLabel`, variants (`default`/`danger`/`ghost`), sizes and a `clicked` output.
- `sol-rich-editor`: **opt-in** mentions (`@`) and task-linking (`#`) — inputs
  `mentionableUsers`/`linkableTasks` and outputs `mentionsChange`/`taskLinksChange` (types
  `MentionUser`/`LinkableTask`). Additive: with empty lists the editor keeps its previous behavior
  (images, TCPDF serialization). The sanitizer preserves only the `data-mention-id`/`data-task-key`
  chips (strict whitelist, anti-XSS).

### Notes

- Components that emerged from a second consumer (Solercia Command): they replace its local
  stopgaps, so that the consumer does not maintain its own design system.
- 277 library tests passing (246 base + 31 new).

## [0.1.0] - 2026-07-14

### Added

- Initial extraction of the Solercia design system: 28 `sol-*` components (`shared/ui`), 3-level
  theming with 95 `--sol-*` tokens (`shared/tokens`, `ThemeService`), an icon registry (Heroicons)
  and presentational utilities.
- Host-agnostic architecture via ports (`InjectionToken`): `THEME_SOURCE`, `SOL_DEFAULT_THEME`,
  `SOL_TENANT_RESOLVER`, `SOL_I18N`. The library knows nothing about a backend API or HTTP; the
  adapters live in the consuming host.
- Collection of `ng add` / `ng generate page|feature|entity|widget` schematics inside the library
  itself, following Feature-Sliced Design.
- Documentation: `docs/{THEMING,I18N,MULTITENANT_SETUP}.md` + the library README.
- Publishing metadata: `Apache-2.0` license, authorship `NOTICE` (Solercia Solutions SAS),
  `publishConfig` pointing to GitHub Packages (`https://npm.pkg.github.com`).

### Notes

- Actual publication to GitHub Packages was still pending at the time of this release (owner or
  organization of the `@solercia` scope, hosting repository and authentication method were yet to
  be decided).

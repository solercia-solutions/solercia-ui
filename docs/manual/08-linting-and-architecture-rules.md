---
title: Linting and architecture rules
slug: linting
description: What @solercia/eslint-config enforces - FSD boundaries, file placement, naming, wrapped engines and token-only styles - and how to declare exceptions.
---

# Linting and architecture rules

```js
// eslint.config.js
import solerciaConfig from '@solercia/eslint-config';

export default [
  { ignores: ['.angular/', 'dist/', 'coverage/', 'node_modules/'] },
  ...solerciaConfig,
];
```

`@solercia/eslint-config` turns the architecture into rules the linter checks on every commit. A file
in the wrong folder, an import across layers or a hardcoded color fails CI instead of slipping
through review. `ng add @solercia/ui` installs and configures it.

## Requirements

| Dependency | Version | Notes |
| --- | --- | --- |
| Node.js | 22.14 or later | |
| `eslint` | 10 | Flat config only. |
| `typescript-eslint` | 8 | Syntactic rules; no type information needed. |
| `@eslint/css` | 2, optional | When installed, `.css` files are checked too. |

## What it enforces

| Area | Rule | Enforces |
| --- | --- | --- |
| Layer boundaries | `no-restricted-imports` | `app → pages → widgets → features → entities → shared`. A layer imports only from layers below it; `shared/**` never imports from upper layers or `@app/*`. |
| Public API | `no-restricted-imports` | Slices are consumed through their `index.ts` (`@features/login`), never through deep paths (`@features/login/ui/form`). |
| Smart and dumb UI | `no-restricted-imports` | `shared/ui` holds presentational components only: no imports from `entities/`, `features/`, `*.store` or `*.facade`. |
| Wrapped engines | `no-restricted-imports`, `no-restricted-syntax` | `chart.js` only inside `shared/ui/chart`, `maplibre-gl` only inside `shared/ui/map`, `@angular/cdk` only through the `sol-kanban-*` components. |
| Naming | `@typescript-eslint/naming-convention` | `PascalCase` classes, interfaces and types; `camelCase` variables, functions and parameters. |
| File names | `solercia/filename-case` | Every dot-separated segment is kebab-case: `appointment-form.component.ts`. |
| File placement | `solercia/fsd-placement` | Every `.ts` file under `src/` belongs to a layer and an allowed segment. |
| Theme styles | `solercia/style-tokens` | Inline component `styles` and `style="..."` in inline templates use theme variables. |
| Theme styles (CSS) | `solercia/css-style-tokens` | The same checks on `src/**/*.css`, when `@eslint/css` is installed. |

### File placement

```text
src/
├── main.ts                      allowed outside layers (also test-setup.ts, polyfills.ts, environments/**)
├── app/                         anything goes (bootstrap, routes, providers)
├── pages/<slice>/               index.ts, <slice>.routes.ts, ui/
├── widgets/<slice>/<segment>/
├── features/<slice>/<segment>/  segment ∈ ui | model | api | lib | config | testing
├── entities/<slice>/<segment>/  slice groups are allowed: pages/admin/users/ui/
└── shared/<segment>/            segment ∈ api | config | crud | i18n | lib | model | tenant | tokens | ui
```

### Styles

| Reported | Use instead |
| --- | --- |
| Color literals: `#fff`, `rgb()`, `hsl()`, `oklch()`, named colors | `var(--sol-*)` |
| A literal `font-family` | `var(--sol-font-family)` or the matching theme variable |
| `!important` | A more specific selector or a theme variable |
| `::ng-deep` | A CSS custom property exposed by the child component |

Literals stay allowed where tokens are defined and as fallbacks inside `var()`:

```css
:host {
  --sol-card-bg: #ffffff;                       /* defining a custom property */
  background: var(--sol-bg-surface, #ffffff);   /* fallback inside var() */
}
```

Not covered: external templates (`templateUrl`) and `px` units.

## Options

```js
import { solerciaEslintConfig } from '@solercia/eslint-config';

export default [
  ...solerciaEslintConfig({
    srcDir: 'apps/web/src',            // FSD root, default 'src'
    extraSharedSegments: ['support'],  // project-specific shared/ segments
    allowOutsideLayers: ['main.ts'],   // replaces the default bootstrap allow-list
  }),
];
```

The style rules accept `{ allowImportant?: boolean, allowNgDeep?: boolean }`.

## Declaring exceptions

Exceptions live in the consuming project's `eslint.config.js`, never in the preset, so they stay
visible in code review. Each one carries a comment that explains why.

```js
export default [
  ...solerciaEslintConfig({ extraSharedSegments: ['support'] }),
  // Overrides a third-party theme: !important is intentional here.
  {
    files: ['src/assets/legacy-theme.css'],
    rules: { 'solercia/css-style-tokens': ['error', { allowImportant: true }] },
  },
];
```

For a single line, write the reason next to the directive:

```css
/* eslint-disable-next-line solercia/css-style-tokens -- print stylesheet needs pure black */
```

| Acceptable exception | Not acceptable |
| --- | --- |
| Overriding a third-party stylesheet you do not control | Silencing a rule because a deadline is close |
| A print stylesheet that needs absolute colors | Disabling a layer rule to import a feature from an entity |
| A wrapper around a new engine, declared next to the existing ones | Importing Chart.js in a page |

## Commit hooks

`ng add` also configures Husky: `pre-commit` runs `lint-staged` and `commit-msg` runs commitlint with
the Conventional Commits preset, so broken rules and malformed messages stop before they are
committed.

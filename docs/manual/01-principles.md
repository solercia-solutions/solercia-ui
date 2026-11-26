---
title: Principles
slug: principles
description: The seven decisions behind the Solercia design system and what each one means in code.
---

# Principles

```ts
// The whole contract between an application and the design system fits in four providers.
providers: [
  provideTheme(),                                                   // tokens on :root
  { provide: THEME_SOURCE, useExisting: AppThemeSource },           // how to load a theme
  { provide: SOL_TENANT_RESOLVER, useExisting: AppTenantResolver }, // who the tenant is
  { provide: SOL_I18N, useExisting: I18nService },                  // how to translate
]
```

Every rule in this manual follows from seven principles. When a situation is not covered, decide by
them.

## 1. Host-agnostic

The library never calls your API, never reads your session and never assumes an i18n engine. It
declares small ports (injection tokens) and the host application implements them. The same build of
`@solercia/ui` runs in a public-sector portal, a SaaS back office or a mobile web app.

In code: no component imports `HttpClient`, a router service or a translation library. Data comes in
through inputs; events go out through outputs.

## 2. Theme by data, not by code

An organization's look is a JSON document, a `ThemeFile`, not a stylesheet or a fork. The library
resolves it into about 95 `--sol-*` CSS custom properties with light and dark modes, logo, favicon and
fonts. Adding a tenant means storing one more document; no build, no deploy.

## 3. Tokens only

Components and application styles use `var(--sol-*)` for color, typography, spacing, radius, shadow
and motion. No hexadecimal colors, no literal font families, no `!important`, no `::ng-deep`. The lint
preset enforces it, so a hardcoded color fails CI instead of slipping through review.

## 4. Accessible by default

Every interactive component is reachable and operable with the keyboard and announced correctly by
screen readers. Dialogs trap and restore focus and close on Escape; icon-only controls require an
`ariaLabel`; touch targets reach 44 px on touch screens; animations respect `prefers-reduced-motion`.
Accessibility is part of a component's contract, not an option.

## 5. English by default, any language by contract

Without configuration every visible text is English, from a bundled catalog. A host plugs its own
engine (Transloco, ngx-translate or the bundled one) through the `SOL_I18N` contract, and a Colombian
Spanish catalog ships with the package. An explicit input always wins over a default text.

## 6. Modern Angular only

Standalone components, `ChangeDetectionStrategy.OnPush`, signal inputs and outputs, and no zone.js:
the library and its showcase run with `provideZonelessChangeDetection()`. There are no NgModules to
import and no legacy compatibility layers.

## 7. Architecture as code

Applications are organized with Feature-Sliced Design: `app`, `pages`, `widgets`, `features`,
`entities`, `shared`. A layer imports only from layers below it, and each slice exposes a public
`index.ts`. These rules are not a wiki page: `ng add` scaffolds the structure and
`@solercia/eslint-config` checks it on every commit.

## What the principles rule out

| Temptation | Why it is ruled out | Do this instead |
| --- | --- | --- |
| Copy a component and tweak its CSS | Breaks theming and duplicates fixes. | Use inputs, or ask for a new variant. |
| Import Chart.js directly | Charts would ignore the theme and dark mode. | Use `<sol-chart>`. |
| Write `color: #1e293b` | One tenant's color becomes everyone's. | Use `var(--sol-color-text-primary)`. |
| Hardcode Spanish labels | Other organizations cannot translate them. | Use an i18n key or an input. |
| Fetch data inside a shared component | Couples the design system to one API. | Fetch in a feature; pass data down. |

---
title: Getting started
slug: getting-started
description: Create an Angular 22 project with @solercia/ui step by step, or adopt the library in an existing project.
---

# Getting started

```bash
npx -y @angular/cli@22 new acme-portal --style=css --ssr=false
cd acme-portal
npx ng add @solercia/ui
npx ng serve
```

Four commands give you a zoneless Angular 22 application with the default theme applied, an FSD
project structure, path aliases, theme and i18n adapters, the lint preset and commit hooks.

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | 22.14 or later (24 recommended) |
| Angular | 22 |
| npm | 11 recommended |

## A. New project

### Step 1. Create the application

```bash
npx -y @angular/cli@22 new acme-portal --style=css --ssr=false
```

Angular 22 creates a zoneless application (`provideZonelessChangeDetection()`); `@solercia/ui` needs no
zone.js.

### Step 2. Add the design system

```bash
cd acme-portal
npx ng add @solercia/ui
```

`ng add` (options `--project`, `--skip-install`) does the following:

1. Creates the FSD layer stubs `src/{pages,widgets,features,entities}/index.ts`.
2. Scaffolds `src/shared/tokens/` with `AppThemeSource` and `AppTenantResolver` (both return `null`).
3. Scaffolds `src/shared/i18n/i18n.service.ts`, an `I18nService` that implements `SolI18n`.
4. Adds the path aliases `@app/*`, `@pages/*`, `@widgets/*`, `@features/*`, `@entities/*`, `@shared/*`.
5. Appends the tokens base snippet to `src/styles.css` (page background, text color, font).
6. Adds `provideTheme()` to `app.config.ts`.
7. Creates `eslint.config.js` extending `@solercia/eslint-config`, unless one exists.
8. Sets up Husky, lint-staged and commitlint.
9. Installs the dev dependencies (unless `--skip-install`).

It does not register `THEME_SOURCE` or `SOL_I18N`; the scaffolded adapters explain how when you need
them.

### Step 3. Build a first screen

Generate a page with the library's generator and use components in its `imports`:

```bash
npx ng generate @solercia/ui:page projects
```

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  SolButtonComponent,
  SolCardComponent,
  SolEmptyStateComponent,
  SolPageHeaderComponent,
} from '@solercia/ui';

@Component({
  selector: 'app-projects-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolPageHeaderComponent, SolCardComponent, SolButtonComponent, SolEmptyStateComponent],
  template: `
    <sol-page-header title="Projects" subtitle="Everything your team is working on">
      <sol-button (clicked)="create()">New project</sol-button>
    </sol-page-header>
    <sol-card>
      @if (projects().length === 0) {
        <sol-empty-state icon="folder-open" titleKey="pages.projects.empty.title">
          <sol-button variant="secondary" (clicked)="create()">Create the first project</sol-button>
        </sol-empty-state>
      } @else {
        @for (project of projects(); track project) {
          <p>{{ project }}</p>
        }
      }
    </sol-card>
  `,
})
export class ProjectsPageComponent {
  readonly projects = signal<string[]>([]);

  create(): void {
    this.projects.update((list) => [...list, `Project ${list.length + 1}`]);
  }
}
```

The other generators follow the same layers:

| Command | Creates |
| --- | --- |
| `ng generate @solercia/ui:page <name>` | `pages/<name>/` with `index.ts`, `<name>.routes.ts` and `ui/<name>-page.component.ts` |
| `ng generate @solercia/ui:widget <name>` | `widgets/<name>/` with `index.ts` and a standalone `OnPush` component |
| `ng generate @solercia/ui:feature <name>` | `features/<name>/` with `index.ts` and a component using signal inputs and outputs |
| `ng generate @solercia/ui:entity <name>` | `entities/<name>/` with `model/` and `api/` |

### Step 4. Add a light and dark toggle

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SolIconButtonComponent, ThemeService } from '@solercia/ui';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconButtonComponent],
  template: `
    <sol-icon-button
      variant="ghost"
      [icon]="theme.isDark() ? 'sun' : 'moon'"
      [ariaLabel]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
      (clicked)="theme.toggleMode()"
    />
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
}
```

The user's choice persists in `localStorage` and is independent of the tenant theme.

### Step 5. Check the rules

```bash
npx eslint .
```

A clean run is part of the definition of done. See
[Linting and architecture rules](./08-linting-and-architecture-rules.md).

## B. Existing project

Adopt the library incrementally; nothing forces you to migrate every screen at once.

### Step 1. Install

```bash
npm install @solercia/ui @angular/cdk chart.js @dagrejs/dagre
```

`@angular/cdk` is needed by the kanban components, `chart.js` by `sol-chart` and `@dagrejs/dagre` by the
flow canvas auto-layout. Install only what you use; `ng add @solercia/ui` also works on an existing
project if you want the scaffolding.

### Step 2. Register the theme runtime

```ts
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTheme } from '@solercia/ui';

export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection(), provideRouter([]), provideTheme()],
};
```

### Step 3. Apply the tokens to the page

```css
/* src/styles.css */
body {
  background: var(--sol-bg-page);
  color: var(--sol-color-text-primary);
  font-family: var(--sol-font-family);
}
```

### Step 4. Use components in new screens first

Import components into the standalone `imports` of the screen you are building. Replace hand-written
buttons, tables, dialogs and date pickers as you touch each screen.

### Step 5. Connect your tenant, theme and language (optional)

```ts
import { ApplicationConfig } from '@angular/core';
import { SOL_I18N, SOL_TENANT_RESOLVER, THEME_SOURCE, provideTheme } from '@solercia/ui';
import { AppTenantResolver, AppThemeSource } from '@shared/tokens';
import { I18nService } from '@shared/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideTheme(),
    { provide: THEME_SOURCE, useExisting: AppThemeSource },
    { provide: SOL_TENANT_RESOLVER, useExisting: AppTenantResolver },
    { provide: SOL_I18N, useExisting: I18nService },
  ],
};
```

[Theming](./04-theming.md) shows how to implement `AppThemeSource` and `AppTenantResolver`;
[Internationalization](./05-i18n.md) shows the i18n adapter.

### Step 6. Add the lint preset

```bash
npm install --save-dev @solercia/eslint-config eslint typescript-eslint @eslint/css
```

```js
// eslint.config.js
import solerciaConfig from '@solercia/eslint-config';

export default [
  { ignores: ['.angular/', 'dist/', 'coverage/', 'node_modules/'] },
  ...solerciaConfig,
];
```

In a large legacy code base, start with the style rules on new folders and widen the scope as screens
move into the FSD layers.

## Verification checklist

- [ ] The application renders on the «Vértice» theme with no backend running.
- [ ] The light and dark toggle switches every component and persists after a reload.
- [ ] `npx eslint .` passes.
- [ ] A screen at 390 px wide has no horizontal scroll.
- [ ] Keyboard only: every action is reachable with Tab and Enter or Space.

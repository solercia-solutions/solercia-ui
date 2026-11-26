---
title: FAQ
slug: faq
description: Quick answers about adopting, theming, translating and extending the Solercia design system.
---

# FAQ

```ts
// The smallest working setup: one provider, the bundled theme, English texts.
import { ApplicationConfig } from '@angular/core';
import { provideTheme } from '@solercia/ui';

export const appConfig: ApplicationConfig = { providers: [provideTheme()] };
```

## Adoption

**Do I need all three packages?**
No. `@solercia/ui` is the only required one. `ng add` installs `@solercia/eslint-config`;
`@solercia/chat` is for applications that embed an assistant.

**Does it need zone.js?**
No. The library and the showcase run with `provideZonelessChangeDetection()`, the Angular 22 default.

**Can I adopt it screen by screen in an existing application?**
Yes. Register `provideTheme()`, add the tokens base to `styles.css` and use components in the screens
you touch. See [Getting started](./03-getting-started.md#b-existing-project).

**Which Angular versions are supported?**
Angular 22 (`^22.0.0` peer dependencies).

## Theming

**Where do tenant themes come from?**
From your `THEME_SOURCE` implementation: an API, a static file, a database column. The library never
fetches a theme itself.

**What happens if a tenant theme is broken?**
`ThemeService` validates every document. An invalid theme, a failed request or a 404 keeps the default
theme and logs a console warning; the application never renders unstyled.

**Is dark mode part of the tenant theme?**
Each theme defines both modes, but which mode is active is the user's preference, stored in
`localStorage` and toggled with `ThemeService.toggleMode()`.

**Can I use my own colors in a component?**
Use the `--sol-*` tokens. If no token fits, the theme is missing a decision: add it to the theme, not to
the component.

## Texts and languages

**Why does a component show a key such as `pages.projects.empty.title`?**
The key is missing from your catalog: inputs ending in `Key` receive keys, and an engine returns the
key itself when it does not know it. Add the key to your translations.

**How do I get Spanish texts?**
`{ provide: SOL_I18N, useFactory: () => createSolI18n({ lang: 'es-CO' }) }`, or merge
`@solercia/ui/i18n/es-CO.json` into your engine's `es-CO` catalog.

## Extending

**The component I need does not exist. What now?**
Compose existing components in your application's `shared/ui` or feature first. If the need is
general, propose it to the library with a use case; it will get a spec, a showcase page and docs.

**Can I override a component's internal styles?**
No `::ng-deep` and no `!important`. Customize through inputs and the theme tokens a component reads.

**Can I use Chart.js or the CDK directly?**
Not in application code: the lint preset restricts them to the wrappers (`sol-chart`, `sol-kanban-*`)
so charts and drag and drop stay themed and accessible.

## Documentation

**Where is the complete list of inputs and outputs?**
In the [component reference](../../README.md#component-reference) of the README, and live in the
showcase.

**How do I regenerate the PDF and Word manual?**
`npm run docs:manual`. It needs Pandoc and a local Chromium; see
[Releases and contributing](./11-releases-and-contributing.md#documentation-outputs).

**What should an AI agent read?**
[`llms-full.txt`](../../llms-full.txt): every chapter and the component reference in one file. See
[For AI agents](./10-for-ai-agents.md).

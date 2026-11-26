---
title: For AI agents
slug: ai-agents
description: Rules, prompts and review checklists for AI coding agents that build Angular screens with the Solercia design system.
---

# For AI agents

```text
Build the "Projects" page with @solercia/ui.
Read https://raw.githubusercontent.com/solercia-solutions/solercia-ui/main/llms-full.txt first.
Place it in src/pages/projects/ (FSD). Use sol-page-header, sol-data-table and sol-confirm-dialog.
Cover loading, empty, no-results, error and success. Style only with var(--sol-*).
Texts through i18n keys under pages.projects.*. Run npx eslint on the changed files before finishing.
```

This chapter is written for two readers: the AI coding agent that generates code with the design
system, and the person who prompts it and reviews its output.

## What to give an agent

| Source | Content | When |
| --- | --- | --- |
| [`llms.txt`](../../llms.txt) | Short index: setup, providers, components by category, rules | Always; it is small. |
| [`llms-full.txt`](../../llms-full.txt) | This whole manual plus the complete component reference | Screens that use several components, or a new project. |
| `AGENTS.md` of the repository | Repository-specific commands and rules | Changes inside a Solercia repository. |
| The matching showcase page in `projects/showcase/src/app/pages/` | A working example | A component the agent has not used before. |

Both files ship inside the `@solercia/ui` npm package, so an agent can read them from
`node_modules/@solercia/ui/` without network access. `@solercia/eslint-config` and `@solercia/chat`
ship their own `llms.txt`.

## Rules for agents

1. **Reuse before you build.** Look up the component list first; do not hand-roll a button, table,
   modal, date picker or chart that already exists.
2. **Style only with tokens.** `var(--sol-*)` for color, typography, spacing, radius, shadow and
   motion. No literal colors or fonts, no `!important`, no `::ng-deep`.
3. **Respect required inputs.** Every icon-only control has an `ariaLabel`; `sol-chart` has an
   `ariaLabelKey`; `sol-empty-state` has a `titleKey`.
4. **Wrap engines, do not import them.** `<sol-chart>` instead of Chart.js; `sol-kanban-*` instead of
   `@angular/cdk` drag and drop.
5. **Cover every state.** Loading, empty, no results, error and success are part of every screen.
6. **Place files by layer first.** Decide the FSD layer and segment, then write the file. Import slices
   through their `index.ts`.
7. **Modern Angular only.** Standalone, `OnPush`, `input()` and `output()`, signals, built-in control flow
   (`@if`, `@for`, `@switch`). Do not add zone.js or NgModules.
8. **Texts through i18n.** Visible texts come from keys or inputs, never hard-coded in shared components.
9. **Never invent APIs.** If an input, output or symbol is not in the reference, it does not exist. Ask,
   or propose a change to the library instead.
10. **Fix violations at the source.** Do not add `eslint-disable` comments or loosen the config unless the
    user asks; declare a needed exception in `eslint.config.js` with a reason.

## Prompt patterns

**A new screen**

```text
Create the <name> page in src/pages/<name>/ using @solercia/ui.
Data: <entity> from <endpoint or entity slice>. Actions: <list>.
States: loading (skeleton), empty (with create action), no results (clear filters), error (retry).
Phone: must work at 390 px. Keyboard: every action reachable.
```

**A change to an existing screen**

```text
In <file>, replace the hand-written table with sol-data-table. Keep the current columns and
actions. Do not change the API calls. Show the diff and the eslint result.
```

**A theme**

```text
Write a ThemeFile for <organization> with primary <color> and secondary <color>.
Both light and dark modes. Validate it with isRenderableTheme() in a unit test.
```

## Review checklist

Use it on every change an agent proposes.

- [ ] Uses existing `sol-*` components; nothing duplicated.
- [ ] Every symbol and input exists in the reference.
- [ ] No literal colors, fonts, `!important` or `::ng-deep`.
- [ ] Files are in the right layer and segment; no deep imports into another slice.
- [ ] Loading, empty, no-results, error and success states exist and look right.
- [ ] Works at 390 px and with the keyboard; icon-only buttons have `ariaLabel`.
- [ ] Texts come from i18n keys or inputs.
- [ ] `npx eslint` on the changed files is clean; tests pass.

## Definition of done for a screen

1. It renders with the default theme and with a tenant theme, in light and dark mode.
2. It handles the five states.
3. It passes lint and its tests.
4. It has no console errors.

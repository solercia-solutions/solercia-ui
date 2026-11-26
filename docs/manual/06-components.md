---
title: Components
slug: components
description: The 57 public components and directives of @solercia/ui by category, with links to the reference and the live demos.
---

# Components

```ts
import { SolButtonComponent, SolDataTableComponent, SolModalComponent } from '@solercia/ui';

// Every component is standalone: add it to the `imports` of the component that uses it.
export const projectScreenImports = [SolButtonComponent, SolDataTableComponent, SolModalComponent];
```

`@solercia/ui` has 57 public components and directives. This chapter helps you choose one; the
[component reference](../../README.md#component-reference) lists every input, output and slot, and the
showcase demoes each component live, in light and dark mode, down to 390 px.

Conventions used across the library:

- Selectors start with `sol-`; directives with `sol` (`[solReveal]`, `*solWizardStep`, `*solTreeNodeDef`).
- Class names are `Sol<Name>Component` or `Sol<Name>Directive`.
- Form controls implement `ControlValueAccessor`, so `[(ngModel)]` and `formControlName` work.
- Outputs are past-tense or `*Change` events: `clicked`, `closed`, `valueChange`, `itemMoved`.
- Inputs ending in `Key` take an i18n key; icon-only controls require `ariaLabel`.

## Actions

| Selector | Use it for | Demo |
| --- | --- | --- |
| `sol-button` | Text button with `primary`, `secondary`, `danger` and `ghost` variants and a loading state. | [Buttons](https://solercia-solutions.github.io/solercia-ui/buttons) |
| `sol-icon-button` | Icon-only action; `ariaLabel` is required. | [Buttons](https://solercia-solutions.github.io/solercia-ui/buttons) |
| `sol-icon` | Inline SVG from a registry of about 140 names. | [Icons](https://solercia-solutions.github.io/solercia-ui/icons) |

Reference: [Actions](../../README.md#actions).

## Forms

| Selector | Use it for | Demo |
| --- | --- | --- |
| `sol-input`, `sol-textarea` | Text with label and error message. | [Inputs](https://solercia-solutions.github.io/solercia-ui/inputs) |
| `sol-form-field` | Label, hint and error around any projected control. | [Inputs](https://solercia-solutions.github.io/solercia-ui/inputs) |
| `sol-search-input` | A search box that emits the query. | [Inputs](https://solercia-solutions.github.io/solercia-ui/inputs) |
| `sol-number-input` | Numbers with − and + buttons. | [Inputs](https://solercia-solutions.github.io/solercia-ui/inputs) |
| `sol-select` | Searchable single or multiple choice; bottom sheet on phones. | [Selection](https://solercia-solutions.github.io/solercia-ui/selection) |
| `sol-checkbox`, `sol-toggle` | Boolean choices. | [Selection](https://solercia-solutions.github.io/solercia-ui/selection) |
| `sol-chip`, `sol-chip-group`, `sol-view-toggle` | Filters, choices as chips and segmented controls. | [Chips](https://solercia-solutions.github.io/solercia-ui/chips) |
| `sol-date-picker`, `sol-day-picker` | A date from a calendar, or a day from the slots the host computed. | [Dates](https://solercia-solutions.github.io/solercia-ui/dates) |
| `sol-rating-input` | Interactive 1–5 stars. | [Rating](https://solercia-solutions.github.io/solercia-ui/rating) |
| `sol-file-upload` | Drag-and-drop image picker with validation and preview. | [File upload](https://solercia-solutions.github.io/solercia-ui/file-upload) |
| `sol-rich-editor` | Rich text with tables, images, mentions; TCPDF-safe HTML output. | [Rich editor](https://solercia-solutions.github.io/solercia-ui/rich-editor) |

Reference: [Forms](../../README.md#forms).

## Feedback and status

| Selector | Use it for | Demo |
| --- | --- | --- |
| `sol-badge`, `sol-score-badge`, `sol-trend`, `sol-message-status` | Status, scores, variations and delivery ticks. | [Status](https://solercia-solutions.github.io/solercia-ui/status) |
| `sol-avatar`, `sol-star-rating` | People and read-only ratings. | [Status](https://solercia-solutions.github.io/solercia-ui/status) |
| `sol-spinner`, `sol-skeleton`, `sol-progress-bar` | Loading and progress. | [Loading](https://solercia-solutions.github.io/solercia-ui/loading) |
| `sol-empty-state` | Empty and no-results states with an optional action. | [Empty state](https://solercia-solutions.github.io/solercia-ui/empty-state) |
| `sol-tooltip` | Hover and focus hints. | [Tooltip](https://solercia-solutions.github.io/solercia-ui/tooltip) |
| `sol-notification-panel` | An inbox with loading, error, empty and content states. | [Notifications](https://solercia-solutions.github.io/solercia-ui/notifications) |

Reference: [Feedback and status](../../README.md#feedback--status).

## Overlays

| Selector | Use it for | Demo |
| --- | --- | --- |
| `sol-modal` | A focused task over the page. | [Overlays](https://solercia-solutions.github.io/solercia-ui/overlays) |
| `sol-drawer` | Side panel or bottom sheet, with a footer slot. | [Overlays](https://solercia-solutions.github.io/solercia-ui/overlays) |
| `sol-confirm-dialog` | Confirming a destructive or irreversible action. | [Overlays](https://solercia-solutions.github.io/solercia-ui/overlays) |

Reference: [Overlays](../../README.md#overlays).

## Navigation

| Selector | Use it for | Demo |
| --- | --- | --- |
| `sol-tabs` | A tab list; the host renders the active panel. | [Navigation](https://solercia-solutions.github.io/solercia-ui/navigation) |
| `sol-pagination` | Pages and page size. | [Navigation](https://solercia-solutions.github.io/solercia-ui/navigation) |
| `sol-page-header` | Page title, subtitle and actions. | [Navigation](https://solercia-solutions.github.io/solercia-ui/navigation) |
| `sol-stepper`, `sol-wizard` + `*solWizardStep` | Ordered steps, or a full multi-step form. | [Stepper](https://solercia-solutions.github.io/solercia-ui/stepper) |
| `sol-scope-switcher` | Switching organization, workspace or tenant. | [Scope switcher](https://solercia-solutions.github.io/solercia-ui/scope-switcher) |
| `sol-tree` + `*solTreeNodeDef` | Hierarchies up to five levels deep, keyboard navigable. | [Tree](https://solercia-solutions.github.io/solercia-ui/tree) |

Reference: [Navigation](../../README.md#navigation).

## Layout and motion

| Selector | Use it for | Demo |
| --- | --- | --- |
| `sol-card` | A surface with optional padding and hover elevation. | [Card](https://solercia-solutions.github.io/solercia-ui/card) |
| `[solReveal]` | Entrance animation from the theme's motion tokens; respects reduced motion. | [Card](https://solercia-solutions.github.io/solercia-ui/card) |

Reference: [Layout and motion](../../README.md#layout--motion).

## Data

| Selector | Use it for | Demo |
| --- | --- | --- |
| `sol-data-table` | Sorting, filters, search, pagination, row actions; collapses into cards on phones. | [Data table](https://solercia-solutions.github.io/solercia-ui/data-table) |
| `sol-virtual-scroll` | Long lists with variable heights, such as chat histories. | [Virtual scroll](https://solercia-solutions.github.io/solercia-ui/virtual-scroll) |
| `sol-chart` | Line, bar, doughnut and sparkline charts themed from tokens. | [Chart](https://solercia-solutions.github.io/solercia-ui/chart) |
| `sol-timeline` | A Gantt-like hierarchy on a month axis. | [Timeline](https://solercia-solutions.github.io/solercia-ui/timeline) |

Reference: [Data](../../README.md#data).

## Planning

| Selector | Use it for | Demo |
| --- | --- | --- |
| `sol-kanban-board` and `sol-kanban-*` | Columns with drag and drop by mouse, touch and keyboard, with rollback. | [Kanban](https://solercia-solutions.github.io/solercia-ui/kanban) |
| `sol-calendar` and `sol-calendar-*` | A week or day agenda. | [Calendar](https://solercia-solutions.github.io/solercia-ui/calendar) |
| `sol-flow-canvas` | A node graph with pan, zoom, connections and auto-layout. | [Flow canvas](https://solercia-solutions.github.io/solercia-ui/flow-canvas) |

Reference: [Planning](../../README.md#planning).

## Secondary entry points

| Entry point | Provides |
| --- | --- |
| `@solercia/ui/theme-studio` | `<sol-theme-studio>` theme editor and its store contract. |
| `@solercia/ui/login-appearance` | `<sol-login-frame>` and the pieces of a themed sign-in screen. |

## Choosing between similar components

| If you need | Use | Not |
| --- | --- | --- |
| A yes or no that applies immediately | `sol-toggle` | `sol-checkbox` |
| A yes or no submitted with a form, or a list of options | `sol-checkbox` | `sol-toggle` |
| Two to five mutually exclusive views | `sol-view-toggle` | `sol-tabs` |
| Sections of one page with their own content | `sol-tabs` | `sol-view-toggle` |
| A short decision about a destructive action | `sol-confirm-dialog` | `sol-modal` |
| A form or task in context | `sol-drawer` | `sol-modal` on phones |
| A placeholder that keeps the layout while loading | `sol-skeleton` | `sol-spinner` |
| A busy indicator inside a button or small area | `sol-spinner` or `sol-button [loading]` | `sol-skeleton` |

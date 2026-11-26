---
title: Patterns
slug: patterns
description: How to build screens with @solercia/ui - the five screen states, forms, tables, dialogs on mobile, charts and kanban.
---

# Patterns

```html
@switch (state()) {
  @case ('loading') { <sol-skeleton variant="row" count="5" /> }
  @case ('error') {
    <sol-empty-state icon="exclamation-triangle" titleKey="pages.projects.error.title">
      <sol-button variant="secondary" (clicked)="reload()">Try again</sol-button>
    </sol-empty-state>
  }
  @case ('empty') {
    <sol-empty-state icon="folder-open" titleKey="pages.projects.empty.title">
      <sol-button (clicked)="create()">Create project</sol-button>
    </sol-empty-state>
  }
  @case ('no-results') { <sol-empty-state icon="funnel" titleKey="pages.projects.noResults.title" /> }
  @default { <sol-data-table [data]="visible()" [columns]="columns" /> }
}
```

A pattern is a proven way to combine components for a recurring screen. Follow these before
designing something new.

## The five screen states

Every screen that shows data has five states. Design and test all of them.

| State | Meaning | Component | Rule |
| --- | --- | --- | --- |
| Loading | The request is in flight. | `sol-skeleton` for content areas, `sol-spinner` for small areas, `[loading]` on buttons | Keep the layout: the skeleton has the shape of the content. |
| Empty | The request succeeded and there is nothing yet. | `sol-empty-state` with a call to action | Tell the user how to create the first item. |
| No results | There is data, but the filters hide all of it. | `sol-empty-state` with a reset action | Never show the "empty" message: offer to clear the filters. |
| Error | The request failed. | `sol-empty-state` with a retry action | Never confuse "no data" with "the request failed". |
| Success | Data is shown, or an action completed. | The content; a confirmation message | Confirm actions that changed data. |

Derive the state from signals instead of juggling flags:

```ts
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  SolButtonComponent,
  SolDataTableComponent,
  SolEmptyStateComponent,
  SolSkeletonComponent,
  type DataTableColumn,
  type SolDataTableRow,
} from '@solercia/ui';

type ScreenState = 'loading' | 'error' | 'empty' | 'no-results' | 'ready';

@Component({
  selector: 'app-projects-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolButtonComponent, SolDataTableComponent, SolEmptyStateComponent, SolSkeletonComponent],
  template: `
    @switch (state()) {
      @case ('loading') { <sol-skeleton variant="row" count="5" /> }
      @case ('error') {
        <sol-empty-state icon="exclamation-triangle" titleKey="pages.projects.error.title">
          <sol-button variant="secondary" (clicked)="reload()">Try again</sol-button>
        </sol-empty-state>
      }
      @case ('empty') { <sol-empty-state icon="folder-open" titleKey="pages.projects.empty.title" /> }
      @case ('no-results') {
        <sol-empty-state icon="funnel" titleKey="pages.projects.noResults.title">
          <sol-button variant="ghost" (clicked)="query.set('')">Clear filters</sol-button>
        </sol-empty-state>
      }
      @default { <sol-data-table [data]="visible()" [columns]="columns" /> }
    }
  `,
})
export class ProjectsListComponent {
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly rows = signal<SolDataTableRow[]>([]);
  readonly query = signal('');
  readonly columns: DataTableColumn[] = [{ key: 'name', label: 'Name', sortable: true }];

  readonly visible = computed(() =>
    this.rows().filter((row) => String(row['name']).toLowerCase().includes(this.query().toLowerCase())),
  );
  readonly state = computed<ScreenState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    if (this.rows().length === 0) return 'empty';
    return this.visible().length === 0 ? 'no-results' : 'ready';
  });

  reload(): void {
    this.failed.set(false);
    this.loading.set(true);
  }
}
```

For lists, `sol-data-table [loading]` and `sol-notification-panel [loading] [error]` already render
their own loading and empty states.

## Forms

- Use the library controls; they implement `ControlValueAccessor` and work with reactive forms
  (`formControlName`) and `ngModel`.
- Give every control a visible `label`. Use `sol-form-field` to wrap a native or third-party control.
- Show validation messages through the `error` input, after the user leaves the field or submits.
- If the system knows the valid values, offer them (`sol-select`, `sol-date-picker`, `sol-day-picker`)
  instead of free text.
- Preselect the most likely value; do not start a form empty when a sensible default exists.
- Long forms become a `sol-wizard`, one `*solWizardStep` per group of fields.

```html
<form [formGroup]="form" (ngSubmit)="save()">
  <sol-input label="Project name" formControlName="name" [error]="nameError()" />
  <sol-select label="Owner" formControlName="owner" [options]="owners()" />
  <sol-date-picker formControlName="dueDate" />
  <sol-button type="submit" [loading]="saving()">Save</sol-button>
</form>
```

## Tables

- `sol-data-table` handles sorting, per-column filters (`filter: 'text' | 'select'`), global search and
  pagination on the client. For server-side paging, pass the current page and use `sol-pagination`.
- Below `collapseWidth` (767 px by default) rows collapse into cards, so tables work on phones without
  horizontal scrolling.
- Put the primary action of the screen in the `[tableActions]` slot and row actions in the
  `#rowActions` template, or use the built-in `editClicked` and `deleteClicked` outputs.
- A delete action always goes through `sol-confirm-dialog`.

## Dialogs on mobile

| Component | Phone behavior |
| --- | --- |
| `sol-confirm-dialog` | Below 640 px it opens as a bottom sheet with full-width stacked actions and Cancel at the bottom, near the thumb. |
| `sol-drawer` | `variant="sheet"` opens from the bottom; use it for filters and short forms. |
| `sol-select` | Opens as a bottom sheet below `mobileBreakpoint` (640 px). |
| `sol-modal` | Keep modals short on phones; prefer a drawer sheet or a page for long forms. |

All of them are `aria-modal`, trap focus, restore it on close, close on Escape when closeable and lock
the page scroll. On touch screens every action reaches the 44 px touch target
(`--sol-size-control-touch`).

```html
<sol-confirm-dialog
  [open]="confirming()"
  title="Delete this project?"
  message="Its tasks and files are deleted too."
  confirmLabel="Delete"
  (confirm)="remove()"
  (cancel)="confirming.set(false)"
/>
```

## Charts

- Use `sol-chart`; never import Chart.js in application code. The chart reads `--sol-chart-1` to
  `--sol-chart-6`, re-renders on light and dark changes, and Chart.js loads only when the first chart
  is created.
- `ariaLabelKey` is required: describe what the chart shows.
- Show a `sol-skeleton variant="card"` while data loads and a `sol-empty-state` when the series are
  empty.

```html
<sol-chart
  type="bar"
  ariaLabelKey="pages.dashboard.projectsByStatus"
  [data]="{ labels: ['Planned', 'Active', 'Done'], series: [{ label: 'Projects', data: [4, 9, 12] }] }"
/>
```

## Kanban

- Use `sol-kanban-board`; never import `@angular/cdk/drag-drop` in application code. The board
  supports mouse, touch and a keyboard "Move to…" menu.
- Update the columns optimistically and call `rollback()` when persisting fails.

```ts
import type { KanbanItemMoved, SolKanbanBoardComponent } from '@solercia/ui';

interface Task {
  id: string;
  title: string;
}

declare function moveTask(move: KanbanItemMoved<Task>): Promise<void>;

export async function persistMove(move: KanbanItemMoved<Task>, board: SolKanbanBoardComponent<Task>): Promise<void> {
  try {
    await moveTask(move);
  } catch {
    board.rollback();
  }
}
```

## Responsive and accessible by default

- Check every screen at 390 px: no horizontal scroll, no hidden primary action.
- Every action must work with the keyboard; icon-only buttons need `ariaLabel`.
- Animate with `[solReveal]` and the motion tokens only; they respect `prefers-reduced-motion`.

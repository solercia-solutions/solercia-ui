import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  SolAvatarComponent,
  SolBadgeComponent,
  SolIconComponent,
  SolKanbanBoardComponent,
  SolKanbanCardComponent,
  SolKanbanColumnComponent,
  SolKanbanDragSourceComponent,
  type KanbanColumn,
  type KanbanItem,
  type KanbanItemMoved,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

interface Task extends KanbanItem {
  readonly id: number;
  readonly title: string;
  readonly owner: string;
  readonly tag: string;
}

const INITIAL: KanbanColumn<Task>[] = [
  {
    id: 'todo',
    titleKey: 'showcase.kanban.todo',
    accent: 'var(--sol-color-info)',
    items: [
      { id: 1, title: 'Draft the onboarding copy', owner: 'Ada Lovelace', tag: 'Content' },
      { id: 2, title: 'Audit color contrast', owner: 'Grace Hopper', tag: 'A11y' },
    ],
  },
  {
    id: 'doing',
    titleKey: 'showcase.kanban.doing',
    accent: 'var(--sol-color-warning)',
    items: [{ id: 3, title: 'Calendar day view', owner: 'Alan Turing', tag: 'Feature' }],
  },
  {
    id: 'done',
    titleKey: 'showcase.kanban.done',
    accent: 'var(--sol-color-success)',
    terminalAnchor: true,
    items: [{ id: 4, title: 'Publish 0.7.0', owner: 'Ada Lovelace', tag: 'Release' }],
  },
];

@Component({
  selector: 'app-kanban-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageComponent,
    DemoComponent,
    SolKanbanBoardComponent,
    SolKanbanColumnComponent,
    SolKanbanCardComponent,
    SolKanbanDragSourceComponent,
    SolBadgeComponent,
    SolAvatarComponent,
    SolIconComponent,
  ],
  template: `
    <ng-template #card let-task>
      <div class="card">
        <p class="card__title">{{ task.title }}</p>
        <div class="card__meta">
          <sol-badge variant="info">{{ task.tag }}</sol-badge>
          <sol-avatar [name]="task.owner" size="sm" />
        </div>
      </div>
    </ng-template>
    <ng-template #empty><p class="muted">Drop a card here</p></ng-template>
    <ng-template #anchor let-column><sol-icon name="check-circle" size="sm" /></ng-template>

    <app-page
      title="Kanban"
      lead="Board, columns and cards with mouse, touch and keyboard moves (CDK drag and drop). The board keeps an optimistic mirror; the host persists itemMoved and may call rollback()."
      [selectors]="['sol-kanban-board', 'sol-kanban-column', 'sol-kanban-card', 'sol-kanban-drag-source']"
    >
      <app-demo title="Board with an external drag source" description="Drag backlog items into a column; drag cards between columns." [code]="boardCode" [stack]="true">
        <div class="backlog">
          <p class="muted">Backlog ({{ backlog().length }})</p>
          <sol-kanban-drag-source [items]="backlog()" [connectedTo]="columnIds()" [itemTemplate]="card" />
        </div>
        <div class="scroll-x">
          <sol-kanban-board
            [columns]="columns()"
            [cardTemplate]="card"
            [emptyTemplate]="empty"
            [anchorTemplate]="anchor"
            (itemMoved)="onMoved($event)"
            (addRequested)="add($event)"
            (externalItemDropped)="onExternal($event)"
          />
        </div>
        <p class="hint">{{ log() || 'Move a card or use the add action of a column.' }}</p>
      </app-demo>

      <app-demo title="Single column and single card" description="The board composes these; they can be rendered alone for previews." [code]="partsCode">
        <div class="parts">
          <sol-kanban-column [column]="previewColumn" [cardTemplate]="card" />
          <sol-kanban-card [item]="previewTask" [cardTemplate]="card" />
        </div>
      </app-demo>
    </app-page>
  `,
  styles: `
    .card {
      display: grid;
      gap: var(--sol-space-xs);
    }
    .card__title {
      margin: 0;
      font-size: var(--sol-font-size-sm);
      font-weight: var(--sol-font-weight-bold);
      color: var(--sol-color-text-primary);
    }
    .card__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .muted {
      margin: 0;
      color: var(--sol-color-text-muted);
      font-size: var(--sol-font-size-sm);
    }
    .scroll-x {
      overflow-x: auto;
      padding-bottom: var(--sol-space-xs);
    }
    .scroll-x sol-kanban-board {
      display: block;
      min-width: 720px;
    }
    .backlog {
      min-width: 0;
      max-width: 100%;
      overflow-x: auto;
      display: grid;
      gap: var(--sol-space-xs);
      padding: var(--sol-space-sm);
      border: var(--sol-border-width-default) dashed var(--sol-border-color-default);
      border-radius: var(--sol-border-radius-md);
    }
    .parts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 300px));
      gap: var(--sol-space-md);
      align-items: start;
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class KanbanPage {
  protected readonly columns = signal<KanbanColumn<Task>[]>(INITIAL);
  protected readonly columnIds = computed(() => this.columns().map((column) => column.id));
  protected readonly backlog = signal<Task[]>([
    { id: 10, title: 'Export to CSV', owner: 'Katherine Johnson', tag: 'Feature' },
    { id: 11, title: 'Fix tooltip on Safari', owner: 'Linus Torvalds', tag: 'Bug' },
  ]);
  protected readonly log = signal('');
  protected readonly previewColumn: KanbanColumn<Task> = { ...INITIAL[0], id: 'preview', droppable: false };
  protected readonly previewTask: Task = INITIAL[1].items[0];
  private nextId = 100;

  protected onMoved(event: KanbanItemMoved<Task>): void {
    this.log.set(`“${event.item.title}” moved from ${event.fromColumnId} to ${event.toColumnId} (position ${event.currentIndex + 1})`);
    // A real host persists here and calls board.rollback() if the request fails.
    this.columns.update((columns) =>
      columns.map((column) => {
        const items = column.items.filter((item) => item.id !== event.item.id);
        if (column.id === event.toColumnId) {
          items.splice(event.currentIndex, 0, event.item);
        }
        return { ...column, items };
      }),
    );
  }

  protected add(columnId: string): void {
    const task: Task = { id: this.nextId++, title: 'New task', owner: 'Grace Hopper', tag: 'Draft' };
    this.columns.update((columns) => columns.map((column) => (column.id === columnId ? { ...column, items: [...column.items, task] } : column)));
    this.log.set(`Added a card to ${columnId}`);
  }

  protected onExternal(event: { toColumnId: string; data: unknown }): void {
    const task = event.data as Task;
    this.backlog.update((list) => list.filter((item) => item.id !== task.id));
    this.columns.update((columns) => columns.map((column) => (column.id === event.toColumnId ? { ...column, items: [...column.items, task] } : column)));
    this.log.set(`“${task.title}” planned into ${event.toColumnId}`);
  }

  protected readonly boardCode = `<ng-template #card let-task>
  <p>{{ task.title }}</p><sol-badge>{{ task.tag }}</sol-badge>
</ng-template>

<sol-kanban-drag-source [items]="backlog()" [connectedTo]="['todo', 'doing', 'done']" [itemTemplate]="card" />
<sol-kanban-board
  [columns]="columns()"
  [cardTemplate]="card"
  [emptyTemplate]="empty"
  [anchorTemplate]="anchor"          <!-- rendered when column.terminalAnchor -->
  (itemMoved)="persist($event)"
  (addRequested)="create($event)"
  (externalItemDropped)="plan($event)"
/>

columns: KanbanColumn<Task>[] = [
  { id: 'todo', titleKey: 'showcase.kanban.todo', accent: 'var(--sol-color-info)', items: [{ id: 1, title: '…' }] },
  { id: 'done', titleKey: 'showcase.kanban.done', terminalAnchor: true, items: [] },
];`;
  protected readonly partsCode = `<sol-kanban-column [column]="{ id: 'preview', title: 'To do', items: tasks, droppable: false }" [cardTemplate]="card" />
<sol-kanban-card [item]="task" [cardTemplate]="card" />`;
}

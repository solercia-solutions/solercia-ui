import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  SolNotificationPanelComponent,
  SolViewToggleComponent,
  type SolNotificationItem,
  type SolViewToggleOption,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

const MINUTE = 60_000;

function sampleItems(): SolNotificationItem[] {
  const now = Date.now();
  return [
    { id: 1, title: 'Invoice #1042 approved', body: 'Finance approved the payment for October.', timestamp: now - 2 * MINUTE, tone: 'success', typeLabel: 'Billing' },
    { id: 2, title: 'Ada mentioned you', body: '“Can you review the new calendar view?”', timestamp: now - 45 * MINUTE, tone: 'info', typeLabel: 'Mention' },
    { id: 3, title: 'Contract expires in 5 days', timestamp: now - 5 * 60 * MINUTE, tone: 'warning', typeLabel: 'Reminder' },
    { id: 4, title: 'Backup failed', body: 'The nightly backup could not reach the storage bucket.', timestamp: now - 2 * 24 * 60 * MINUTE, tone: 'danger', read: true },
  ];
}

@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolNotificationPanelComponent, SolViewToggleComponent],
  template: `
    <app-page
      title="Notification panel"
      lead="Inbox panel with relative times, unread counter and the four states: loading, error, empty and content."
      [selectors]="['sol-notification-panel']"
    >
      <app-demo title="States" description="Switch the state to see each rendering." [code]="code" [stack]="true">
        <sol-view-toggle [options]="states" [value]="state()" (valueChange)="state.set($event)" />
        <div class="panel">
          <sol-notification-panel
            [items]="visibleItems()"
            [loading]="state() === 'loading'"
            [error]="state() === 'error'"
            [errorMessage]="state() === 'error' ? 'The server answered 503.' : ''"
            (itemSelected)="log.set('Opened: ' + $event.title)"
            (markedRead)="markRead($event)"
            (markedAllRead)="markAll()"
            (retryRequested)="state.set('content')"
            (closed)="log.set('Panel closed')"
          />
        </div>
        <p class="hint">{{ log() || 'Interact with the panel.' }}</p>
      </app-demo>
    </app-page>
  `,
  styles: `
    .panel {
      max-width: 420px;
      border: var(--sol-border-width-default) solid var(--sol-border-color-default);
      border-radius: var(--sol-border-radius-lg);
      overflow: hidden;
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class NotificationsPage {
  protected readonly states: SolViewToggleOption[] = [
    { value: 'content', label: 'Content' },
    { value: 'loading', label: 'Loading' },
    { value: 'empty', label: 'Empty' },
    { value: 'error', label: 'Error' },
  ];
  protected readonly state = signal('content');
  protected readonly items = signal<SolNotificationItem[]>(sampleItems());
  protected readonly visibleItems = computed(() => (this.state() === 'empty' ? [] : this.items()));
  protected readonly log = signal('');

  protected markRead(item: SolNotificationItem): void {
    this.items.update((list) => list.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
  }

  protected markAll(): void {
    this.items.update((list) => list.map((entry) => ({ ...entry, read: true })));
  }

  protected readonly code = `<sol-notification-panel
  [items]="notifications()"
  [loading]="loading()"
  [error]="failed()"
  [errorMessage]="backendMessage()"
  (itemSelected)="open($event)"
  (markedRead)="markRead($event)"
  (markedAllRead)="markAll()"
  (retryRequested)="reload()"
  (closed)="close()"
/>

notifications = signal<SolNotificationItem[]>([
  { id: 1, title: 'Invoice #1042 approved', body: '…', timestamp: Date.now(), tone: 'success', typeLabel: 'Billing' },
  { id: 2, title: 'Backup failed', tone: 'danger', read: true },
]);`;
}

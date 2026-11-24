import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SolAvatarComponent, SolButtonComponent, SolMessageStatusComponent, SolVirtualScrollComponent, type SolMessageStatus } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

interface ChatMessage {
  readonly id: number;
  readonly author: string;
  readonly text: string;
  readonly status: SolMessageStatus;
}

const AUTHORS = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper'];
const LINES = [
  'The deployment finished without errors.',
  'Can someone review the calendar changes?',
  'I pushed the fix for the dark mode contrast.',
  'Meeting moved to 3 pm.',
  'The new kanban keyboard moves feel great.',
];
const STATUSES: SolMessageStatus[] = ['read', 'delivered', 'sent'];

function makeMessages(from: number, count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, offset) => {
    const id = from + offset;
    return { id, author: AUTHORS[id % AUTHORS.length], text: `#${id} ${LINES[id % LINES.length]}`, status: STATUSES[id % STATUSES.length] };
  });
}

@Component({
  selector: 'app-virtual-scroll-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolVirtualScrollComponent, SolAvatarComponent, SolMessageStatusComponent, SolButtonComponent],
  template: `
    <app-page
      title="Virtual scroll"
      lead="Renders only the visible window of a long list with variable item heights. Built for chat-like feeds: follows new output and loads history at the top."
      [selectors]="['sol-virtual-scroll']"
    >
      <app-demo [title]="messages().length + ' messages'" description="Scroll up to load older messages (nearTop); add a message to see followOutput." [code]="code" [stack]="true">
        <div class="row">
          <sol-button size="sm" (clicked)="append()">Add message</sol-button>
          <span class="hint">At bottom: {{ atBottom() ? 'yes' : 'no' }}</span>
        </div>
        <div class="viewport">
          <sol-virtual-scroll [items]="messages()" [itemKey]="byId" [estimatedItemHeight]="64" (nearTop)="loadOlder()" (atBottomChange)="atBottom.set($event)">
            <ng-template let-message>
              <div class="message">
                <sol-avatar [name]="message.author" size="sm" />
                <div class="bubble">
                  <strong>{{ message.author }}</strong>
                  <span>{{ message.text }}</span>
                </div>
                <sol-message-status [status]="message.status" />
              </div>
            </ng-template>
          </sol-virtual-scroll>
        </div>
      </app-demo>
    </app-page>
  `,
  styles: `
    .viewport {
      height: 360px;
      display: flex;
      flex-direction: column;
      border: var(--sol-border-width-default) solid var(--sol-border-color-default);
      border-radius: var(--sol-border-radius-md);
      overflow: hidden;
    }
    .viewport sol-virtual-scroll {
      flex: 1;
      min-height: 0;
    }
    .message {
      display: flex;
      align-items: flex-start;
      gap: var(--sol-space-sm);
      padding: var(--sol-space-sm) var(--sol-space-md);
    }
    .bubble {
      flex: 1;
      display: grid;
      gap: 2px;
      font-size: var(--sol-font-size-sm);
      color: var(--sol-color-text-primary);
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sol-space-md);
    }
    .hint {
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class VirtualScrollPage {
  protected readonly messages = signal<ChatMessage[]>(makeMessages(1000, 2000));
  protected readonly atBottom = signal(true);
  protected readonly byId = (message: ChatMessage): number => message.id;
  private loading = false;

  protected loadOlder(): void {
    const first = this.messages()[0]?.id ?? 0;
    if (this.loading || first <= 0) {
      return;
    }
    this.loading = true;
    setTimeout(() => {
      const count = Math.min(100, first);
      this.messages.update((list) => [...makeMessages(first - count, count), ...list]);
      this.loading = false;
    }, 300);
  }

  protected append(): void {
    const last = this.messages().at(-1)?.id ?? 0;
    this.messages.update((list) => [...list, ...makeMessages(last + 1, 1)]);
  }

  protected readonly code = `<sol-virtual-scroll
  [items]="messages()"
  [itemKey]="byId"                 <!-- (item, index) => string | number -->
  [estimatedItemHeight]="64"
  [bufferPx]="240"
  [followOutput]="true"
  (nearTop)="loadOlder()"
  (atBottomChange)="atBottom.set($event)"
>
  <ng-template let-message let-index="index">
    <div class="message">{{ message.text }}</div>
  </ng-template>
</sol-virtual-scroll>`;
}

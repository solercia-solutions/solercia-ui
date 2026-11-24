import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  SolAvatarComponent,
  SolBadgeComponent,
  SolMessageStatusComponent,
  SolScoreBadgeComponent,
  SolTrendComponent,
  type SolMessageStatus,
  type SolScoreThreshold,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-status-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageComponent,
    DemoComponent,
    SolBadgeComponent,
    SolMessageStatusComponent,
    SolScoreBadgeComponent,
    SolTrendComponent,
    SolAvatarComponent,
  ],
  template: `
    <app-page
      title="Badges & indicators"
      lead="Small, read-only atoms that communicate status, score, trend and identity."
      [selectors]="['sol-badge', 'sol-message-status', 'sol-score-badge', 'sol-trend', 'sol-avatar']"
    >
      <app-demo title="Badge" [code]="badgeCode">
        <sol-badge variant="success">Active</sol-badge>
        <sol-badge variant="warning">Pending</sol-badge>
        <sol-badge variant="danger">Overdue</sol-badge>
        <sol-badge variant="info">New</sol-badge>
        <sol-badge>Draft</sol-badge>
        <sol-badge variant="success" size="md">Medium size</sol-badge>
      </app-demo>

      <app-demo title="Message status" description="Delivery ticks for chat-like threads; the label is announced to screen readers." [code]="messageCode">
        @for (status of statuses; track status) {
          <span class="labelled"><sol-message-status [status]="status" /> {{ status }}</span>
        }
      </app-demo>

      <app-demo title="Score badge" description="Tone comes from thresholds (defaults: danger up to 49, warning up to 79, success above)." [code]="scoreCode">
        <sol-score-badge [value]="32" />
        <sol-score-badge [value]="68" />
        <sol-score-badge [value]="91" />
        <sol-score-badge [value]="4" [max]="5" [thresholds]="fiveScale" />
        <sol-score-badge [value]="null" />
        <sol-score-badge [pending]="true" />
      </app-demo>

      <app-demo title="Trend" description="Compares current vs previous; invert flips the tone when lower is better." [code]="trendCode">
        <span class="labelled">Revenue <sol-trend [current]="128" [previous]="100" /></span>
        <span class="labelled">Churn <sol-trend [current]="4" [previous]="6" [invert]="true" /></span>
        <span class="labelled">Tickets <sol-trend [current]="40" [previous]="40" /></span>
        <span class="labelled">New KPI <sol-trend [current]="12" [previous]="null" /></span>
        <span class="labelled">Custom <sol-trend [current]="1500" [previous]="1200" [format]="money" /></span>
      </app-demo>

      <app-demo title="Avatar" description="Image when available; otherwise initials on a palette color derived from the name." [code]="avatarCode">
        <sol-avatar name="Ada Lovelace" size="sm" />
        <sol-avatar name="Alan Turing" />
        <sol-avatar name="Grace Hopper" size="lg" />
        <sol-avatar name="Solercia" imageUrl="solercia-mark.svg" size="lg" />
        <sol-avatar [name]="null" />
      </app-demo>
    </app-page>
  `,
  styles: `
    .labelled {
      display: inline-flex;
      align-items: center;
      gap: var(--sol-space-xs);
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class StatusPage {
  protected readonly statuses: SolMessageStatus[] = ['pending', 'sent', 'delivered', 'read', 'failed'];
  protected readonly fiveScale: SolScoreThreshold[] = [
    { upTo: 2, tone: 'danger' },
    { upTo: 3, tone: 'warning' },
    { upTo: 5, tone: 'success' },
  ];
  protected readonly money = (delta: number): string => `${delta >= 0 ? '+' : '-'}$${Math.abs(delta)}`;

  protected readonly badgeCode = `<sol-badge variant="success">Active</sol-badge>
<sol-badge variant="warning">Pending</sol-badge>
<sol-badge variant="danger">Overdue</sol-badge>
<sol-badge variant="info">New</sol-badge>
<sol-badge>Draft</sol-badge>                         <!-- variant="neutral" -->
<sol-badge variant="success" size="md">Medium</sol-badge>`;
  protected readonly messageCode = `<sol-message-status status="read" />   <!-- pending | sent | delivered | read | failed -->`;
  protected readonly scoreCode = `<sol-score-badge [value]="68" />
<sol-score-badge [value]="4" [max]="5" [thresholds]="[{ upTo: 2, tone: 'danger' }, { upTo: 3, tone: 'warning' }, { upTo: 5, tone: 'success' }]" />
<sol-score-badge [value]="null" />
<sol-score-badge [pending]="true" />`;
  protected readonly trendCode = `<sol-trend [current]="128" [previous]="100" />
<sol-trend [current]="4" [previous]="6" [invert]="true" />
<sol-trend [current]="1500" [previous]="1200" [format]="money" />  <!-- (delta: number) => string -->`;
  protected readonly avatarCode = `<sol-avatar name="Ada Lovelace" size="sm" />
<sol-avatar name="Grace Hopper" size="lg" />
<sol-avatar name="Solercia" imageUrl="/logo.svg" />`;
}

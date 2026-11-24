import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  SolTimelineComponent,
  type SolTimelineStatusResolver,
  type TimelineLegendItem,
  type TimelineNode,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-timeline-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolTimelineComponent],
  template: `
    <app-page
      title="Timeline"
      lead="Gantt-like hierarchy positioned on a shared month axis. Undated nodes are listed apart."
      [selectors]="['sol-timeline']"
    >
      <app-demo title="Project plan" description="Status colors come from the default resolver (done, in progress, pending, blocked, at risk)." [code]="code" [stack]="true">
        <div class="scroll-x"><sol-timeline
          [nodes]="nodes"
          [legend]="legend"
          (nodeClicked)="log.set('Clicked: ' + ($event.label ?? $event.id))"
          (nodeToggled)="log.set(($event.collapsed ? 'Collapsed ' : 'Expanded ') + $event.id)"
        /></div>
        <p class="hint">{{ log() || 'Click or collapse a node.' }}</p>
      </app-demo>

      <app-demo title="Custom status colors, not collapsible" [code]="customCode" [stack]="true">
        <div class="scroll-x"><sol-timeline [nodes]="nodes" [statusToken]="brandStatus" [collapsible]="false" /></div>
      </app-demo>

      <app-demo title="Empty" [stack]="true">
        <div class="scroll-x"><sol-timeline [nodes]="[]" /></div>
      </app-demo>
    </app-page>
  `,
  styles: `
    .scroll-x {
      overflow-x: auto;
    }
    .scroll-x sol-timeline {
      display: block;
      min-width: 640px;
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class TimelinePage {
  protected readonly nodes: TimelineNode[] = [
    {
      id: 'discovery',
      labelKey: 'showcase.timeline.discovery',
      start: '2026-01-12',
      end: '2026-03-20',
      status: 'done',
      children: [
        { id: 'research', labelKey: 'showcase.timeline.research', start: '2026-01-12', end: '2026-02-14', status: 'done' },
        { id: 'scope', labelKey: 'showcase.timeline.scope', start: '2026-02-10', end: '2026-03-20', status: 'done' },
      ],
    },
    {
      id: 'build',
      labelKey: 'showcase.timeline.build',
      start: '2026-03-23',
      end: '2026-09-30',
      status: 'in progress',
      children: [
        { id: 'api', labelKey: 'showcase.timeline.api', start: '2026-03-23', end: '2026-07-15', status: 'done' },
        { id: 'web', labelKey: 'showcase.timeline.web', start: '2026-05-04', end: '2026-09-30', status: 'at risk' },
      ],
    },
    { id: 'launch', labelKey: 'showcase.timeline.launch', start: '2026-10-05', end: '2026-12-11', status: 'pending' },
    { id: 'retro', label: 'Retrospective (date to be defined)', status: 'pending' },
  ];
  protected readonly legend: TimelineLegendItem[] = [
    { status: 'done', labelKey: 'showcase.timeline.done' },
    { status: 'in progress', labelKey: 'showcase.timeline.inProgress' },
    { status: 'pending', labelKey: 'showcase.timeline.pending' },
  ];
  protected readonly brandStatus: SolTimelineStatusResolver = (status) =>
    status === 'done' ? 'var(--sol-color-secondary)' : 'var(--sol-color-accent)';
  protected readonly log = signal('');

  protected readonly code = `<sol-timeline [nodes]="nodes" [legend]="legend" (nodeClicked)="open($event)" (nodeToggled)="persist($event)" />

nodes: TimelineNode[] = [
  { id: 'discovery', labelKey: 'showcase.timeline.discovery', start: '2026-01-12', end: '2026-03-20', status: 'done',
    children: [{ id: 'research', label: 'User research', start: '2026-01-12', end: '2026-02-14', status: 'done' }] },
  { id: 'retro', label: 'Retrospective', status: 'pending' },   // undated
];
legend: TimelineLegendItem[] = [{ status: 'done', labelKey: 'showcase.timeline.done' }];`;
  protected readonly customCode = `<sol-timeline [nodes]="nodes" [statusToken]="brandStatus" [collapsible]="false" />

brandStatus: SolTimelineStatusResolver = (status) =>
  status === 'done' ? 'var(--sol-color-secondary)' : 'var(--sol-color-accent)';`;
}

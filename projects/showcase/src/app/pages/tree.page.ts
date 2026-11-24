import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SolBadgeComponent, SolTreeComponent, SolTreeNodeDefDirective, type SolTreeNode } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

interface ProjectData {
  readonly method: string;
}

@Component({
  selector: 'app-tree-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolTreeComponent, SolTreeNodeDefDirective, SolBadgeComponent],
  template: `
    <app-page
      title="Tree"
      lead="Accessible hierarchical list (role tree) with keyboard navigation, up to SOL_TREE_MAX_DEPTH (5) levels."
      [selectors]="['sol-tree', '[solTreeNodeDef]']"
    >
      <app-demo title="Default rendering" description="defaultExpandedDepth=1 opens the first level." [code]="defaultCode" [stack]="true">
        <sol-tree [nodes]="nodes" ariaLabel="Portfolio" (nodeSelected)="selected.set($event.label)" />
        <p class="hint">Selected: {{ selected() || '—' }}</p>
      </app-demo>

      <app-demo title="Custom node template and two-way expansion" [code]="templateCode" [stack]="true">
        <sol-tree [nodes]="nodes" [(expandedIds)]="expanded" [indent]="24" (nodeToggled)="toggles.set(toggles() + 1)">
          <ng-template solTreeNodeDef let-node let-depth="depth">
            <span class="node">{{ node.label }}</span>
            @if (methodOf(node); as method) {
              <sol-badge variant="info">{{ method }}</sol-badge>
            }
          </ng-template>
        </sol-tree>
        <p class="hint">Expanded: {{ expanded()?.join(', ') || 'none' }} · Toggles: {{ toggles() }}</p>
      </app-demo>
    </app-page>
  `,
  styles: `
    .node {
      margin-right: var(--sol-space-sm);
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class TreePage {
  protected readonly nodes: SolTreeNode<ProjectData>[] = [
    {
      id: 'digital',
      label: 'Digital transformation',
      children: [
        {
          id: 'portal',
          label: 'Citizen portal',
          data: { method: 'Scrum' },
          children: [
            { id: 'portal-auth', label: 'Single sign-on', data: { method: 'Kanban' } },
            { id: 'portal-pay', label: 'Online payments' },
          ],
        },
        { id: 'data', label: 'Open data', data: { method: 'Waterfall' } },
      ],
    },
    {
      id: 'ops',
      label: 'Operations',
      children: [{ id: 'helpdesk', label: 'Help desk', data: { method: 'ITIL' } }],
    },
    { id: 'legal', label: 'Legal' },
  ];
  protected readonly selected = signal('');
  protected readonly expanded = signal<readonly string[] | null>(['digital', 'portal']);
  protected readonly toggles = signal(0);

  /** The node template context is not generic over the tree input, so narrow the data here. */
  protected methodOf(node: SolTreeNode<unknown>): string {
    const data = node.data as ProjectData | undefined;
    return data?.method ?? '';
  }

  protected readonly defaultCode = `<sol-tree [nodes]="nodes" ariaLabel="Portfolio" (nodeSelected)="open($event)" />

nodes: SolTreeNode<ProjectData>[] = [
  { id: 'digital', label: 'Digital transformation', children: [
    { id: 'portal', label: 'Citizen portal', data: { method: 'Scrum' } },
  ] },
];`;
  protected readonly templateCode = `<sol-tree [nodes]="nodes" [(expandedIds)]="expanded" [indent]="24" (nodeToggled)="persist($event.expandedIds)">
  <ng-template solTreeNodeDef let-node let-depth="depth">
    <span>{{ node.label }}</span>
    <sol-badge variant="info">{{ node.data?.method }}</sol-badge>
  </ng-template>
</sol-tree>`;
}

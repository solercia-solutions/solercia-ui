import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  SolBadgeComponent,
  SolFlowCanvasComponent,
  SolToggleComponent,
  type SolFlowCanvasEdge,
  type SolFlowCanvasNode,
} from '@solercia/ui';
import { FormsModule } from '@angular/forms';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

const NODES: SolFlowCanvasNode[] = [
  { id: 'start', label: 'Incoming message', kind: 'trigger', position: { x: 40, y: 120 }, visualState: 'ok' },
  { id: 'intent', label: 'Detect intent', kind: 'ai', position: { x: 300, y: 120 }, visualState: 'running', badges: [{ id: 'llm', label: 'LLM' }] },
  { id: 'faq', label: 'Answer FAQ', kind: 'action', position: { x: 560, y: 40 }, visualState: 'idle' },
  { id: 'agent', label: 'Hand off to agent', kind: 'action', position: { x: 560, y: 220 }, visualState: 'error' },
];

const EDGES: SolFlowCanvasEdge[] = [
  { id: 'e1', sourceId: 'start', targetId: 'intent', kind: 'always' },
  { id: 'e2', sourceId: 'intent', targetId: 'faq', kind: 'intent', label: 'faq' },
  { id: 'e3', sourceId: 'intent', targetId: 'agent', kind: 'condition', label: 'confidence < 0.6', priority: 1 },
];

@Component({
  selector: 'app-flow-canvas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageComponent, DemoComponent, SolFlowCanvasComponent, SolBadgeComponent, SolToggleComponent],
  template: `
    <ng-template #nodeTpl let-node let-selected="selected">
      <div class="node" [class.node--selected]="selected">
        <sol-badge [variant]="node.kind === 'ai' ? 'info' : 'neutral'">{{ node.kind }}</sol-badge>
        <span>{{ node.label }}</span>
      </div>
    </ng-template>

    <app-page
      title="Flow canvas"
      lead="Pan/zoom canvas for node graphs: drag nodes, connect ports, keyboard moves with announcements and dagre auto-layout (Arrange)."
      [selectors]="['sol-flow-canvas']"
    >
      <app-demo title="Editable flow" description="Drag nodes, select one, or use Arrange. Positions are owned by the host (nodeMoved)." [code]="code" [stack]="true">
        <sol-toggle label="Read-only" [(ngModel)]="readonly" />
        <div class="canvas">
          <sol-flow-canvas
            [nodes]="nodes()"
            [edges]="edges()"
            [readonly]="readonly()"
            [selectedId]="selectedId()"
            [highlightedNodeId]="'intent'"
            (nodeMoved)="move($event.id, $event.position)"
            (nodeSelected)="selectedId.set($event.id)"
            (connectionCreated)="connect($event.sourceId, $event.targetId)"
            (connectionRemoved)="disconnect($event.id)"
          />
        </div>
        <p class="hint">Selected: {{ selectedId() ?? '—' }} · {{ edges().length }} connections</p>
      </app-demo>

      <app-demo title="Custom node template" [code]="templateCode" [stack]="true">
        <div class="canvas">
          <sol-flow-canvas [nodes]="nodes()" [edges]="edges()" [readonly]="true" [nodeTemplate]="nodeTpl" />
        </div>
      </app-demo>
    </app-page>
  `,
  styles: `
    .canvas {
      height: 380px;
      border: var(--sol-border-width-default) solid var(--sol-border-color-default);
      border-radius: var(--sol-border-radius-md);
      overflow: hidden;
    }
    .canvas sol-flow-canvas {
      display: block;
      height: 100%;
    }
    .node {
      display: grid;
      gap: var(--sol-space-xs);
      font-size: var(--sol-font-size-sm);
      color: var(--sol-color-text-primary);
    }
    .node--selected span {
      font-weight: var(--sol-font-weight-bold);
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class FlowCanvasPage {
  protected readonly nodes = signal<SolFlowCanvasNode[]>(NODES);
  protected readonly edges = signal<SolFlowCanvasEdge[]>(EDGES);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly readonly = signal(false);
  private nextEdge = 100;

  protected move(id: string, position: { x: number; y: number }): void {
    this.nodes.update((list) => list.map((node) => (node.id === id ? { ...node, position } : node)));
  }

  protected connect(sourceId: string, targetId: string): void {
    this.edges.update((list) => [...list, { id: `e${this.nextEdge++}`, sourceId, targetId, kind: 'always' }]);
  }

  protected disconnect(id: string): void {
    this.edges.update((list) => list.filter((edge) => edge.id !== id));
  }

  protected readonly code = `<sol-flow-canvas
  [nodes]="nodes()"
  [edges]="edges()"
  [readonly]="false"
  [selectedId]="selectedId()"
  [highlightedNodeId]="'intent'"
  (nodeMoved)="move($event.id, $event.position)"
  (nodeSelected)="selectedId.set($event.id)"
  (connectionCreated)="connect($event.sourceId, $event.targetId)"
  (connectionRemoved)="disconnect($event.id)"
/>

nodes: SolFlowCanvasNode[] = [
  { id: 'start', label: 'Incoming message', kind: 'trigger', position: { x: 40, y: 120 }, visualState: 'ok' },
  { id: 'intent', label: 'Detect intent', kind: 'ai', position: { x: 300, y: 120 }, badges: [{ id: 'llm', label: 'LLM' }] },
];
edges: SolFlowCanvasEdge[] = [
  { id: 'e1', sourceId: 'start', targetId: 'intent', kind: 'always' },   // 'always' | 'intent' | 'condition'
];`;
  protected readonly templateCode = `<ng-template #nodeTpl let-node let-selected="selected">
  <sol-badge>{{ node.kind }}</sol-badge> {{ node.label }}
</ng-template>
<sol-flow-canvas [nodes]="nodes()" [edges]="edges()" [readonly]="true" [nodeTemplate]="nodeTpl" />`;
}

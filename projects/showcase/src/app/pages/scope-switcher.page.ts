import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  SolScopeSwitcherComponent,
  SolViewToggleComponent,
  type SolScope,
  type SolScopeSwitcherStatus,
  type SolViewToggleOption,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-scope-switcher-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolScopeSwitcherComponent, SolViewToggleComponent],
  template: `
    <app-page
      title="Scope switcher"
      lead="Switch the active organization, workspace or tenant. Loading, error and empty states are built in."
      [selectors]="['sol-scope-switcher']"
    >
      <app-demo title="Switcher" description="Pick a status to preview each state, then open the menu." [code]="code" [stack]="true">
        <sol-view-toggle [options]="statusOptions" [value]="status()" (valueChange)="setStatus($event)" />
        <div class="bar">
          <sol-scope-switcher
            [scopes]="scopes"
            [activeScopeId]="activeId()"
            [status]="status()"
            align="start"
            errorMessage="We could not switch the workspace."
            (scopeSelected)="activeId.set($event.id)"
            (openChange)="open.set($event)"
          />
          <sol-scope-switcher [scopes]="[]" align="start" emptyMessage="You have no workspaces yet" />
          <sol-scope-switcher [scopes]="scopes" [activeScopeId]="activeId()" [disabled]="true" align="start" />
        </div>
        <p class="hint">Active: {{ activeId() }} · Menu {{ open() ? 'open' : 'closed' }}</p>
      </app-demo>
    </app-page>
  `,
  styles: `
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sol-space-md);
      align-items: center;
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class ScopeSwitcherPage {
  protected readonly scopes: SolScope[] = [
    { id: 'acme', label: 'Acme Inc.', sublabel: 'Owner', icon: 'building' },
    { id: 'globex', label: 'Globex', sublabel: 'Admin', icon: 'briefcase' },
    { id: 'solercia', label: 'Solercia', sublabel: 'Member', imageUrl: 'solercia-mark.svg' },
  ];
  protected readonly statusOptions: SolViewToggleOption[] = [
    { value: 'idle', label: 'Idle' },
    { value: 'loading', label: 'Loading' },
    { value: 'error', label: 'Error' },
  ];
  protected readonly status = signal<SolScopeSwitcherStatus>('idle');
  protected readonly activeId = signal('acme');
  protected readonly open = signal(false);

  protected setStatus(value: string): void {
    this.status.set(value === 'loading' || value === 'error' ? value : 'idle');
  }

  protected readonly code = `<sol-scope-switcher
  [scopes]="workspaces"
  [activeScopeId]="activeId()"
  [status]="status()"              <!-- 'idle' | 'loading' | 'error' -->
  [disabled]="switching()"
  align="start"
  errorMessage="We could not switch the workspace."
  (scopeSelected)="switchTo($event)"
  (openChange)="open.set($event)"
/>

workspaces: SolScope[] = [
  { id: 'acme', label: 'Acme Inc.', sublabel: 'Owner', icon: 'building' },
  { id: 'solercia', label: 'Solercia', imageUrl: '/logo.svg' },
];`;
}

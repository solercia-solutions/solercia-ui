import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  SolButtonComponent,
  SolPageHeaderComponent,
  SolPaginationComponent,
  SolTabsComponent,
  type SolTabItem,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-navigation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolTabsComponent, SolPaginationComponent, SolPageHeaderComponent, SolButtonComponent],
  template: `
    <app-page
      title="Tabs, pagination & page header"
      lead="Navigation within a page. Tabs only render the tab list: the host renders the active panel."
      [selectors]="['sol-tabs', 'sol-pagination', 'sol-page-header']"
    >
      <app-demo title="Tabs" [code]="tabsCode" [stack]="true">
        <sol-tabs [tabs]="tabs" [activeTab]="tab()" (tabChange)="tab.set($event)" />
        <p class="panel">
          @switch (tab()) {
            @case ('overview') { Project overview with the key metrics. }
            @case ('team') { Five people work on this project. }
            @case ('files') { 12 files, 48 MB in total. }
            @default { Activity feed. }
          }
        </p>
      </app-demo>

      <app-demo title="Pagination" description="The page size selector emits pageSizeChanged." [code]="paginationCode" [stack]="true">
        <sol-pagination
          [totalItems]="237"
          [pageSize]="pageSize()"
          [currentPage]="page()"
          [pageSizeOptions]="[10, 25, 50, 100]"
          (pageChanged)="page.set($event)"
          (pageSizeChanged)="resize($event)"
        />
        <p class="panel">Showing {{ range() }} of 237</p>
      </app-demo>

      <app-demo title="Page header" description="Title, subtitle and projected actions." [code]="headerCode" [stack]="true">
        <sol-page-header title="Projects" subtitle="Manage the portfolio of your organization">
          <sol-button variant="secondary">Export</sol-button>
          <sol-button>New project</sol-button>
        </sol-page-header>
        <sol-page-header title="Settings" />
      </app-demo>
    </app-page>
  `,
  styles: `
    .panel {
      margin: 0;
      color: var(--sol-color-text-secondary);
    }
  `,
})
export class NavigationPage {
  protected readonly tabs: SolTabItem[] = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'team', label: 'Team', icon: 'users' },
    { id: 'files', label: 'Files', icon: 'folder' },
    { id: 'activity', label: 'Activity' },
  ];
  protected readonly tab = signal('overview');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);
  protected readonly range = computed(() => {
    const start = (this.page() - 1) * this.pageSize() + 1;
    return `${start}–${Math.min(237, start + this.pageSize() - 1)}`;
  });

  protected resize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  protected readonly tabsCode = `<sol-tabs [tabs]="tabs" [activeTab]="tab()" (tabChange)="tab.set($event)" />

tabs: SolTabItem[] = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'team', label: 'Team', icon: 'users' },
];`;
  protected readonly paginationCode = `<sol-pagination
  [totalItems]="237"
  [pageSize]="pageSize()"
  [currentPage]="page()"
  [pageSizeOptions]="[10, 25, 50, 100]"
  (pageChanged)="page.set($event)"
  (pageSizeChanged)="pageSize.set($event)"
/>`;
  protected readonly headerCode = `<sol-page-header title="Projects" subtitle="Manage the portfolio of your organization">
  <sol-button (clicked)="create()">New project</sol-button>
</sol-page-header>`;
}

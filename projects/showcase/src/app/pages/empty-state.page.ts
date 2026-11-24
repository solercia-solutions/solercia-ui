import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SolButtonComponent, SolEmptyStateComponent } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-empty-state-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolEmptyStateComponent, SolButtonComponent],
  template: `
    <app-page
      title="Empty state"
      lead="Distinguish a legitimate empty list, an empty filter result and a failed request. Texts come from i18n keys."
      [selectors]="['sol-empty-state']"
    >
      <app-demo title="Legitimate empty" description="With a call to action projected as content." [code]="emptyCode" [stack]="true">
        <sol-empty-state icon="folder-open" titleKey="showcase.empty.title" descriptionKey="showcase.empty.description">
          <sol-button>Create project</sol-button>
        </sol-empty-state>
      </app-demo>

      <app-demo title="No results for a filter" [code]="filterCode" [stack]="true">
        <sol-empty-state icon="funnel" titleKey="showcase.empty.searchTitle" descriptionKey="showcase.empty.searchDescription">
          <sol-button variant="secondary">Clear filters</sol-button>
        </sol-empty-state>
      </app-demo>

      <app-demo title="Error" [code]="errorCode" [stack]="true">
        <sol-empty-state icon="exclamation-triangle" titleKey="showcase.empty.errorTitle" descriptionKey="showcase.empty.errorDescription">
          <sol-button variant="ghost">Retry</sol-button>
        </sol-empty-state>
      </app-demo>
    </app-page>
  `,
})
export class EmptyStatePage {
  protected readonly emptyCode = `<sol-empty-state icon="folder-open" titleKey="showcase.empty.title" descriptionKey="showcase.empty.description">
  <sol-button (clicked)="create()">Create project</sol-button>
</sol-empty-state>`;
  protected readonly filterCode = `<sol-empty-state icon="funnel" titleKey="showcase.empty.searchTitle" descriptionKey="showcase.empty.searchDescription">
  <sol-button variant="secondary" (clicked)="clearFilters()">Clear filters</sol-button>
</sol-empty-state>`;
  protected readonly errorCode = `<sol-empty-state icon="exclamation-triangle" titleKey="showcase.empty.errorTitle" descriptionKey="showcase.empty.errorDescription">
  <sol-button variant="ghost" (clicked)="reload()">Retry</sol-button>
</sol-empty-state>`;
}

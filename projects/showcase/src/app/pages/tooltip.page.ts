import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SolBadgeComponent, SolIconButtonComponent, SolIconComponent, SolTooltipComponent } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-tooltip-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolTooltipComponent, SolIconButtonComponent, SolIconComponent, SolBadgeComponent],
  template: `
    <app-page title="Tooltip" lead="Short hint shown on hover and keyboard focus of the wrapped element." [selectors]="['sol-tooltip']">
      <app-demo title="Wrapping different triggers" description="Hover or tab to each element." [code]="code">
        <sol-tooltip text="Edit the project">
          <sol-icon-button icon="edit" ariaLabel="Edit" />
        </sol-tooltip>
        <sol-tooltip text="Synced 2 minutes ago">
          <sol-icon name="check-circle" size="lg" />
        </sol-tooltip>
        <sol-tooltip text="Assigned to 3 people">
          <sol-badge variant="info">Shared</sol-badge>
        </sol-tooltip>
      </app-demo>
    </app-page>
  `,
})
export class TooltipPage {
  protected readonly code = `<sol-tooltip text="Edit the project">
  <sol-icon-button icon="edit" ariaLabel="Edit" />
</sol-tooltip>`;
}

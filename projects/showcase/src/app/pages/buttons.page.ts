import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SolButtonComponent, SolIconButtonComponent } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-buttons-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolButtonComponent, SolIconButtonComponent],
  template: `
    <app-page title="Button & icon button" lead="Primary actions with text, and compact icon-only actions." [selectors]="['sol-button', 'sol-icon-button']">
      <app-demo title="Variants" [code]="variantsCode">
        <sol-button>Primary</sol-button>
        <sol-button variant="secondary">Secondary</sol-button>
        <sol-button variant="danger">Delete</sol-button>
        <sol-button variant="ghost">Ghost</sol-button>
      </app-demo>

      <app-demo title="Sizes" description="touch keeps a 44 px target for mobile." [code]="sizesCode">
        <sol-button size="sm">Small</sol-button>
        <sol-button size="md">Medium</sol-button>
        <sol-button size="lg">Large</sol-button>
        <sol-button size="touch">Touch</sol-button>
      </app-demo>

      <app-demo title="States" description="loading shows a spinner and blocks clicks." [code]="statesCode">
        <sol-button [loading]="saving()" (clicked)="save()">{{ saving() ? 'Saving…' : 'Save changes' }}</sol-button>
        <sol-button [disabled]="true">Disabled</sol-button>
        <sol-button type="submit" variant="secondary">Submit type</sol-button>
        <span class="counter">Clicked {{ clicks() }} times</span>
      </app-demo>

      <app-demo title="Icon button" description="ariaLabel is required: the button has no visible text." [code]="iconCode">
        <sol-icon-button icon="edit" ariaLabel="Edit" (clicked)="clicks.set(clicks() + 1)" />
        <sol-icon-button icon="trash" variant="danger" ariaLabel="Delete" />
        <sol-icon-button icon="share" variant="ghost" ariaLabel="Share" />
        <sol-icon-button icon="settings" variant="outline" ariaLabel="Settings" />
        <sol-icon-button icon="plus" size="sm" ariaLabel="Add (small)" />
        <sol-icon-button icon="plus" size="lg" ariaLabel="Add (large)" />
        <sol-icon-button icon="bell" size="touch" ariaLabel="Notifications (touch)" />
        <sol-icon-button icon="lock-closed" [disabled]="true" ariaLabel="Locked" />
      </app-demo>
    </app-page>
  `,
  styles: `
    .counter {
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class ButtonsPage {
  protected readonly saving = signal(false);
  protected readonly clicks = signal(0);

  protected save(): void {
    this.clicks.update((value) => value + 1);
    this.saving.set(true);
    setTimeout(() => this.saving.set(false), 1500);
  }

  protected readonly variantsCode = `<sol-button>Primary</sol-button>
<sol-button variant="secondary">Secondary</sol-button>
<sol-button variant="danger">Delete</sol-button>
<sol-button variant="ghost">Ghost</sol-button>`;
  protected readonly sizesCode = `<sol-button size="sm">Small</sol-button>
<sol-button size="lg">Large</sol-button>
<sol-button size="touch">Touch</sol-button>`;
  protected readonly statesCode = `<sol-button [loading]="saving()" (clicked)="save()">Save changes</sol-button>
<sol-button [disabled]="true">Disabled</sol-button>
<sol-button type="submit">Submit</sol-button>`;
  protected readonly iconCode = `<sol-icon-button icon="edit" ariaLabel="Edit" (clicked)="edit()" />
<sol-icon-button icon="trash" variant="danger" ariaLabel="Delete" />
<sol-icon-button icon="share" variant="ghost" ariaLabel="Share" />
<sol-icon-button icon="settings" variant="outline" ariaLabel="Settings" />
<sol-icon-button icon="bell" size="touch" ariaLabel="Notifications" />`;
}

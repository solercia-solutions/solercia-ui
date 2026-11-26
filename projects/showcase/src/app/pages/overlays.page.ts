import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SolButtonComponent,
  SolConfirmDialogComponent,
  SolDrawerComponent,
  SolInputComponent,
  SolModalComponent,
  type SolConfirmDialogVariant,
  type SolDrawerSide,
  type SolDrawerSize,
  type SolDrawerVariant,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-overlays-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageComponent,
    DemoComponent,
    SolButtonComponent,
    SolModalComponent,
    SolDrawerComponent,
    SolConfirmDialogComponent,
    SolInputComponent,
  ],
  template: `
    <app-page
      title="Modal, drawer & confirm"
      lead="Overlays trap focus, lock body scroll and close with Escape. The host owns the open state."
      [selectors]="['sol-modal', 'sol-drawer', 'sol-confirm-dialog']"
    >
      <app-demo title="Modal" description="Sizes sm to xl; closeOnBackdrop is off by default." [code]="modalCode">
        @for (size of modalSizes; track size) {
          <sol-button variant="secondary" (clicked)="openModal(size)">Open {{ size }}</sol-button>
        }
        <sol-modal [open]="modalOpen()" title="Invite a teammate" [size]="modalSize()" [closeOnBackdrop]="true" (closed)="modalOpen.set(false)">
          <div class="form">
            <sol-input label="Email" type="email" placeholder="teammate@example.com" [(ngModel)]="email" />
            <div class="actions">
              <sol-button variant="ghost" (clicked)="modalOpen.set(false)">Cancel</sol-button>
              <sol-button (clicked)="modalOpen.set(false)">Send invite</sol-button>
            </div>
          </div>
        </sol-modal>
      </app-demo>

      <app-demo title="Drawer" description="panel slides from a side; sheet becomes a bottom sheet. drawerFooter is a named slot." [code]="drawerCode">
        <sol-button variant="secondary" (clicked)="openDrawer('end', 'md', 'panel')">End panel</sol-button>
        <sol-button variant="secondary" (clicked)="openDrawer('start', 'sm', 'panel')">Start, small</sol-button>
        <sol-button variant="secondary" (clicked)="openDrawer('end', 'lg', 'panel')">End, large</sol-button>
        <sol-button variant="secondary" (clicked)="openDrawer('end', 'md', 'sheet')">Sheet</sol-button>
        <sol-drawer
          [open]="drawerOpen()"
          title="Filters"
          [side]="drawerSide()"
          [size]="drawerSize()"
          [variant]="drawerVariant()"
          (closed)="drawerOpen.set(false)"
        >
          <p class="text">Side: {{ drawerSide() }} · Size: {{ drawerSize() }} · Variant: {{ drawerVariant() }}</p>
          <sol-input label="Keyword" placeholder="Search…" />
          <div drawerFooter class="actions">
            <sol-button variant="ghost" (clicked)="drawerOpen.set(false)">Reset</sol-button>
            <sol-button (clicked)="drawerOpen.set(false)">Apply</sol-button>
          </div>
        </sol-drawer>
      </app-demo>

      <app-demo title="Confirm dialog" description="danger, warning and info variants; emits confirm or cancel." [code]="confirmCode">
        <sol-button variant="danger" (clicked)="ask('danger')">Delete project</sol-button>
        <sol-button variant="secondary" (clicked)="ask('warning')">Archive</sol-button>
        <sol-button variant="secondary" (clicked)="ask('info')">Publish</sol-button>
        <span class="text">Last answer: {{ answer() }}</span>
        <sol-confirm-dialog
          [open]="confirmOpen()"
          [variant]="confirmVariant()"
          [title]="confirmTitle()"
          message="This action is logged in the audit trail."
          [confirmLabel]="confirmVariant() === 'danger' ? 'Delete' : 'Continue'"
          (confirm)="close('confirmed')"
          (cancel)="close('cancelled')"
        />
      </app-demo>
    </app-page>
  `,
  styles: `
    .form {
      display: grid;
      gap: var(--sol-space-md);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--sol-space-sm);
    }
    .text {
      margin: 0 0 var(--sol-space-md);
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class OverlaysPage {
  protected readonly modalSizes: ModalSize[] = ['sm', 'md', 'lg', 'xl'];
  protected readonly modalOpen = signal(false);
  protected readonly modalSize = signal<ModalSize>('md');
  protected readonly email = signal('');

  protected readonly drawerOpen = signal(false);
  protected readonly drawerSide = signal<SolDrawerSide>('end');
  protected readonly drawerSize = signal<SolDrawerSize>('md');
  protected readonly drawerVariant = signal<SolDrawerVariant>('panel');

  protected readonly confirmOpen = signal(false);
  protected readonly confirmVariant = signal<SolConfirmDialogVariant>('danger');
  protected readonly confirmTitle = signal('');
  protected readonly answer = signal('—');

  protected openModal(size: ModalSize): void {
    this.modalSize.set(size);
    this.modalOpen.set(true);
  }

  protected openDrawer(side: SolDrawerSide, size: SolDrawerSize, variant: SolDrawerVariant): void {
    this.drawerSide.set(side);
    this.drawerSize.set(size);
    this.drawerVariant.set(variant);
    this.drawerOpen.set(true);
  }

  protected ask(variant: SolConfirmDialogVariant): void {
    const titles: Record<SolConfirmDialogVariant, string> = {
      danger: 'Delete this project?',
      warning: 'Archive this project?',
      info: 'Publish the changes?',
    };
    this.confirmVariant.set(variant);
    this.confirmTitle.set(titles[variant]);
    this.confirmOpen.set(true);
  }

  protected close(answer: string): void {
    this.answer.set(answer);
    this.confirmOpen.set(false);
  }

  protected readonly modalCode = `<sol-button (clicked)="open.set(true)">Invite</sol-button>
<sol-modal [open]="open()" title="Invite a teammate" size="md" [closeOnBackdrop]="true" (closed)="open.set(false)">
  <sol-input label="Email" type="email" [(ngModel)]="email" />
  <sol-button (clicked)="open.set(false)">Send invite</sol-button>
</sol-modal>`;
  protected readonly drawerCode = `<sol-drawer [open]="open()" title="Filters" side="end" size="md" variant="panel" (closed)="open.set(false)">
  <sol-input label="Keyword" />
  <div drawerFooter>
    <sol-button (clicked)="apply()">Apply</sol-button>
  </div>
</sol-drawer>`;
  protected readonly confirmCode = `<sol-confirm-dialog
  [open]="confirming()"
  variant="danger"
  title="Delete this project?"
  message="This action is logged in the audit trail."
  confirmLabel="Delete"            <!-- cancelLabel defaults to shared.confirmDialog.cancel -->
  (confirm)="remove()"
  (cancel)="confirming.set(false)"
/>`;
}

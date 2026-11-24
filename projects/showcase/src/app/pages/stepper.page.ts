import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SolInputComponent,
  SolStepperComponent,
  SolToggleComponent,
  SolWizardComponent,
  SolWizardStepDirective,
  type SolStepperStep,
  type SolWizardStep,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-stepper-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageComponent,
    DemoComponent,
    SolStepperComponent,
    SolWizardComponent,
    SolWizardStepDirective,
    SolInputComponent,
    SolToggleComponent,
  ],
  template: `
    <app-page
      title="Stepper & wizard"
      lead="sol-stepper is the step indicator; sol-wizard composes it with a segmented progress bar, step panels and footer buttons."
      [selectors]="['sol-stepper', 'sol-wizard', '[solWizardStep]']"
    >
      <app-demo title="Stepper — horizontal, linear" description="interactive lets users go back to visited steps." [code]="stepperCode" [stack]="true">
        <sol-stepper [steps]="steps" [activeIndex]="active()" [furthestIndex]="2" [interactive]="true" (stepSelected)="active.set($event)" />
      </app-demo>

      <app-demo title="Stepper — vertical, free navigation, with an error" [code]="verticalCode" [stack]="true">
        <sol-stepper [steps]="stepsWithError" [activeIndex]="1" orientation="vertical" navigation="free" [interactive]="true" />
      </app-demo>

      <app-demo title="Wizard" description="canAdvance blocks Next until the step is valid." [code]="wizardCode" [stack]="true">
        <sol-wizard
          [steps]="wizardSteps"
          [(current)]="current"
          [canAdvance]="canAdvance"
          previousLabel="Back"
          nextLabel="Next"
          finishLabel="Create workspace"
          (finish)="finished.set(true)"
        >
          <ng-container *solWizardStep>
            <sol-input label="Workspace name" placeholder="Acme Inc." [(ngModel)]="workspace" />
          </ng-container>
          <ng-container *solWizardStep>
            <sol-toggle label="Invite my team now" [(ngModel)]="invite" />
          </ng-container>
          <ng-container *solWizardStep>
            <p class="text">Workspace “{{ workspace() }}” · invites {{ invite() ? 'enabled' : 'disabled' }}.</p>
          </ng-container>
        </sol-wizard>
        <p class="text">Step {{ current() + 1 }} of {{ wizardSteps.length }}{{ finished() ? ' · Finished!' : '' }}</p>
      </app-demo>
    </app-page>
  `,
  styles: `
    .text {
      margin: 0;
      color: var(--sol-color-text-secondary);
    }
  `,
})
export class StepperPage {
  protected readonly steps: SolStepperStep[] = [
    { id: 'account', labelKey: 'showcase.stepper.account', descriptionKey: 'showcase.stepper.accountHint' },
    { id: 'profile', labelKey: 'showcase.stepper.profile', descriptionKey: 'showcase.stepper.profileHint' },
    { id: 'billing', labelKey: 'showcase.stepper.billing', descriptionKey: 'showcase.stepper.billingHint' },
    { id: 'review', labelKey: 'showcase.stepper.review', descriptionKey: 'showcase.stepper.reviewHint' },
  ];
  protected readonly stepsWithError: SolStepperStep[] = this.steps.map((step) => (step.id === 'billing' ? { ...step, error: true } : step));
  protected readonly active = signal(1);

  protected readonly wizardSteps: SolWizardStep[] = [
    { id: 'name', label: 'Name', icon: 'building' },
    { id: 'team', label: 'Team', icon: 'users' },
    { id: 'confirm', label: 'Confirm', icon: 'check-circle' },
  ];
  protected readonly current = signal(0);
  protected readonly workspace = signal('');
  protected readonly invite = signal(true);
  protected readonly finished = signal(false);
  private readonly nameValid = computed(() => this.workspace().trim().length >= 2);
  protected readonly canAdvance = (index: number): boolean => index !== 0 || this.nameValid();

  protected readonly stepperCode = `<sol-stepper [steps]="steps" [activeIndex]="active()" [furthestIndex]="2"
             [interactive]="true" (stepSelected)="active.set($event)" />

steps: SolStepperStep[] = [
  { id: 'account', labelKey: 'showcase.stepper.account', descriptionKey: 'showcase.stepper.accountHint' },
  { id: 'profile', labelKey: 'showcase.stepper.profile' },
];`;
  protected readonly verticalCode = `<sol-stepper [steps]="steps" [activeIndex]="1" orientation="vertical" navigation="free" [interactive]="true" />
<!-- a step with error: true renders the error state -->`;
  protected readonly wizardCode = `<sol-wizard [steps]="steps" [(current)]="current" [canAdvance]="canAdvance"
            previousLabel="Back" nextLabel="Next" finishLabel="Create workspace" (finish)="save()">
  <ng-container *solWizardStep><sol-input label="Workspace name" [(ngModel)]="workspace" /></ng-container>
  <ng-container *solWizardStep><sol-toggle label="Invite my team now" [(ngModel)]="invite" /></ng-container>
  <ng-container *solWizardStep>Summary…</ng-container>
</sol-wizard>

steps: SolWizardStep[] = [{ id: 'name', label: 'Name', icon: 'building' }, …];
canAdvance = (index: number) => index !== 0 || this.workspace().trim().length >= 2;`;
}

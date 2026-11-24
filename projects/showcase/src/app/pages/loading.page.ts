import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  SolButtonComponent,
  SolProgressBarComponent,
  SolSkeletonComponent,
  SolSpinnerComponent,
  type SolProgressVariant,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-loading-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolSpinnerComponent, SolSkeletonComponent, SolProgressBarComponent, SolButtonComponent],
  template: `
    <app-page
      title="Spinner, skeleton & progress"
      lead="Loading and progress feedback. Prefer skeletons that mirror the final layout over a lone spinner."
      [selectors]="['sol-spinner', 'sol-skeleton', 'sol-progress-bar']"
    >
      <app-demo title="Spinner" [code]="spinnerCode">
        <sol-spinner size="sm" />
        <sol-spinner />
        <sol-spinner size="lg" />
        <sol-spinner size="lg" color="var(--sol-color-success)" />
      </app-demo>

      <app-demo title="Skeleton" description="Variants for text, titles, stats, cards, rows and avatars; count repeats the block." [code]="skeletonCode" [stack]="true">
        <div class="skeleton-card">
          <sol-skeleton variant="circle" width="48px" height="48px" />
          <div class="skeleton-lines">
            <sol-skeleton variant="title" width="40%" />
            <sol-skeleton variant="text" count="3" />
          </div>
        </div>
        <div class="skeleton-grid">
          <sol-skeleton variant="stat" />
          <sol-skeleton variant="stat" />
          <sol-skeleton variant="stat" />
        </div>
        <sol-skeleton variant="row" count="3" />
        <div class="skeleton-grid">
          <sol-skeleton variant="card" />
          <sol-skeleton variant="rounded" aspectRatio="16 / 9" />
          <sol-skeleton variant="square" width="120px" />
        </div>
      </app-demo>

      <app-demo title="Progress bar — continuous" [code]="continuousCode" [stack]="true">
        @for (variant of variants; track variant) {
          <sol-progress-bar [value]="progress()" [variant]="variant" [showLabel]="true" [label]="variant" />
        }
        <sol-progress-bar [value]="40" size="sm" ariaLabel="Upload progress" />
        <sol-progress-bar [value]="80" size="lg" [showLabel]="true" label="Storage used" />
        <div class="row">
          <sol-button size="sm" variant="secondary" (clicked)="step(-10)">-10</sol-button>
          <sol-button size="sm" (clicked)="step(10)">+10</sol-button>
        </div>
      </app-demo>

      <app-demo title="Progress bar — segmented" description="One segment per step: steps and current." [code]="segmentedCode" [stack]="true">
        <sol-progress-bar mode="segmented" [steps]="5" [current]="2" [showLabel]="true" label="Onboarding" />
        <sol-progress-bar mode="segmented" [steps]="4" [current]="4" variant="success" />
      </app-demo>
    </app-page>
  `,
  styles: `
    .skeleton-card {
      display: flex;
      gap: var(--sol-space-md);
      align-items: flex-start;
    }
    .skeleton-lines {
      flex: 1;
      display: grid;
      gap: var(--sol-space-sm);
    }
    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--sol-space-md);
    }
    .row {
      display: flex;
      gap: var(--sol-space-sm);
    }
  `,
})
export class LoadingPage {
  protected readonly variants: SolProgressVariant[] = ['primary', 'success', 'warning', 'danger'];
  protected readonly progress = signal(60);

  protected step(delta: number): void {
    this.progress.update((value) => Math.min(100, Math.max(0, value + delta)));
  }

  protected readonly spinnerCode = `<sol-spinner size="sm" />
<sol-spinner />
<sol-spinner size="lg" color="var(--sol-color-success)" />`;
  protected readonly skeletonCode = `<sol-skeleton variant="circle" width="48px" height="48px" />
<sol-skeleton variant="title" width="40%" />
<sol-skeleton variant="text" count="3" />
<sol-skeleton variant="stat" />
<sol-skeleton variant="row" count="3" />
<sol-skeleton variant="rounded" aspectRatio="16 / 9" />`;
  protected readonly continuousCode = `<sol-progress-bar [value]="60" variant="success" [showLabel]="true" label="Completed" />
<sol-progress-bar [value]="40" size="sm" ariaLabel="Upload progress" />
<sol-progress-bar [value]="80" [max]="100" size="lg" />`;
  protected readonly segmentedCode = `<sol-progress-bar mode="segmented" [steps]="5" [current]="2" [showLabel]="true" label="Onboarding" />`;
}

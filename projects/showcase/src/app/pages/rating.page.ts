import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SolRatingInputComponent, SolStarRatingComponent } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-rating-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageComponent, DemoComponent, SolRatingInputComponent, SolStarRatingComponent],
  template: `
    <app-page
      title="Rating"
      lead="sol-star-rating is read-only (role img); sol-rating-input is its interactive radiogroup counterpart."
      [selectors]="['sol-rating-input', 'sol-star-rating']"
    >
      <app-demo title="Rating input" description="Arrow keys move between stars; allowClear adds a reset button." [code]="inputCode" [stack]="true">
        <sol-rating-input ariaLabelKey="showcase.rating" [allowClear]="true" [(ngModel)]="score" (ratingChanged)="last.set($event)" />
        <sol-rating-input size="sm" [ngModel]="2" />
        <sol-rating-input size="md" [readOnly]="true" [ngModel]="4" />
        <sol-rating-input [disabled]="true" [ngModel]="3" />
        <sol-rating-input error="Please rate the session." />
        <p class="hint">Value: {{ score() ?? 'none' }} · Last change: {{ last() ?? '—' }}</p>
      </app-demo>

      <app-demo title="Star rating (read-only)" description="Fractional values round to the nearest half star." [code]="starCode">
        <sol-star-rating [value]="4.5" />
        <sol-star-rating [value]="3" size="md" [showValue]="true" />
        <sol-star-rating [value]="score()" size="lg" [showValue]="true" />
        <sol-star-rating [value]="null" [showValue]="true" />
      </app-demo>
    </app-page>
  `,
  styles: `
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class RatingPage {
  protected readonly score = signal<number | null>(4);
  protected readonly last = signal<number | null>(null);

  protected readonly inputCode = `<sol-rating-input ariaLabelKey="showcase.rating" [allowClear]="true" [(ngModel)]="score" (ratingChanged)="save($event)" />
<sol-rating-input size="sm" />
<sol-rating-input [readOnly]="true" [ngModel]="4" />
<sol-rating-input error="Please rate the session." />`;
  protected readonly starCode = `<sol-star-rating [value]="4.5" />
<sol-star-rating [value]="3" size="md" [showValue]="true" />
<sol-star-rating [value]="null" [showValue]="true" />`;
}

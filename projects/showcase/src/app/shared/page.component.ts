import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page frame: heading, the selectors documented on the page and the demos. */
@Component({
  selector: 'app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page__header">
      <h1 class="page__title">{{ title() }}</h1>
      <p class="page__lead">{{ lead() }}</p>
      @if (selectors().length) {
        <ul class="page__selectors" aria-label="Documented selectors">
          @for (selector of selectors(); track selector) {
            <li><code>{{ selector }}</code></li>
          }
        </ul>
      }
    </header>
    <div class="page__body">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .page__header {
      margin-bottom: var(--sol-space-lg);
    }
    .page__title {
      margin: 0;
      font-family: var(--sol-font-display);
      font-size: var(--sol-font-size-xl);
      font-weight: var(--sol-display-weight);
      color: var(--sol-color-text-primary);
    }
    .page__lead {
      margin: var(--sol-space-xs) 0 0;
      color: var(--sol-color-text-secondary);
    }
    .page__selectors {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sol-space-xs);
      margin: var(--sol-space-sm) 0 0;
      padding: 0;
      list-style: none;
    }
    .page__selectors code {
      display: inline-block;
      padding: 2px var(--sol-space-sm);
      border-radius: var(--sol-border-radius-full);
      background: var(--sol-bg-sunken);
      font-family: var(--sol-font-family-mono);
      font-size: var(--sol-font-size-sm);
      color: var(--sol-color-primary);
    }
    .page__body {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sol-space-lg);
    }
  `,
})
export class PageComponent {
  readonly title = input.required<string>();
  readonly lead = input('');
  readonly selectors = input<readonly string[]>([]);
}

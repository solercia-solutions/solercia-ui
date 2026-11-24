import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One live example: title, optional description, the rendered demo and its source. */
@Component({
  selector: 'app-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="demo">
      <header class="demo__header">
        <h2 class="demo__title">{{ title() }}</h2>
        @if (description()) {
          <p class="demo__description">{{ description() }}</p>
        }
      </header>
      <div class="demo__stage" [class.demo__stage--stack]="stack()">
        <ng-content />
      </div>
      @if (code()) {
        <details class="demo__code">
          <summary>Code</summary>
          <pre><code>{{ code() }}</code></pre>
        </details>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .demo {
      background: var(--sol-bg-surface);
      border: var(--sol-border-width-default) solid var(--sol-border-color-default);
      border-radius: var(--sol-border-radius-lg);
      overflow: hidden;
    }
    .demo__header {
      padding: var(--sol-space-md) var(--sol-space-lg) 0;
    }
    .demo__title {
      margin: 0;
      font-size: var(--sol-font-size-lg);
      font-weight: var(--sol-font-weight-bold);
      color: var(--sol-color-text-primary);
    }
    .demo__description {
      margin: var(--sol-space-xs) 0 0;
      font-size: var(--sol-font-size-sm);
      color: var(--sol-color-text-secondary);
    }
    .demo__stage {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sol-space-md);
      padding: var(--sol-space-lg);
    }
    .demo__stage--stack {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }
    @media (max-width: 600px) {
      .demo__header {
        padding: var(--sol-space-md) var(--sol-space-md) 0;
      }
      .demo__stage {
        padding: var(--sol-space-md);
      }
    }
    .demo__code {
      border-top: var(--sol-border-width-default) solid var(--sol-border-color-default);
      background: var(--sol-bg-sunken);
    }
    .demo__code summary {
      cursor: pointer;
      padding: var(--sol-space-sm) var(--sol-space-lg);
      font-size: var(--sol-font-size-sm);
      font-weight: var(--sol-font-weight-bold);
      color: var(--sol-color-text-secondary);
    }
    .demo__code pre {
      margin: 0;
      padding: 0 var(--sol-space-lg) var(--sol-space-md);
      overflow-x: auto;
      font-family: var(--sol-font-family-mono);
      font-size: var(--sol-font-size-sm);
      line-height: 1.5;
      color: var(--sol-color-text-primary);
    }
  `,
})
export class DemoComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly code = input('');
  /** Stacks the demo children vertically and stretches them to the full width. */
  readonly stack = input(false);
}

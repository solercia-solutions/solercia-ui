import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';

@Component({
  selector: 'sol-tooltip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sol-tooltip-wrapper">
      <ng-content />
      <span class="sol-tooltip-text" role="tooltip">{{ text() }}</span>
    </span>
  `,
  styles: `
    .sol-tooltip-wrapper {
      position: relative;
      display: inline-flex;
    }

    .sol-tooltip-text {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 8px;
      background: var(--sol-color-text-primary, #0F172A);
      color: #fff;
      font-size: var(--sol-font-size-sm, 12px);
      font-family: var(--sol-font-family);
      border-radius: var(--sol-border-radius-sm, 6px);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: var(--sol-z-tooltip, 1100);
    }

    .sol-tooltip-wrapper:hover .sol-tooltip-text {
      opacity: 1;
    }
  `,
})
export class SolTooltipComponent {
  readonly text = input.required<string>();
}

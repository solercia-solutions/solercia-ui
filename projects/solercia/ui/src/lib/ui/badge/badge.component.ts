import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'sol-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="hostClasses()" [style]="hostStyles()">
      <ng-content />
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .sol-badge {
      display: inline-flex;
      align-items: center;
      font-weight: 500;
      white-space: nowrap;
      border-radius: var(--sol-border-radius-full, 9999px);
      line-height: 1;
    }

    .sol-badge-sm {
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
    }

    .sol-badge-md {
      padding: 0.25rem 0.75rem;
      font-size: 0.8125rem;
    }
  `,
})
export class SolBadgeComponent {
  /** Visual variant controlling the badge color. */
  variant = input<BadgeVariant>('neutral');

  /** Size preset for the badge. */
  size = input<BadgeSize>('sm');

  /** Map from variant to its corresponding CSS variable. */
  private readonly variantColorMap: Record<BadgeVariant, string> = {
    success: 'var(--sol-color-success, #10b981)',
    warning: 'var(--sol-color-warning, #f59e0b)',
    danger: 'var(--sol-color-danger, #ef4444)',
    info: 'var(--sol-color-info, #3b82f6)',
    neutral: 'var(--sol-color-neutral, #6b7280)',
  };

  /** Computed CSS classes combining base, size, and variant. */
  hostClasses = computed(() => `sol-badge sol-badge-${this.size()}`);

  /** Computed inline styles for variant-based coloring using color-mix. */
  hostStyles = computed(() => {
    const color = this.variantColorMap[this.variant()];
    return `background: color-mix(in srgb, ${color} 15%, transparent); color: ${color};`;
  });
}

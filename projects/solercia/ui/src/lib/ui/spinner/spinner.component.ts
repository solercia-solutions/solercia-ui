import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';

type SpinnerSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'sol-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    '[attr.aria-label]': 'ariaLabel()',
  },
  template: `
    <svg
      [class]="hostClasses()"
      [style]="hostStyles()"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        class="sol-spinner-track"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="3"
      />
      <path
        class="sol-spinner-arc"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .sol-spinner {
      animation: sol-spin 0.75s linear infinite;
    }

    .sol-spinner-sm { width: 1rem;   height: 1rem; }
    .sol-spinner-md { width: 1.5rem; height: 1.5rem; }
    .sol-spinner-lg { width: 2.5rem; height: 2.5rem; }

    .sol-spinner-track {
      opacity: 0.2;
    }

    .sol-spinner-arc {
      opacity: 1;
    }

    @keyframes sol-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `,
})
export class SolSpinnerComponent {
  private readonly i18n = injectSolI18n();

  /** Size preset for the spinner. */
  size = input<SpinnerSize>('md');

  /** Custom color override. Defaults to var(--sol-color-primary). */
  color = input<string>('');

  /** Computed CSS classes combining base and size. */
  hostClasses = computed(() => `sol-spinner sol-spinner-${this.size()}`);

  /** Computed inline style for color override. */
  hostStyles = computed(() => {
    const c = this.color();
    return `color: ${c || 'var(--sol-color-primary, #3b82f6)'}`;
  });

  /** Etiqueta accesible traducida (`shared.spinner.loading`), reactiva al idioma activo. */
  readonly ariaLabel = this.i18n.t('shared.spinner.loading');
}

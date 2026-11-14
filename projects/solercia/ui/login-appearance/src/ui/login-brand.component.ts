import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { sanitizeAssetUrl } from '@solercia/ui';

/** Logo accepted by the brand block: the theme `meta.logo` or a published `LoginLogo`. */
export interface LoginBrandLogo {
  url: string;
  urlDark?: string | null;
  altText?: string;
}

/**
 * Brand above the form title: the theme logo (its dark variant in dark mode) and an optional
 * tagline. Without a usable logo it writes the alternative text as a wordmark, so the block never
 * renders a broken image.
 */
@Component({
  standalone: true,
  selector: 'sol-login-brand',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src(); as url) {
      <img data-testid="login-brand-logo" [src]="url" [alt]="alt()" />
    } @else if (alt()) {
      <span class="wordmark" data-testid="login-brand-wordmark">{{ alt() }}</span>
    }
    @if (tagline()) {
      <p class="tagline" data-testid="login-brand-tagline">{{ tagline() }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sol-space-xs, 4px);
      margin-bottom: var(--sol-space-md, 16px);
      text-align: center;
    }

    img {
      display: block;
      height: 64px;
      max-width: 100%;
      width: auto;
      object-fit: contain;
    }

    .wordmark {
      font-family: var(--sol-font-display, var(--sol-font-family));
      font-size: var(--sol-font-size-lg, 16px);
      font-weight: var(--sol-font-weight-bold, 600);
      letter-spacing: 0.04em;
      color: var(--sol-color-text-primary);
    }

    .tagline {
      margin: 0;
      font-size: var(--sol-font-size-sm, 12px);
      color: var(--sol-color-text-secondary);
    }
  `,
})
export class SolLoginBrandComponent {
  readonly logo = input<LoginBrandLogo | null>(null);
  readonly dark = input(false);
  readonly tagline = input<string | null>(null);

  protected readonly src = computed(() => {
    const logo = this.logo();
    if (!logo) return null;
    return (this.dark() ? sanitizeAssetUrl(logo.urlDark) : null) ?? sanitizeAssetUrl(logo.url);
  });
  protected readonly alt = computed(() => this.logo()?.altText?.trim() ?? '');
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SolBadgeComponent, SolCardComponent, SolRevealDirective } from '@solercia/ui';
import { SHOWCASE_GROUPS } from '../navigation';
import { DemoComponent } from '../shared/demo.component';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SolCardComponent, SolBadgeComponent, SolRevealDirective, DemoComponent],
  template: `
    <section class="hero">
      <img src="solercia-mark.svg" alt="Solercia" width="42" height="80" />
      <div>
        <h1 class="hero__title">Solercia UI</h1>
        <p class="hero__lead">
          The shared Angular design system of the Solercia platform: standalone components, signals,
          zoneless change detection and themes driven only by <code>--sol-*</code> tokens.
        </p>
        <p class="hero__meta">
          <sol-badge variant="info">Angular 22</sol-badge>
          <sol-badge variant="success">57 components & directives</sol-badge>
          <sol-badge>Light & dark</sol-badge>
        </p>
      </div>
    </section>

    <div class="groups">
      @for (group of groups; track group.label; let i = $index) {
        <sol-card solReveal [solRevealIndex]="i">
          <h2 class="group__title">{{ group.label }}</h2>
          <ul class="group__list">
            @for (page of group.pages; track page.path) {
              <li><a [routerLink]="'/' + page.path">{{ page.label }}</a></li>
            }
          </ul>
        </sol-card>
      }
    </div>

    <app-demo
      title="Reference integration"
      description="This application is wired the way a real consumer wires the library."
      [code]="setup"
    >
      <p class="setup-note">
        Open the code block to see the <code>app.config.ts</code> used by this showcase: theme bootstrap,
        a THEME_SOURCE adapter, and a SOL_I18N engine with English and Colombian Spanish catalogs.
      </p>
    </app-demo>
  `,
  styles: `
    .hero {
      display: flex;
      gap: var(--sol-space-lg);
      align-items: center;
      margin-bottom: var(--sol-space-xl);
    }
    .hero__title {
      margin: 0;
      font-family: var(--sol-font-display);
      font-size: var(--sol-font-size-xl);
      font-weight: var(--sol-display-weight);
    }
    .hero__lead {
      margin: var(--sol-space-xs) 0;
      color: var(--sol-color-text-secondary);
      max-width: 60ch;
    }
    .hero__meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sol-space-xs);
      margin: 0;
    }
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--sol-space-md);
      margin-bottom: var(--sol-space-xl);
    }
    .group__title {
      margin: 0 0 var(--sol-space-sm);
      font-size: var(--sol-font-size-lg);
    }
    .group__list {
      margin: 0;
      padding-left: var(--sol-space-md);
    }
    .group__list a {
      color: var(--sol-color-primary);
    }
    .setup-note {
      margin: 0;
      color: var(--sol-color-text-secondary);
    }
  `,
})
export class HomePage {
  protected readonly groups = SHOWCASE_GROUPS;
  protected readonly setup = `import { provideZonelessChangeDetection } from '@angular/core';
import { SOL_I18N, THEME_SOURCE, provideTheme } from '@solercia/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideTheme(),                                       // boots ThemeService → --sol-* on :root
    { provide: THEME_SOURCE, useExisting: ShowcaseThemeSource }, // tenant ThemeFile loader
    { provide: SOL_I18N, useExisting: ShowcaseI18nService },     // host i18n engine
  ],
};

// Light/dark toggle
theme = inject(ThemeService);
theme.toggleMode();           // or theme.setDarkMode(true)
theme.isDark();               // Signal<boolean>`;
}

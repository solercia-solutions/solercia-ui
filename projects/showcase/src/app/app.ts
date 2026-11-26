import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import {
  SolIconButtonComponent,
  SolViewToggleComponent,
  ThemeService,
  type SolViewToggleOption,
} from '@solercia/ui';
import { SHOWCASE_GROUPS } from './navigation';
import { DocsTocService } from './docs/docs-toc.service';
import { ShowcaseI18nService, type ShowcaseLang } from './i18n/showcase-i18n.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SolIconButtonComponent, SolViewToggleComponent],
  template: `
    <header class="topbar">
      <sol-icon-button
        class="topbar__menu"
        icon="menu"
        variant="ghost"
        [ariaLabel]="menuOpen() ? 'Close navigation' : 'Open navigation'"
        (clicked)="menuOpen.set(!menuOpen())"
      />
      <a class="brand" routerLink="/">
        <img class="brand__mark" src="solercia-mark.svg" alt="" width="21" height="40" />
        <span class="brand__text">Solercia <strong>UI</strong></span>
      </a>
      <span class="topbar__spacer"></span>
      <sol-view-toggle
        class="topbar__lang"
        [options]="langOptions"
        [value]="i18n.activeLang()"
        (valueChange)="setLang($event)"
      />
      <sol-icon-button
        [icon]="theme.isDark() ? 'sun' : 'moon'"
        variant="ghost"
        [ariaLabel]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
        (clicked)="theme.toggleMode()"
      />
    </header>

    <div class="layout">
      <nav class="sidebar" [class.sidebar--open]="menuOpen()" aria-label="Guides and components">
        <a class="sidebar__link" routerLink="/" routerLinkActive="sidebar__link--active" [routerLinkActiveOptions]="{ exact: true }">
          Overview
        </a>
        <p class="sidebar__group">Guides</p>
        @for (chapter of docs.chapters(); track chapter.slug) {
          <a class="sidebar__link" [routerLink]="['/docs', chapter.slug]" routerLinkActive="sidebar__link--active">
            {{ chapter.title }}
          </a>
        } @empty {
          @if (docs.status() === 'error') {
            <p class="sidebar__footer">The guides could not be loaded.</p>
          }
        }
        @for (group of groups; track group.label) {
          <p class="sidebar__group">{{ group.label }}</p>
          @for (page of group.pages; track page.path) {
            <a class="sidebar__link" [routerLink]="'/' + page.path" routerLinkActive="sidebar__link--active">
              {{ page.label }}
            </a>
          }
        }
        <p class="sidebar__footer">{{ pageCount() }} pages · &#64;solercia/ui</p>
      </nav>
      @if (menuOpen()) {
        <button type="button" class="scrim" aria-label="Close navigation" (click)="menuOpen.set(false)"></button>
      }
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: var(--sol-space-sm);
      height: var(--sol-size-header-height);
      padding: 0 var(--sol-space-md);
      background: var(--sol-header-bg);
      backdrop-filter: var(--sol-header-blur);
      border-bottom: var(--sol-border-width-default) solid var(--sol-border-color-default);
    }
    .topbar__menu {
      display: none;
    }
    .topbar__spacer {
      flex: 1;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: var(--sol-space-sm);
      color: var(--sol-color-text-primary);
      text-decoration: none;
      font-size: var(--sol-font-size-lg);
    }
    .brand__mark {
      height: 28px;
      width: auto;
    }
    .layout {
      display: flex;
    }
    .sidebar {
      position: sticky;
      top: var(--sol-size-header-height);
      flex: 0 0 260px;
      height: calc(100vh - var(--sol-size-header-height));
      overflow-y: auto;
      padding: var(--sol-space-md);
      background: var(--sol-sidebar-bg);
      border-right: var(--sol-border-width-default) solid var(--sol-border-color-default);
    }
    .sidebar__group {
      margin: var(--sol-space-md) 0 var(--sol-space-xs);
      padding: 0 var(--sol-space-sm);
      font-size: var(--sol-font-size-sm);
      font-weight: var(--sol-font-weight-bold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--sol-color-text-muted);
    }
    .sidebar__link {
      display: block;
      padding: var(--sol-space-xs) var(--sol-space-sm);
      border-radius: var(--sol-sidebar-item-radius);
      color: var(--sol-sidebar-text);
      text-decoration: none;
      font-size: var(--sol-font-size-sm);
    }
    .sidebar__link:hover {
      background: var(--sol-bg-sunken);
    }
    .sidebar__link--active {
      background: var(--sol-sidebar-active-bg);
      color: var(--sol-sidebar-active-text);
      font-weight: var(--sol-font-weight-bold);
    }
    .sidebar__footer {
      margin: var(--sol-space-lg) 0 0;
      padding: 0 var(--sol-space-sm);
      font-size: var(--sol-font-size-sm);
      color: var(--sol-color-text-muted);
    }
    .content {
      flex: 1;
      min-width: 0;
      padding: var(--sol-space-xl) var(--sol-space-lg);
      max-width: 1200px;
    }
    .scrim {
      display: none;
    }
    @media (max-width: 900px) {
      .topbar__menu {
        display: inline-flex;
      }
      .brand__text {
        display: none;
      }
      .sidebar {
        position: fixed;
        z-index: 30;
        left: 0;
        width: min(280px, 85vw);
        transform: translateX(-100%);
        transition: transform var(--sol-dur-base) var(--sol-ease);
      }
      .sidebar--open {
        transform: translateX(0);
        box-shadow: var(--sol-shadow-lg);
      }
      .scrim {
        display: block;
        position: fixed;
        inset: var(--sol-size-header-height) 0 0 0;
        z-index: 25;
        border: 0;
        background: var(--sol-bg-overlay);
      }
      .content {
        padding: var(--sol-space-lg) var(--sol-space-md);
      }
    }
  `,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(ShowcaseI18nService);
  protected readonly docs = inject(DocsTocService);
  protected readonly groups = SHOWCASE_GROUPS;
  protected readonly menuOpen = signal(false);
  protected readonly pageCount = computed(() => this.groups.reduce((total, group) => total + group.pages.length, 0));
  protected readonly langOptions: SolViewToggleOption[] = [
    { value: 'en', label: 'EN' },
    { value: 'es-CO', label: 'ES' },
  ];

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected setLang(lang: string): void {
    this.i18n.setLang(lang === 'es-CO' ? 'es-CO' : ('en' satisfies ShowcaseLang));
  }
}

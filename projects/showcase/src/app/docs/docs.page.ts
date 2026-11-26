import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  inject,
  input,
  resource,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  SolBadgeComponent,
  SolButtonComponent,
  SolEmptyStateComponent,
  SolSkeletonComponent,
  ThemeService,
} from '@solercia/ui';
import { DocsTocService } from './docs-toc.service';
import { renderMermaidDiagrams, type MermaidDiagram } from './mermaid-renderer';

type DocsView = 'loading' | 'error' | 'not-found' | 'ready';

/**
 * One chapter of the manual. The HTML fragment is generated at build time from docs/manual/*.md
 * (scripts/build-docs.mjs) and bound through Angular's sanitizer with [innerHTML]; heading ids,
 * which the sanitizer strips, are restored from toc.json, and Mermaid diagrams are drawn lazily.
 */
@Component({
  selector: 'app-docs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, SolBadgeComponent, SolButtonComponent, SolEmptyStateComponent, SolSkeletonComponent],
  template: `
    <div class="docs">
      <article class="docs__article">
        @if (chapter(); as current) {
          <p class="docs__eyebrow">
            <span>Chapter {{ current.number }}</span>
            <sol-badge>&#64;solercia/ui {{ docs.toc()?.version }}</sol-badge>
          </p>
        }
        @switch (view()) {
          @case ('loading') {
            <div class="docs__state" aria-busy="true">
              <sol-skeleton variant="title" />
              <sol-skeleton variant="text" count="8" />
            </div>
          }
          @case ('not-found') {
            <sol-empty-state
              icon="document-magnifying-glass"
              titleKey="showcase.docs.notFoundTitle"
              descriptionKey="showcase.docs.notFoundDescription"
            >
              <sol-button (clicked)="goTo('/docs/introduction')">Go to the introduction</sol-button>
            </sol-empty-state>
          }
          @case ('error') {
            <sol-empty-state
              icon="exclamation-triangle"
              titleKey="showcase.docs.errorTitle"
              descriptionKey="showcase.docs.errorDescription"
            >
              <sol-button variant="secondary" (clicked)="retry()">Try again</sol-button>
            </sol-empty-state>
          }
          @default {
            <div #body class="docs__body" [innerHTML]="content.value()" (click)="onBodyClick($event)"></div>
          }
        }
        @if (chapter() && view() === 'ready') {
          <nav class="docs__pager" aria-label="Previous and next chapter">
            @if (previous(); as prev) {
              <a class="docs__pager-link" [routerLink]="['/docs', prev.slug]">
                <span class="docs__pager-label">Previous</span>
                <span class="docs__pager-title">{{ prev.title }}</span>
              </a>
            } @else {
              <span></span>
            }
            @if (next(); as nxt) {
              <a class="docs__pager-link docs__pager-link--next" [routerLink]="['/docs', nxt.slug]">
                <span class="docs__pager-label">Next</span>
                <span class="docs__pager-title">{{ nxt.title }}</span>
              </a>
            }
          </nav>
        }
      </article>
      @if (view() === 'ready' && onThisPage().length) {
        <aside class="docs__toc" aria-labelledby="docs-toc-title">
          <p id="docs-toc-title" class="docs__toc-title">On this page</p>
          <ul class="docs__toc-list">
            @for (heading of onThisPage(); track heading.id) {
              <li [class.docs__toc-item--sub]="heading.depth === 3">
                <a [routerLink]="[]" [fragment]="heading.id">{{ heading.text }}</a>
              </li>
            }
          </ul>
        </aside>
      }
    </div>
  `,
  styles: `
    .docs {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sol-space-xl);
    }
    @media (min-width: 1200px) {
      .docs {
        grid-template-columns: minmax(0, 1fr) 220px;
      }
    }
    .docs__article {
      min-width: 0;
      max-width: 820px;
    }
    .docs__eyebrow {
      display: flex;
      align-items: center;
      gap: var(--sol-space-sm);
      margin: 0 0 var(--sol-space-xs);
      font-size: var(--sol-font-size-sm);
      font-weight: var(--sol-font-weight-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--sol-color-primary);
    }
    .docs__state {
      display: grid;
      gap: var(--sol-space-md);
    }
    .docs__body {
      color: var(--sol-color-text-primary);
      line-height: 1.65;
    }
    .docs__body h1 {
      margin: 0 0 var(--sol-space-lg);
      font-family: var(--sol-font-display);
      font-weight: var(--sol-display-weight);
      letter-spacing: var(--sol-display-tracking);
      font-size: calc(var(--sol-font-size-xl) * 1.5);
      line-height: 1.2;
    }
    .docs__body h2,
    .docs__body h3 {
      scroll-margin-top: calc(var(--sol-size-header-height) + var(--sol-space-md));
      font-family: var(--sol-font-display);
      line-height: 1.3;
    }
    .docs__body h2 {
      margin: var(--sol-space-xl) 0 var(--sol-space-sm);
      padding-top: var(--sol-space-md);
      border-top: var(--sol-border-width-default) solid var(--sol-border-color-default);
      font-size: var(--sol-font-size-xl);
    }
    .docs__body h3 {
      margin: var(--sol-space-lg) 0 var(--sol-space-xs);
      font-size: var(--sol-font-size-lg);
    }
    .docs-anchor {
      margin-left: var(--sol-space-xs);
      color: var(--sol-color-text-muted);
      text-decoration: none;
      opacity: 0;
      transition: opacity var(--sol-dur-fast) var(--sol-ease);
    }
    .docs__body h2:hover .docs-anchor,
    .docs__body h3:hover .docs-anchor,
    .docs-anchor:focus-visible {
      opacity: 1;
    }
    .docs__body a {
      color: var(--sol-color-primary);
    }
    .docs__body code {
      padding: 1px 5px;
      border-radius: var(--sol-border-radius-sm);
      background: var(--sol-bg-sunken);
      font-family: var(--sol-font-family-mono);
      font-size: 0.9em;
      overflow-wrap: anywhere;
    }
    .docs__body pre {
      overflow-x: auto;
      padding: var(--sol-space-md);
      border: var(--sol-border-width-default) solid var(--sol-border-color-default);
      border-radius: var(--sol-border-radius-md);
      background: var(--sol-bg-sunken);
      line-height: 1.5;
    }
    .docs__body pre code {
      padding: 0;
      background: none;
      font-size: var(--sol-font-size-sm);
      overflow-wrap: normal;
    }
    .docs__body table {
      display: block;
      overflow-x: auto;
      width: 100%;
      border-collapse: collapse;
      font-size: var(--sol-font-size-sm);
    }
    .docs__body th,
    .docs__body td {
      padding: var(--sol-space-xs) var(--sol-space-sm);
      border-bottom: var(--sol-border-width-default) solid var(--sol-border-color-default);
      text-align: left;
      vertical-align: top;
    }
    .docs__body th {
      color: var(--sol-color-text-secondary);
      white-space: nowrap;
    }
    .docs__body td code {
      overflow-wrap: normal;
      white-space: nowrap;
    }
    .docs__body blockquote {
      margin: var(--sol-space-md) 0;
      padding: var(--sol-space-sm) var(--sol-space-md);
      border-left: 3px solid var(--sol-color-primary);
      background: var(--sol-bg-sunken);
      border-radius: var(--sol-border-radius-sm);
    }
    .docs__body img {
      max-width: 100%;
      height: auto;
    }
    .docs__body li:has(> .docs-task) {
      list-style: none;
    }
    .docs-task {
      display: inline-block;
      width: 14px;
      height: 14px;
      margin: 0 var(--sol-space-xs) 0 -20px;
      vertical-align: -2px;
      border: var(--sol-border-width-default) solid var(--sol-color-text-muted);
      border-radius: var(--sol-border-radius-sm);
    }
    .docs-diagram {
      overflow-x: auto;
      margin: var(--sol-space-md) 0;
      padding: var(--sol-space-md);
      border: var(--sol-border-width-default) solid var(--sol-border-color-default);
      border-radius: var(--sol-border-radius-md);
      background: var(--sol-bg-surface);
      text-align: center;
    }
    .docs-diagram svg {
      max-width: 100%;
      height: auto;
    }
    .docs__pager {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sol-space-md);
      margin-top: var(--sol-space-xl);
    }
    .docs__pager-link {
      display: grid;
      gap: 2px;
      padding: var(--sol-space-md);
      border: var(--sol-border-width-default) solid var(--sol-border-color-default);
      border-radius: var(--sol-border-radius-md);
      background: var(--sol-bg-surface);
      color: var(--sol-color-text-primary);
      text-decoration: none;
    }
    .docs__pager-link:hover,
    .docs__pager-link:focus-visible {
      border-color: var(--sol-color-primary);
    }
    .docs__pager-link--next {
      grid-column: 2;
      text-align: right;
    }
    .docs__pager-label {
      font-size: var(--sol-font-size-sm);
      color: var(--sol-color-text-muted);
    }
    .docs__pager-title {
      font-weight: var(--sol-font-weight-bold);
      color: var(--sol-color-primary);
    }
    .docs__toc {
      display: none;
    }
    @media (min-width: 1200px) {
      .docs__toc {
        display: block;
        position: sticky;
        top: calc(var(--sol-size-header-height) + var(--sol-space-lg));
        align-self: start;
        max-height: calc(100vh - var(--sol-size-header-height) - var(--sol-space-xl));
        overflow-y: auto;
        font-size: var(--sol-font-size-sm);
      }
    }
    .docs__toc-title {
      margin: 0 0 var(--sol-space-sm);
      font-weight: var(--sol-font-weight-bold);
      color: var(--sol-color-text-secondary);
    }
    .docs__toc-list {
      margin: 0;
      padding: 0;
      list-style: none;
      border-left: var(--sol-border-width-default) solid var(--sol-border-color-default);
    }
    .docs__toc-list a {
      display: block;
      padding: 3px var(--sol-space-sm);
      color: var(--sol-color-text-secondary);
      text-decoration: none;
    }
    .docs__toc-list a:hover {
      color: var(--sol-color-primary);
    }
    .docs__toc-item--sub a {
      padding-left: var(--sol-space-lg);
    }
  `,
})
export class DocsPage {
  /** Route parameter `:slug` (bound with withComponentInputBinding). */
  readonly slug = input.required<string>();

  protected readonly docs = inject(DocsTocService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  protected readonly chapter = computed(() => this.docs.chapters().find((item) => item.slug === this.slug()) ?? null);
  private readonly index = computed(() => this.docs.chapters().findIndex((item) => item.slug === this.slug()));
  protected readonly previous = computed(() => this.docs.chapters()[this.index() - 1] ?? null);
  protected readonly next = computed(() => (this.index() >= 0 ? (this.docs.chapters()[this.index() + 1] ?? null) : null));
  protected readonly onThisPage = computed(() => this.chapter()?.headings.filter((heading) => heading.depth === 2) ?? []);

  protected readonly content = resource({
    params: () => this.chapter()?.slug,
    loader: async ({ params, abortSignal }) => {
      const response = await fetch(`docs-content/${params}.html`, { signal: abortSignal });
      if (!response.ok) throw new Error(`Guide ${params}: HTTP ${response.status}`);
      return response.text();
    },
  });

  protected readonly view = computed<DocsView>(() => {
    const status = this.docs.status();
    if (status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    if (!this.chapter()) return 'not-found';
    if (this.content.error()) return 'error';
    return this.content.hasValue() && !this.content.isLoading() ? 'ready' : 'loading';
  });

  private enhancedHtml: string | undefined;
  private enhancedElement: HTMLElement | undefined;
  private diagrams: MermaidDiagram[] = [];

  constructor() {
    afterRenderEffect(() => {
      const element = this.body()?.nativeElement;
      const html = this.content.hasValue() ? this.content.value() : undefined;
      const dark = this.theme.isDark();
      this.theme.activeTheme();
      if (!element || html === undefined) return;
      if (html !== this.enhancedHtml || element !== this.enhancedElement) {
        this.enhancedHtml = html;
        this.enhancedElement = element;
        this.enhance(element);
      }
      void renderMermaidDiagrams(this.diagrams, dark);
    });
  }

  protected goTo(url: string): void {
    void this.router.navigateByUrl(url);
  }

  protected retry(): void {
    if (this.docs.status() === 'error') {
      void this.docs.load();
    } else {
      this.content.reload();
    }
  }

  /** Internal links inside the generated HTML navigate with the router instead of reloading the page. */
  protected onBodyClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest('a');
    const href = anchor?.getAttribute('href');
    if (!anchor || !href || /^[a-z][a-z0-9+.-]*:/i.test(href) || anchor.hasAttribute('target')) return;
    event.preventDefault();
    void this.router.navigateByUrl(`/${href}`);
  }

  private enhance(element: HTMLElement): void {
    const headings = (this.chapter()?.headings ?? []).filter((heading) => heading.depth === 2 || heading.depth === 3);
    element.querySelectorAll('h2, h3').forEach((node, position) => {
      const heading = headings[position];
      if (heading) node.id = heading.id;
    });
    this.diagrams = Array.from(element.querySelectorAll('pre.mermaid-source')).map((pre) => {
      const host = document.createElement('div');
      host.className = 'docs-diagram';
      host.setAttribute('role', 'img');
      host.setAttribute('aria-label', 'Diagram');
      const source = pre.textContent ?? '';
      pre.replaceWith(host);
      host.append(pre);
      return { host, source, renderedDark: null };
    });
    const fragment = this.fragment();
    if (fragment) {
      element.ownerDocument.getElementById(fragment)?.scrollIntoView();
    }
  }
}

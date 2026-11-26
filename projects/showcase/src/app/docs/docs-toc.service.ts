import { Injectable, computed, signal } from '@angular/core';

export interface DocsHeading {
  readonly depth: number;
  readonly text: string;
  readonly id: string;
}

export interface DocsChapter {
  readonly slug: string;
  readonly number: string;
  readonly title: string;
  readonly description: string;
  readonly headings: readonly DocsHeading[];
}

export interface DocsToc {
  readonly version: string;
  readonly chapters: readonly DocsChapter[];
}

export type DocsTocStatus = 'loading' | 'ready' | 'error';

/**
 * Table of contents of the Guides section. `docs-content/toc.json` is generated at build time from
 * docs/manual/*.md by scripts/build-docs.mjs; the URL is relative to the document base href.
 */
@Injectable({ providedIn: 'root' })
export class DocsTocService {
  private readonly tocState = signal<DocsToc | null>(null);
  private readonly statusState = signal<DocsTocStatus>('loading');
  private pending: Promise<DocsToc | null> | null = null;

  readonly toc = this.tocState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly chapters = computed(() => this.tocState()?.chapters ?? []);

  constructor() {
    void this.load();
  }

  load(): Promise<DocsToc | null> {
    this.pending ??= fetch('docs-content/toc.json')
      .then((response) => (response.ok ? (response.json() as Promise<DocsToc>) : Promise.reject(new Error(String(response.status)))))
      .then((toc) => {
        this.tocState.set(toc);
        this.statusState.set('ready');
        return toc;
      })
      .catch(() => {
        this.statusState.set('error');
        this.pending = null;
        return null;
      });
    return this.pending;
  }

  /** Document title for a chapter route. */
  async titleFor(slug: string | null): Promise<string> {
    const toc = await this.load();
    const chapter = toc?.chapters.find((item) => item.slug === slug);
    return chapter ? `${chapter.title} · Guides · Solercia UI` : 'Guides · Solercia UI';
  }
}

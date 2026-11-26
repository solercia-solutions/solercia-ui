import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { DocsTocService } from './docs/docs-toc.service';
import { SHOWCASE_GROUPS } from './navigation';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home.page').then((m) => m.HomePage), title: 'Solercia UI' },
  { path: 'docs', pathMatch: 'full', redirectTo: 'docs/introduction' },
  {
    path: 'docs/:slug',
    loadComponent: () => import('./docs/docs.page').then((m) => m.DocsPage),
    title: (route) => inject(DocsTocService).titleFor(route.paramMap.get('slug')),
  },
  ...SHOWCASE_GROUPS.flatMap((group) =>
    group.pages.map((page) => ({ path: page.path, loadComponent: page.load, title: `${page.label} · Solercia UI` })),
  ),
  { path: '**', redirectTo: '' },
];

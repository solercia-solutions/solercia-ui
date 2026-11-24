import type { Routes } from '@angular/router';
import { SHOWCASE_GROUPS } from './navigation';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home.page').then((m) => m.HomePage), title: 'Solercia UI' },
  ...SHOWCASE_GROUPS.flatMap((group) =>
    group.pages.map((page) => ({ path: page.path, loadComponent: page.load, title: `${page.label} · Solercia UI` })),
  ),
  { path: '**', redirectTo: '' },
];

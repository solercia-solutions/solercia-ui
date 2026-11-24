import type { Type } from '@angular/core';

export interface ShowcasePage {
  readonly path: string;
  readonly label: string;
  readonly load: () => Promise<Type<unknown>>;
}

export interface ShowcaseGroup {
  readonly label: string;
  readonly pages: readonly ShowcasePage[];
}

/** Single source of truth for the sidebar and the router. */
export const SHOWCASE_GROUPS: readonly ShowcaseGroup[] = [
  {
    label: 'Actions',
    pages: [
      { path: 'buttons', label: 'Button & icon button', load: () => import('./pages/buttons.page').then((m) => m.ButtonsPage) },
      { path: 'icons', label: 'Icon', load: () => import('./pages/icons.page').then((m) => m.IconsPage) },
    ],
  },
  {
    label: 'Forms',
    pages: [
      { path: 'inputs', label: 'Text inputs', load: () => import('./pages/inputs.page').then((m) => m.InputsPage) },
      { path: 'selection', label: 'Select, checkbox & toggle', load: () => import('./pages/selection.page').then((m) => m.SelectionPage) },
      { path: 'chips', label: 'Chips & view toggle', load: () => import('./pages/chips.page').then((m) => m.ChipsPage) },
      { path: 'dates', label: 'Date & day picker', load: () => import('./pages/dates.page').then((m) => m.DatesPage) },
      { path: 'rating', label: 'Rating', load: () => import('./pages/rating.page').then((m) => m.RatingPage) },
      { path: 'file-upload', label: 'File upload', load: () => import('./pages/file-upload.page').then((m) => m.FileUploadPage) },
      { path: 'rich-editor', label: 'Rich editor', load: () => import('./pages/rich-editor.page').then((m) => m.RichEditorPage) },
    ],
  },
  {
    label: 'Feedback',
    pages: [
      { path: 'status', label: 'Badges & indicators', load: () => import('./pages/status.page').then((m) => m.StatusPage) },
      { path: 'loading', label: 'Spinner, skeleton & progress', load: () => import('./pages/loading.page').then((m) => m.LoadingPage) },
      { path: 'empty-state', label: 'Empty state', load: () => import('./pages/empty-state.page').then((m) => m.EmptyStatePage) },
      { path: 'tooltip', label: 'Tooltip', load: () => import('./pages/tooltip.page').then((m) => m.TooltipPage) },
      { path: 'notifications', label: 'Notification panel', load: () => import('./pages/notifications.page').then((m) => m.NotificationsPage) },
    ],
  },
  {
    label: 'Overlays',
    pages: [
      { path: 'overlays', label: 'Modal, drawer & confirm', load: () => import('./pages/overlays.page').then((m) => m.OverlaysPage) },
    ],
  },
  {
    label: 'Navigation',
    pages: [
      { path: 'navigation', label: 'Tabs, pagination & header', load: () => import('./pages/navigation.page').then((m) => m.NavigationPage) },
      { path: 'stepper', label: 'Stepper & wizard', load: () => import('./pages/stepper.page').then((m) => m.StepperPage) },
      { path: 'scope-switcher', label: 'Scope switcher', load: () => import('./pages/scope-switcher.page').then((m) => m.ScopeSwitcherPage) },
      { path: 'tree', label: 'Tree', load: () => import('./pages/tree.page').then((m) => m.TreePage) },
    ],
  },
  {
    label: 'Layout & motion',
    pages: [
      { path: 'card', label: 'Card & reveal', load: () => import('./pages/card.page').then((m) => m.CardPage) },
    ],
  },
  {
    label: 'Data',
    pages: [
      { path: 'data-table', label: 'Data table', load: () => import('./pages/data-table.page').then((m) => m.DataTablePage) },
      { path: 'virtual-scroll', label: 'Virtual scroll', load: () => import('./pages/virtual-scroll.page').then((m) => m.VirtualScrollPage) },
      { path: 'chart', label: 'Chart', load: () => import('./pages/chart.page').then((m) => m.ChartPage) },
      { path: 'timeline', label: 'Timeline', load: () => import('./pages/timeline.page').then((m) => m.TimelinePage) },
    ],
  },
  {
    label: 'Planning',
    pages: [
      { path: 'kanban', label: 'Kanban', load: () => import('./pages/kanban.page').then((m) => m.KanbanPage) },
      { path: 'calendar', label: 'Calendar', load: () => import('./pages/calendar.page').then((m) => m.CalendarPage) },
      { path: 'flow-canvas', label: 'Flow canvas', load: () => import('./pages/flow-canvas.page').then((m) => m.FlowCanvasPage) },
    ],
  },
];

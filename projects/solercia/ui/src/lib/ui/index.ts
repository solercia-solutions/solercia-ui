// Shared UI — atomic design system components
export { SolButtonComponent } from './button/button.component';
export type { SolButtonVariant, SolButtonSize } from './button/button.component';
export { SolInputComponent } from './input/input.component';
export { SolSelectComponent } from './select/select.component';
export type { SolSelectOption } from './select/select.component';
export { SolTextareaComponent } from './textarea/textarea.component';
export { SolToggleComponent } from './toggle/toggle.component';
export { SolModalComponent } from './modal/modal.component';
export { SolDrawerComponent } from './drawer/drawer.component';
export type { SolDrawerSide, SolDrawerSize } from './drawer/drawer.component';
export { SolBadgeComponent } from './badge/badge.component';
export { SolCardComponent } from './card/card.component';
export { SolSpinnerComponent } from './spinner/spinner.component';
export { SolTabsComponent } from './tabs/tabs.component';
export type { SolTabItem } from './tabs/tabs.component';
export { SolFormFieldComponent } from './form-field/form-field.component';
export { SolPaginationComponent } from './pagination/pagination.component';
export { SolSearchInputComponent } from './search-input/search-input.component';
export { SolIconComponent } from './icon/icon.component';
export type { SolIconSize, SolIconVariant, SolIconName } from './icon/icon.component';
export { SolTooltipComponent } from './tooltip/tooltip.component';
export { SolCheckboxComponent } from './checkbox/checkbox.component';
export type { SolCheckboxSize, SolCheckboxColor, SolCheckboxShape } from './checkbox/checkbox.component';
export { SolSkeletonComponent, type SolSkeletonVariant } from './skeleton/skeleton.component';
export { SolFileUploadComponent } from './file-upload/file-upload.component';
export { SolDayPickerComponent } from './day-picker/day-picker.component';
export type { DayPickerItem } from './day-picker/day-picker.component';
export { SolDatePickerComponent } from './day-picker/date-picker.component';
export type { SolDatePickerSize } from './day-picker/date-picker.component';
export { SolViewToggleComponent } from './view-toggle/view-toggle.component';
export type { SolViewToggleOption } from './view-toggle/view-toggle.component';
export { SolEmptyStateComponent } from './empty-state/empty-state.component';
export { SolStepperComponent } from './stepper/stepper.component';
export type {
  SolStepperStep,
  SolStepperOrientation,
  SolStepperStepState,
  SolStepperNavigation,
} from './stepper/stepper.component';
export { SolProgressBarComponent } from './progress-bar/progress-bar.component';
export type { SolProgressMode, SolProgressSize, SolProgressVariant } from './progress-bar/progress-bar.component';
export { SolWizardComponent, SolWizardStepDirective } from './wizard/wizard.component';
export type { SolWizardStep, SolWizardCanAdvance } from './wizard/wizard.component';
export { SolVirtualScrollComponent } from './virtual-scroll/virtual-scroll.component';
export type { SolVirtualScrollItemContext } from './virtual-scroll/virtual-scroll.component';
export { SolChartComponent, SOL_CHART_ENGINE } from './chart/chart.component';
export type { SolChartEngineFactory, SolChartEngineHandle } from './chart/chart.component';
export type { SolChartType, SolChartData, SolChartSeries, SolChartOptions } from './chart/chart-theme';
export { SolRichEditorComponent } from './rich-editor/rich-editor.component';
export type {
  SolRichImageUploader,
  MentionUser,
  LinkableTask,
} from './rich-editor/rich-editor.component';
export { SolPageHeaderComponent } from './page-header/page-header.component';
export { SolIconButtonComponent } from './icon-button/icon-button.component';
export type { SolIconButtonVariant, SolIconButtonSize } from './icon-button/icon-button.component';
export { SolDataTableComponent } from './data-table/data-table.component';
export type { DataTableColumn, SolDataTableRow } from './data-table/data-table.component';
export {
  serializeElementToTcpdfHtml,
  sanitizeHtmlToTcpdf,
  TCPDF_ALLOWED_TAGS,
  TCPDF_ALLOWED_STYLE_PROPERTIES,
} from './rich-editor/rich-editor-serializer';

// Átomos de vocero (11-a-solercia-ui, PR3)
export { SolAvatarComponent, hashToPaletteIndex, computeInitials } from './avatar/avatar.component';
export type { SolAvatarSize } from './avatar/avatar.component';
export {
  SolScoreBadgeComponent,
  resolveScoreTone,
  DEFAULT_SCORE_THRESHOLDS,
} from './score-badge/score-badge.component';
export type { SolTone, SolScoreThreshold } from './score-badge/score-badge.component';
export {
  SolTrendComponent,
  resolveTrendDirection,
  defaultTrendFormat,
} from './trend/trend.component';
export type { SolTrendDirection } from './trend/trend.component';
export { SolMessageStatusComponent } from './message-status/message-status.component';
export type { SolMessageStatus } from './message-status/message-status.component';

// sol-timeline (11-a-solercia-ui, PR4)
export { SolTimelineComponent } from './timeline/timeline.component';
export type {
  TimelineNode,
  TimelineLegendItem,
  SolTimelineStatusResolver,
  SolTimelineRange,
} from './timeline/timeline.model';
export {
  computeGlobalRange,
  positionRows,
  collectUndatedNodes,
  computeMonthAxisTicks,
  defaultStatusToken,
} from './timeline/timeline-position';
export type { PositionedTimelineRow, SolTimelineAxisTick } from './timeline/timeline-position';

// sol-kanban (11-a-solercia-ui, PR5a/PR5b)
export { SolKanbanBoardComponent } from './kanban/kanban-board.component';
export { SolKanbanColumnComponent } from './kanban/kanban-column.component';
export { SolKanbanCardComponent } from './kanban/kanban-card.component';
export type { KanbanCardTemplateContext } from './kanban/kanban-card.component';
export {
  KANBAN_ADD_ACTION,
} from './kanban/kanban.model';
export type {
  KanbanItem,
  KanbanColumn,
  KanbanItemMoved,
  KanbanColumnAction,
} from './kanban/kanban.model';
export { KanbanReorderService } from './kanban/kanban-reorder.service';
// sol-kanban-drag-source (11-g-crm-contactos-y-acciones, PR2 de boki-front, T06):
// origen de arrastre EXTERNO al board — única puerta de CDK para un consumidor
// que necesita declarar SUS PROPIOS items arrastrables hacia las columnas de
// un `sol-kanban-board` ajeno (gate ESLint T40, CDK solo dentro de ui/kanban/).
export { SolKanbanDragSourceComponent } from './kanban/kanban-drag-source.component';
export type { KanbanDragSourceItemContext } from './kanban/kanban-drag-source.component';

// sol-chip / sol-chip-group / sol-number-input (11-f-ciclo3-ux, PR2)
// NOTA: `SolChipSelectionStrategy`/`SINGLE_SELECT_STRATEGY`/`MULTIPLE_SELECT_STRATEGY`
// son internos a `chip/` (no exportados aquí) — no hay input `strategy` que
// los consuma desde afuera; superficie curada (D4), sin scope creep.
export { SolChipComponent } from './chip/chip.component';
export type { SolChipRole, SolChipSize } from './chip/chip.component';
export { SolChipGroupComponent } from './chip/chip-group.component';
export type { SolChipOption } from './chip/chip-group.component';
export { SolNumberInputComponent } from './number-input/number-input.component';

// sol-calendar (11-a-solercia-ui, PR6)
export { SolCalendarComponent } from './calendar/calendar.component';
export { SolCalendarHeaderComponent } from './calendar/calendar-header.component';
export { SolCalendarGridComponent } from './calendar/calendar-grid.component';
export type { SolCalendarEventTemplateContext } from './calendar/calendar-grid.component';
export type {
  SolCalendarEvent,
  SolCalendarView,
  SolCalendarLegendItem,
  StateColorSet,
} from './calendar/calendar.model';
export { SOL_CALENDAR_COLOR, NEUTRAL_CALENDAR_COLOR, isSafeCssColor } from './calendar/calendar-color';
export type { SolCalendarColorStrategy } from './calendar/calendar-color';
export {
  buildDayColumns,
  computeEventHeight,
  computeEventTop,
  computeNowTop,
  dayKey,
  getWeekStart,
  parseEventDate,
} from './calendar/calendar-layout';
export type { CalendarDayColumn } from './calendar/calendar-layout';

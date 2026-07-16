// Shared UI — atomic design system components
export { SolButtonComponent } from './button/button.component';
export type { SolButtonVariant, SolButtonSize } from './button/button.component';
export { SolInputComponent } from './input/input.component';
export { SolSelectComponent } from './select/select.component';
export type { SolSelectOption } from './select/select.component';
export { SolTextareaComponent } from './textarea/textarea.component';
export { SolToggleComponent } from './toggle/toggle.component';
export { SolModalComponent } from './modal/modal.component';
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

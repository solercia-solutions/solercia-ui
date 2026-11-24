import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { SolIconComponent, SolSearchInputComponent, type SolIconName } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

/** Every name in the library icon registry (SolIconName). */
const ICON_NAMES = [
  'home', 'menu', 'list', 'chevron-down', 'chevron-right', 'chevron-left', 'chevron-up', 'plus', 'minus', 'edit',
  'trash', 'sparkles', 'heart', 'check', 'x', 'x-mark', 'search', 'refresh', 'user', 'users', 'building', 'briefcase',
  'calendar', 'calendar-days', 'tag', 'credit-card', 'star', 'settings', 'bell', 'eye', 'message-circle',
  'paper-airplane', 'help-circle', 'layers', 'bar-chart', 'clipboard', 'shopping-cart', 'photo', 'cloud-arrow-up',
  'ellipsis-vertical', 'ellipsis-horizontal', 'clock', 'lock-closed', 'lock-open', 'phone', 'envelope',
  'table-cells', 'pencil', 'funnel', 'view-columns', 'arrows-up-down', 'arrows-pointing-out', 'check-circle',
  'x-circle', 'exclamation-triangle', 'exclamation-circle', 'trophy', 'banknotes', 'currency-dollar', 'beaker',
  'play', 'play-circle', 'cpu-chip', 'chart-pie', 'adjustments-horizontal', 'device-phone-mobile', 'bolt', 'power',
  'signal', 'arrow-path-rounded-square', 'shield-check', 'shield-exclamation', 'key', 'share', 'rectangle-group',
  'squares-2x2', 'arrows-right-left', 'document', 'document-text', 'document-magnifying-glass', 'sun', 'moon',
  'question-mark-circle', 'information-circle', 'arrow-left', 'arrow-right-on-rectangle', 'flag', 'robot', 'gauge',
  'plug', 'git-branch', 'webhook', 'state-machine', 'double-check', 'bold', 'italic', 'underline', 'strikethrough',
  'list-bullet', 'list-numbered', 'align-left', 'align-center', 'align-right', 'image', 'table', 'heading',
  'remove-format', 'link', 'map', 'map-pin', 'arrow-down-tray', 'book-open', 'light-bulb', 'hand-thumb-up',
  'presentation-chart-line', 'printer', 'folder', 'folder-open',
] as const satisfies readonly SolIconName[];

@Component({
  selector: 'app-icons-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolIconComponent, SolSearchInputComponent],
  template: `
    <app-page title="Icon" lead="Inline SVG icons from the library registry, outline or fill." [selectors]="['sol-icon']">
      <app-demo title="Sizes and variants" [code]="basicCode">
        <sol-icon name="star" size="sm" />
        <sol-icon name="star" />
        <sol-icon name="star" size="lg" />
        <sol-icon name="star" size="lg" variant="fill" />
        <sol-icon name="heart" size="lg" variant="fill" />
        <sol-icon name="bell" size="lg" variant="fill" />
      </app-demo>

      <app-demo [title]="'Registry (' + filtered().length + ' of ' + names.length + ')'" description="Every value accepted by the name input. Filter by name." [stack]="true">
        <sol-search-input placeholder="Filter icons…" (searchChange)="query.set($event)" />
        @if (filtered().length) {
          <ul class="grid">
            @for (name of filtered(); track name) {
              <li class="tile">
                <sol-icon [name]="name" size="lg" />
                <code>{{ name }}</code>
              </li>
            }
          </ul>
        } @else {
          <p class="none">No icon matches “{{ query() }}”.</p>
        }
      </app-demo>
    </app-page>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: var(--sol-space-sm);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sol-space-xs);
      padding: var(--sol-space-sm);
      border: var(--sol-border-width-default) solid var(--sol-border-color-default);
      border-radius: var(--sol-border-radius-md);
      color: var(--sol-color-text-primary);
    }
    .tile code {
      font-size: var(--sol-font-size-sm);
      color: var(--sol-color-text-secondary);
      text-align: center;
      word-break: break-word;
    }
    .none {
      color: var(--sol-color-text-secondary);
    }
  `,
})
export class IconsPage {
  protected readonly names = ICON_NAMES;
  protected readonly query = signal('');
  protected readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase();
    return term ? this.names.filter((name) => name.includes(term)) : this.names;
  });
  protected readonly basicCode = `<sol-icon name="star" size="sm" />
<sol-icon name="star" />                          <!-- size="md", variant="outline" -->
<sol-icon name="heart" size="lg" variant="fill" />`;
}

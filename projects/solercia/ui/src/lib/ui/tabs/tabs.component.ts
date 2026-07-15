import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
} from '@angular/core';

export interface SolTabItem {
  id: string;
  label: string;
  icon?: string;
}

@Component({
  selector: 'sol-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-tabs" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="sol-tabs__tab"
          [class.sol-tabs__tab--active]="activeTab() === tab.id"
          [attr.aria-selected]="activeTab() === tab.id"
          (click)="selectTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      }
      <div class="sol-tabs__indicator" [style]="indicatorStyle()"></div>
    </div>
  `,
  styles: `
    .sol-tabs {
      display: flex;
      position: relative;
      border-bottom: 1px solid var(--sol-border-color-default, #E2E8F0);
      gap: 0;
    }

    .sol-tabs__tab {
      position: relative;
      padding: 10px 16px;
      border: none;
      background: transparent;
      font-family: var(--sol-font-family);
      font-size: var(--sol-font-size-sm, 12px);
      font-weight: 500;
      color: var(--sol-color-text-secondary, #64748B);
      cursor: pointer;
      transition: color 0.2s ease, background-color 0.2s ease;
      white-space: nowrap;
      z-index: 1;
    }

    .sol-tabs__tab:hover {
      color: var(--sol-color-primary, #2563EB);
      background: color-mix(in srgb, var(--sol-color-primary, #2563EB) 5%, transparent);
    }

    .sol-tabs__tab--active {
      color: var(--sol-color-primary, #2563EB);
      font-weight: 600;
      background: color-mix(in srgb, var(--sol-color-primary, #2563EB) 5%, transparent);
    }

    .sol-tabs__tab--active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--sol-color-primary, #2563EB);
      border-radius: 2px 2px 0 0;
    }

    .sol-tabs__indicator {
      display: none;
    }
  `,
})
export class SolTabsComponent {
  readonly tabs = input.required<SolTabItem[]>();
  readonly activeTab = input<string>('');
  readonly tabChange = output<string>();

  indicatorStyle = computed(() => '');

  selectTab(id: string): void {
    this.tabChange.emit(id);
  }
}

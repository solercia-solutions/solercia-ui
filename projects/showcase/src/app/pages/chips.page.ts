import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SolChipComponent,
  SolChipGroupComponent,
  SolViewToggleComponent,
  type SolChipOption,
  type SolViewToggleOption,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-chips-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageComponent, DemoComponent, SolChipComponent, SolChipGroupComponent, SolViewToggleComponent],
  template: `
    <app-page
      title="Chips & view toggle"
      lead="Compact choices: filter chips, single or multiple chip groups and a segmented view switch."
      [selectors]="['sol-chip', 'sol-chip-group', 'sol-view-toggle']"
    >
      <app-demo title="Chip" description="A standalone chip: toggled and removed emit its value." [code]="chipCode">
        @for (tag of tags(); track tag.value) {
          <sol-chip
            [value]="tag.value"
            [label]="tag.label"
            [emoji]="tag.emoji ?? ''"
            [count]="tag.count ?? null"
            [selected]="active().includes(tag.value)"
            [removable]="true"
            (toggled)="toggle($event)"
            (removed)="remove($event)"
          />
        }
        <sol-chip value="sm" label="Small" size="sm" />
        <sol-chip value="off" label="Disabled" [disabled]="true" />
        @if (!tags().length) {
          <button type="button" class="link" (click)="reset()">Restore chips</button>
        }
      </app-demo>

      <app-demo title="Chip group — single" description="radiogroup semantics; allowDeselect=false keeps one value." [code]="singleCode" [stack]="true">
        <sol-chip-group ariaLabelKey="showcase.chips" [options]="categories" [allowDeselect]="false" [(ngModel)]="category" />
        <p class="hint">Value: {{ category() }}</p>
      </app-demo>

      <app-demo title="Chip group — multiple & removable" [code]="multipleCode" [stack]="true">
        <sol-chip-group ariaLabelKey="showcase.chips" [options]="categories" [multiple]="true" [(ngModel)]="categoriesSelected" />
        <sol-chip-group ariaLabelKey="showcase.chips" [options]="categories" [multiple]="true" size="sm" [removable]="true" [ngModel]="['design']" />
        <sol-chip-group ariaLabelKey="showcase.chips" [options]="categories" [disabled]="true" [ngModel]="'dev'" />
        <p class="hint">Value: {{ categoriesSelected().join(', ') || '—' }}</p>
      </app-demo>

      <app-demo title="View toggle" description="Segmented control with optional icons." [code]="viewCode" [stack]="true">
        <sol-view-toggle [options]="views" [value]="view()" (valueChange)="view.set($event)" />
        <sol-view-toggle [options]="periods" [value]="period()" (valueChange)="period.set($event)" />
        <p class="hint">View: {{ view() }} · Period: {{ period() }}</p>
      </app-demo>
    </app-page>
  `,
  styles: `
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
    .link {
      border: 0;
      background: none;
      color: var(--sol-color-primary);
      cursor: pointer;
      font: inherit;
    }
  `,
})
export class ChipsPage {
  private readonly initialTags: SolChipOption[] = [
    { value: 'urgent', label: 'Urgent', emoji: '🔥', count: 3 },
    { value: 'review', label: 'In review', count: 12 },
    { value: 'mine', label: 'Assigned to me' },
  ];
  protected readonly tags = signal<SolChipOption[]>(this.initialTags);
  protected readonly active = signal<string[]>(['urgent']);
  protected readonly categories: SolChipOption[] = [
    { value: 'dev', label: 'Development', emoji: '💻' },
    { value: 'design', label: 'Design', emoji: '🎨' },
    { value: 'ops', label: 'Operations', count: 4 },
    { value: 'legal', label: 'Legal', disabled: true },
  ];
  protected readonly category = signal('dev');
  protected readonly categoriesSelected = signal<string[]>(['dev', 'ops']);
  protected readonly views: SolViewToggleOption[] = [
    { value: 'list', label: 'List', icon: 'list' },
    { value: 'board', label: 'Board', icon: 'view-columns' },
    { value: 'calendar', label: 'Calendar', icon: 'calendar' },
  ];
  protected readonly periods: SolViewToggleOption[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];
  protected readonly view = signal('board');
  protected readonly period = signal('month');

  protected toggle(value: string): void {
    this.active.update((list) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]));
  }

  protected remove(value: string): void {
    this.tags.update((list) => list.filter((tag) => tag.value !== value));
  }

  protected reset(): void {
    this.tags.set(this.initialTags);
  }

  protected readonly chipCode = `<sol-chip value="urgent" label="Urgent" emoji="🔥" [count]="3"
          [selected]="isActive('urgent')" [removable]="true"
          (toggled)="toggle($event)" (removed)="remove($event)" />
<sol-chip value="sm" label="Small" size="sm" />
<sol-chip value="off" label="Disabled" [disabled]="true" />`;
  protected readonly singleCode = `<sol-chip-group ariaLabelKey="showcase.chips" [options]="categories" [allowDeselect]="false" [(ngModel)]="category" />

categories: SolChipOption[] = [
  { value: 'dev', label: 'Development', emoji: '💻' },
  { value: 'ops', label: 'Operations', count: 4 },
  { value: 'legal', label: 'Legal', disabled: true },
];`;
  protected readonly multipleCode = `<sol-chip-group ariaLabelKey="showcase.chips" [options]="categories" [multiple]="true" [(ngModel)]="selected" />  <!-- string[] -->
<sol-chip-group ariaLabelKey="showcase.chips" [options]="categories" [multiple]="true" size="sm" [removable]="true" />`;
  protected readonly viewCode = `<sol-view-toggle [options]="views" [value]="view()" (valueChange)="view.set($event)" />

views: SolViewToggleOption[] = [
  { value: 'list', label: 'List', icon: 'list' },
  { value: 'board', label: 'Board', icon: 'view-columns' },
];`;
}

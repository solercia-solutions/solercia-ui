import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SolCheckboxComponent,
  SolSelectComponent,
  SolToggleComponent,
  type SolCheckboxColor,
  type SolSelectOption,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-selection-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageComponent, DemoComponent, SolSelectComponent, SolCheckboxComponent, SolToggleComponent],
  template: `
    <app-page
      title="Select, checkbox & toggle"
      lead="Choice controls. All three implement ControlValueAccessor."
      [selectors]="['sol-select', 'sol-checkbox', 'sol-toggle']"
    >
      <app-demo title="Select" description="Searchable by default; turns into a bottom sheet below mobileBreakpoint (640 px)." [code]="selectCode">
        <div class="grid">
          <sol-select searchPlaceholder="Search…" emptyLabel="No results" label="Country" placeholder="Select a country" [options]="countries" [(ngModel)]="country" />
          <sol-select
            label="Skills"
            placeholder="Select skills"
            [multiple]="true"
            [options]="skills"
            searchPlaceholder="Filter skills…"
            [(ngModel)]="selectedSkills"
          />
          <sol-select searchPlaceholder="Search…" emptyLabel="No results" label="Status" placeholder="All statuses" [options]="statuses" [showAllOption]="true" allOptionLabel="All statuses" [searchable]="false" [(ngModel)]="status" />
          <sol-select searchPlaceholder="Search…" label="Owner" placeholder="Select an owner" [options]="[]" emptyLabel="No people found" error="Choose an owner." />
          <sol-select searchPlaceholder="Search…" emptyLabel="No results" label="Region" [options]="countries" [disabled]="true" placeholder="Locked" />
        </div>
        <p class="hint">Country: {{ country() || '—' }} · Skills: {{ selectedSkills().join(', ') || '—' }} · Status: {{ status() || 'all' }}</p>
      </app-demo>

      <app-demo title="Checkbox" description="Sizes, colors, shapes, icons and an inline link." [code]="checkboxCode" [stack]="true">
        <div class="row">
          <sol-checkbox label="Small" size="sm" [(ngModel)]="terms" />
          <sol-checkbox label="Medium" [(ngModel)]="terms" />
          <sol-checkbox label="Large" size="lg" [(ngModel)]="terms" />
        </div>
        <div class="row">
          @for (color of colors; track color) {
            <sol-checkbox [label]="color" [color]="color" [ngModel]="true" />
          }
        </div>
        <div class="row">
          <sol-checkbox label="Square" shape="square" [ngModel]="true" />
          <sol-checkbox label="Circle" shape="circle" [ngModel]="true" />
          <sol-checkbox label="Favorite" icon="heart" color="pink" [ngModel]="true" />
          <sol-checkbox label="Starred" icon="star" color="amber" [ngModel]="true" />
          <sol-checkbox label="Partial" icon="minus" [ngModel]="true" />
          <sol-checkbox label="No ripple" [ripple]="false" />
          <sol-checkbox label="Disabled" [disabled]="true" />
        </div>
        <sol-checkbox label="I accept the" linkText="terms of service" linkHref="https://solercia.co" (changed)="accepted.set($event)" />
        <p class="hint">Accepted: {{ accepted() ? 'yes' : 'no' }}</p>
      </app-demo>

      <app-demo title="Toggle" [code]="toggleCode">
        <sol-toggle label="Email alerts" [(ngModel)]="alerts" />
        <sol-toggle label="Compact" size="sm" [ngModel]="true" />
        <sol-toggle ariaLabel="Public profile" onText="Public" offText="Private" [(ngModel)]="isPublic" />
        <sol-toggle label="Locked" [disabled]="true" [ngModel]="true" />
        <p class="hint">Alerts {{ alerts() ? 'on' : 'off' }} · Profile {{ isPublic() ? 'public' : 'private' }}</p>
      </app-demo>
    </app-page>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--sol-space-md);
      width: 100%;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sol-space-md);
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class SelectionPage {
  protected readonly countries: SolSelectOption[] = [
    { value: 'co', label: 'Colombia' },
    { value: 'mx', label: 'Mexico' },
    { value: 'pe', label: 'Peru' },
    { value: 'cl', label: 'Chile' },
    { value: 'ar', label: 'Argentina' },
  ];
  protected readonly skills: SolSelectOption[] = [
    { value: 'angular', label: 'Angular' },
    { value: 'laravel', label: 'Laravel' },
    { value: 'sql', label: 'SQL' },
    { value: 'ux', label: 'UX research' },
    { value: 'devops', label: 'DevOps' },
  ];
  protected readonly statuses: SolSelectOption[] = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'closed', label: 'Closed' },
  ];
  protected readonly colors: SolCheckboxColor[] = ['primary', 'secondary', 'success', 'danger', 'amber', 'teal', 'indigo', 'purple', 'pink'];

  protected readonly country = signal('co');
  protected readonly selectedSkills = signal<string[]>(['angular', 'ux']);
  protected readonly status = signal('');
  protected readonly terms = signal(true);
  protected readonly accepted = signal(false);
  protected readonly alerts = signal(true);
  protected readonly isPublic = signal(false);

  protected readonly selectCode = `<sol-select searchPlaceholder="Search…" emptyLabel="No results" label="Country" placeholder="Select a country" [options]="countries" [(ngModel)]="country" />
<sol-select label="Skills" [multiple]="true" [options]="skills" [(ngModel)]="skills" />   <!-- value: string[] -->
<sol-select label="Status" placeholder="All statuses" [options]="statuses" [showAllOption]="true" allOptionLabel="All statuses" [searchable]="false" />
<sol-select label="Owner" placeholder="Select an owner" [options]="[]" emptyLabel="No people found" error="Choose an owner." />

countries: SolSelectOption[] = [{ value: 'co', label: 'Colombia' }, { value: 'mx', label: 'Mexico' }];`;
  protected readonly checkboxCode = `<sol-checkbox label="Remember me" size="lg" [(ngModel)]="remember" />
<sol-checkbox label="Done" color="success" shape="circle" [ngModel]="true" />
<sol-checkbox label="Favorite" icon="heart" color="pink" />
<sol-checkbox label="I accept the" linkText="terms of service" linkHref="https://solercia.co" (changed)="accepted.set($event)" />`;
  protected readonly toggleCode = `<sol-toggle label="Email alerts" [(ngModel)]="alerts" />
<sol-toggle label="Compact" size="sm" />
<sol-toggle ariaLabel="Public profile" onText="Public" offText="Private" [(ngModel)]="isPublic" />`;
}

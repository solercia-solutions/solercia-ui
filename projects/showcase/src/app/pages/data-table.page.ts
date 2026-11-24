import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  SOL_TABLE_VARIANTS,
  SolButtonComponent,
  SolDataTableComponent,
  SolIconButtonComponent,
  SolViewToggleComponent,
  type DataTableColumn,
  type SolDataTableRow,
  type SolTableVariant,
  type SolViewToggleOption,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

const PEOPLE: SolDataTableRow[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineering', city: 'Bogotá', status: 'Active', projects: 7 },
  { id: 2, name: 'Alan Turing', role: 'Research', city: 'Medellín', status: 'Active', projects: 4 },
  { id: 3, name: 'Grace Hopper', role: 'Engineering', city: 'Cali', status: 'On leave', projects: 9 },
  { id: 4, name: 'Katherine Johnson', role: 'Analytics', city: 'Bogotá', status: 'Active', projects: 5 },
  { id: 5, name: 'Linus Torvalds', role: 'Operations', city: 'Barranquilla', status: 'Inactive', projects: 2 },
  { id: 6, name: 'Margaret Hamilton', role: 'Engineering', city: 'Cartagena', status: 'Active', projects: 11 },
  { id: 7, name: 'Tim Berners-Lee', role: 'Research', city: 'Bogotá', status: 'Active', projects: 3 },
  { id: 8, name: 'Barbara Liskov', role: 'Analytics', city: 'Pereira', status: 'On leave', projects: 6 },
  { id: 9, name: 'Dennis Ritchie', role: 'Operations', city: 'Manizales', status: 'Active', projects: 8 },
  { id: 10, name: 'Hedy Lamarr', role: 'Research', city: 'Bucaramanga', status: 'Active', projects: 1 },
  { id: 11, name: 'John von Neumann', role: 'Analytics', city: 'Medellín', status: 'Inactive', projects: 2 },
  { id: 12, name: 'Radia Perlman', role: 'Operations', city: 'Cali', status: 'Active', projects: 5 },
];

@Component({
  selector: 'app-data-table-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolDataTableComponent, SolButtonComponent, SolIconButtonComponent, SolViewToggleComponent],
  template: `
    <app-page
      title="Data table"
      lead="Sorting, column filters, global search, pagination, row actions and a collapsed card layout below collapseWidth."
      [selectors]="['sol-data-table']"
    >
      <app-demo title="Full table" description="Variants come from the theme by default; the variant input overrides it." [code]="fullCode" [stack]="true">
        <div class="scroll-x"><sol-view-toggle [options]="variantOptions" [value]="variantChoice()" (valueChange)="setVariant($event)" /></div>
        <sol-data-table
          actionsLabel="Actions"
          toggleDetailsLabel="Show or hide the row details"
          emptyMessage="No people match the filters."
          [data]="rows()"
          [columns]="columns"
          [variant]="variant()"
          searchPlaceholder="Search people…"
          (editClicked)="log.set('Edit ' + $event['name'])"
          (deleteClicked)="remove($event)"
        >
          <sol-button tableActions size="sm" (clicked)="restore()">Restore rows</sol-button>
        </sol-data-table>
        <p class="hint">{{ log() || 'Use the row actions.' }}</p>
      </app-demo>

      <app-demo title="Custom row actions, actions first, no toolbar" [code]="customCode" [stack]="true">
        <sol-data-table toggleDetailsLabel="Show or hide the row details" [data]="rows().slice(0, 4)" [columns]="compactColumns" [showToolbar]="false" [paginated]="false" actionsPosition="start" actionsLabel="">
          <ng-template #rowActions let-row>
            <sol-icon-button icon="eye" variant="ghost" size="sm" [ariaLabel]="'View ' + row['name']" (clicked)="log.set('View ' + row['name'])" />
          </ng-template>
        </sol-data-table>
      </app-demo>

      <app-demo title="Loading and empty" [code]="statesCode" [stack]="true">
        <sol-data-table actionsLabel="Actions" toggleDetailsLabel="Show or hide the row details" searchPlaceholder="Search…" [data]="[]" [columns]="compactColumns" [loading]="true" [showActions]="false" />
        <sol-data-table actionsLabel="Actions" toggleDetailsLabel="Show or hide the row details" searchPlaceholder="Search…" [data]="[]" [columns]="compactColumns" [showActions]="false" emptyMessage="No people match the filters." />
      </app-demo>
    </app-page>
  `,
  styles: `
    .scroll-x {
      overflow-x: auto;
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class DataTablePage {
  protected readonly rows = signal<SolDataTableRow[]>(PEOPLE);
  protected readonly log = signal('');
  protected readonly columns: DataTableColumn[] = [
    { key: 'name', label: 'Name', sortable: true, filter: 'text' },
    { key: 'role', label: 'Area', sortable: true, filter: 'select' },
    { key: 'city', label: 'City', sortable: true },
    { key: 'status', label: 'Status', badge: true, filter: 'select' },
    { key: 'projects', label: 'Projects', sortable: true, width: '110px' },
  ];
  protected readonly compactColumns: DataTableColumn[] = this.columns.slice(0, 3).map(({ key, label }) => ({ key, label }));
  protected readonly variantOptions: SolViewToggleOption[] = [
    { value: 'theme', label: 'Theme' },
    ...SOL_TABLE_VARIANTS.map((value) => ({ value, label: value })),
  ];
  protected readonly variantChoice = signal('theme');
  protected readonly variant = computed<SolTableVariant | null>(() => {
    const choice = this.variantChoice();
    return (SOL_TABLE_VARIANTS as readonly string[]).includes(choice) ? (choice as SolTableVariant) : null;
  });

  protected setVariant(value: string): void {
    this.variantChoice.set(value);
  }

  protected remove(row: SolDataTableRow): void {
    this.rows.update((list) => list.filter((item) => item['id'] !== row['id']));
    this.log.set(`Deleted ${String(row['name'])}`);
  }

  protected restore(): void {
    this.rows.set(PEOPLE);
    this.log.set('Rows restored');
  }

  protected readonly fullCode = `<sol-data-table
  [data]="people()"
  [columns]="columns"
  variant="zebra"                 <!-- clean | zebra | bordered | emphasis-header | banded; null = theme -->
  searchPlaceholder="Search people…"
  (editClicked)="edit($event)"
  (deleteClicked)="remove($event)"
>
  <sol-button tableActions size="sm">Restore rows</sol-button>   <!-- also: [tableFilters] slot -->
</sol-data-table>

columns: DataTableColumn[] = [
  { key: 'name', label: 'Name', sortable: true, filter: 'text' },
  { key: 'role', label: 'Area', sortable: true, filter: 'select' },
  { key: 'status', label: 'Status', badge: true },
  { key: 'projects', label: 'Projects', sortable: true, width: '110px' },
];`;
  protected readonly customCode = `<sol-data-table [data]="rows" [columns]="columns" [showToolbar]="false" [paginated]="false" actionsPosition="start">
  <ng-template #rowActions let-row>
    <sol-icon-button icon="eye" size="sm" [ariaLabel]="'View ' + row['name']" (clicked)="view(row)" />
  </ng-template>
</sol-data-table>`;
  protected readonly statesCode = `<sol-data-table [data]="[]" [columns]="columns" [loading]="true" [showActions]="false" />
<sol-data-table [data]="[]" [columns]="columns" [showActions]="false" emptyMessage="No people match the filters." />
<!-- Default texts are Colombian Spanish; override searchPlaceholder, emptyMessage,
     actionsLabel and toggleDetailsLabel for other languages. -->`;
}

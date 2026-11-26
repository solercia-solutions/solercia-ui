import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { SolIconComponent } from '../icon/icon.component';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';

@Component({
  selector: 'sol-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  template: `
    <div class="sol-pagination">
      <div class="sol-pagination__size">
        <label class="sol-pagination__size-label" [attr.for]="sizeSelectId">{{ t('show') }}</label>
        <select
          [id]="sizeSelectId"
          class="sol-pagination__size-select"
          [value]="pageSize()"
          (change)="onPageSizeChange($event)"
        >
          @for (size of pageSizeOptions(); track size) {
            <option [value]="size">{{ size }}</option>
          }
        </select>
        <span class="sol-pagination__size-label">{{ t('rows') }}</span>
      </div>

      <div class="sol-pagination__nav">
        <span class="sol-pagination__info">
          {{ rangeText() }}
        </span>
        <button
          type="button"
          class="sol-pagination__btn"
          [disabled]="currentPage() <= 1"
          [attr.aria-label]="t('previous')"
          (click)="onPageChange(currentPage() - 1)"
        >
          <sol-icon name="chevron-left" size="sm" />
        </button>
        @for (p of pages(); track p) {
          <button
            type="button"
            class="sol-pagination__btn"
            [class.sol-pagination__btn--active]="p === currentPage()"
            (click)="onPageChange(p)"
          >
            {{ p }}
          </button>
        }
        <button
          type="button"
          class="sol-pagination__btn"
          [disabled]="currentPage() >= totalPages()"
          [attr.aria-label]="t('next')"
          (click)="onPageChange(currentPage() + 1)"
        >
          <sol-icon name="chevron-right" size="sm" />
        </button>
      </div>
    </div>
  `,
  styles: `
    .sol-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      gap: 16px;
    }

    .sol-pagination__size {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .sol-pagination__size-label {
      font-size: var(--sol-font-size-sm, 12px);
      color: var(--sol-color-text-muted, #94A3B8);
    }

    .sol-pagination__size-select {
      padding: 6px 28px 6px 10px;
      border: 1px solid var(--sol-border-color-default, #E2E8F0);
      border-radius: var(--sol-border-radius-sm, 6px);
      background-color: var(--sol-bg-surface, #fff);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      color: var(--sol-color-text-primary, #0F172A);
      font-size: var(--sol-font-size-sm, 12px);
      font-family: var(--sol-font-family);
      outline: none;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      transition: border-color 0.15s;
    }

    .sol-pagination__size-select:focus {
      border-color: var(--sol-color-primary, #2563EB);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--sol-color-primary, #2563EB) 15%, transparent);
    }

    .sol-pagination__nav {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .sol-pagination__info {
      font-size: var(--sol-font-size-sm, 12px);
      color: var(--sol-color-text-muted, #94A3B8);
      margin-right: 8px;
    }

    .sol-pagination__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border: none;
      border-radius: var(--sol-border-radius-sm, 6px);
      background: transparent;
      color: var(--sol-color-text-secondary, #64748B);
      font-size: var(--sol-font-size-sm, 12px);
      font-family: var(--sol-font-family);
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
    }

    .sol-pagination__btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--sol-color-primary, #2563EB) 8%, transparent);
      color: var(--sol-color-primary, #2563EB);
    }

    .sol-pagination__btn--active {
      background: var(--sol-color-primary, #2563EB) !important;
      color: #fff !important;
      font-weight: 600;
    }

    .sol-pagination__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `,
})
export class SolPaginationComponent {
  private static nextId = 0;
  private readonly i18n = injectSolI18n();

  /** Id that ties the page-size label to its select. */
  readonly sizeSelectId = `sol-pagination-size-${SolPaginationComponent.nextId++}`;

  readonly totalItems = input<number>(0);
  readonly pageSize = input<number>(10);
  readonly currentPage = input<number>(1);
  readonly pageSizeOptions = input<number[]>([10, 25, 50]);

  readonly pageChanged = output<number>();
  readonly pageSizeChanged = output<number>();

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalItems() / this.pageSize()))
  );

  readonly startItem = computed(() =>
    this.totalItems() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1
  );

  readonly endItem = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.totalItems())
  );

  readonly rangeText = computed(() =>
    this.t('range', { start: this.startItem(), end: this.endItem(), total: this.totalItems() }),
  );

  /** Resolves `shared.pagination.<key>` (reacts to language changes). */
  protected t(key: string, params?: Record<string, unknown>): string {
    this.i18n.activeLang();
    return this.i18n.translate(`shared.pagination.${key}`, params);
  }

  readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const maxVisible = 5;

    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    const end = Math.min(total, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.pageChanged.emit(page);
    }
  }

  onPageSizeChange(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    this.pageSizeChanged.emit(size);
  }
}

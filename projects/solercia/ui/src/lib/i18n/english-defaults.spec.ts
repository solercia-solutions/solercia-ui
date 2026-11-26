import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SOL_I18N, createIdentitySolI18n, createSolI18n, type SolI18n } from './sol-i18n';
import { SolModalComponent } from '../ui/modal/modal.component';
import { SolConfirmDialogComponent } from '../ui/confirm-dialog/confirm-dialog.component';
import { SolDataTableComponent } from '../ui/data-table/data-table.component';
import { SolSearchInputComponent } from '../ui/search-input/search-input.component';
import { SolSelectComponent } from '../ui/select/select.component';
import { SolFileUploadComponent } from '../ui/file-upload/file-upload.component';
import { SolWizardComponent } from '../ui/wizard/wizard.component';
import { SolPaginationComponent } from '../ui/pagination/pagination.component';
import { SolProgressBarComponent } from '../ui/progress-bar/progress-bar.component';
import { SolDrawerComponent } from '../ui/drawer/drawer.component';

function render<T>(component: Type<T>, inputs: Record<string, unknown> = {}, i18n?: SolI18n): HTMLElement {
  TestBed.configureTestingModule({
    imports: [component],
    providers: i18n ? [{ provide: SOL_I18N, useValue: i18n }] : [],
  });
  const fixture = TestBed.createComponent(component);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const text = (root: HTMLElement, selector: string): string =>
  (root.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
const attr = (root: HTMLElement, selector: string, name: string): string | null =>
  root.querySelector(selector)?.getAttribute(name) ?? null;

/** A host engine (Transloco-like) in Spanish that predates the 0.8.0 keys: returns keys it does not know. */
function legacySpanishHost(): SolI18n {
  return { ...createIdentitySolI18n(), activeLang: signal('es-CO') };
}

describe('English defaults without any SOL_I18N provider', () => {
  afterEach(() => (document.body.style.overflow = ''));

  it('sol-modal: close button label', () => {
    const el = render(SolModalComponent, { open: true, title: 'Edit' });
    expect(attr(el, '.sol-modal-close', 'aria-label')).toBe('Close');
  });

  it('sol-drawer: close button label', () => {
    const el = render(SolDrawerComponent, { open: true, title: 'Filters' });
    expect(attr(el, '.sol-drawer-close', 'aria-label')).toBe('Close');
  });

  it('sol-confirm-dialog: title and actions', () => {
    const el = render(SolConfirmDialogComponent, { open: true });
    expect(text(el, '.sol-confirm-title')).toBe('Are you sure?');
    expect(text(el, '[data-testid="sol-confirm-accept"]')).toBe('Confirm');
    expect(text(el, '[data-testid="sol-confirm-cancel"]')).toBe('Cancel');
  });

  it('sol-data-table: search placeholder, actions header and empty message', () => {
    const el = render(SolDataTableComponent, { columns: [{ key: 'name', label: 'Name' }], data: [] });
    expect(attr(el, '.sol-search-input__field', 'placeholder')).toBe('Search...');
    expect(text(el, '.sol-data-table__th--actions')).toBe('Actions');
    expect(el.textContent).toContain('No data available');
  });

  it('sol-search-input: placeholder', () => {
    const el = render(SolSearchInputComponent);
    expect(attr(el, '.sol-search-input__field', 'placeholder')).toBe('Search...');
  });

  it('sol-select: placeholder', () => {
    const el = render(SolSelectComponent, { options: [{ value: 'a', label: 'A' }] });
    expect(el.textContent).toContain('Select...');
  });

  it('sol-file-upload: label and hint', () => {
    const el = render(SolFileUploadComponent);
    expect(text(el, '.sol-file-upload__hint-primary')).toBe('Drag or click to upload');
    expect(text(el, '.sol-file-upload__hint-secondary')).toBe('JPG, PNG, WEBP or GIF · max. 5 MB');
  });

  it('sol-wizard: navigation buttons', () => {
    const el = render(SolWizardComponent, { steps: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] });
    expect(el.textContent).toContain('Next');
    expect(el.textContent).not.toContain('Siguiente');
  });

  it('sol-pagination: page size label and range', () => {
    const el = render(SolPaginationComponent, { totalItems: 42 });
    expect(el.textContent).toContain('Show');
    expect(el.textContent).toContain('rows');
    expect(text(el, '.sol-pagination__info')).toBe('1–10 of 42');
  });

  it('sol-progress-bar: segmented label', () => {
    const el = render(SolProgressBarComponent, { mode: 'segmented', steps: 3, current: 0, showLabel: true });
    expect(el.textContent).toContain('Step 1 of 3');
  });
});

describe('Spanish hosts keep Spanish', () => {
  afterEach(() => (document.body.style.overflow = ''));

  it('with the bundled es-CO engine', () => {
    const el = render(SolConfirmDialogComponent, { open: true }, createSolI18n({ lang: 'es-CO' }));
    expect(text(el, '.sol-confirm-title')).toBe('¿Estás seguro?');
    expect(text(el, '[data-testid="sol-confirm-accept"]')).toBe('Confirmar');
    expect(text(el, '[data-testid="sol-confirm-cancel"]')).toBe('Cancelar');
  });

  it('with a Spanish host engine that does not know the new keys', () => {
    const el = render(SolDataTableComponent, { columns: [{ key: 'name', label: 'Name' }], data: [] }, legacySpanishHost());
    expect(attr(el, '.sol-search-input__field', 'placeholder')).toBe('Buscar...');
    expect(text(el, '.sol-data-table__th--actions')).toBe('Acciones');
    expect(el.textContent).toContain('No hay datos disponibles');
  });

  it('modal close label in Spanish', () => {
    const el = render(SolModalComponent, { open: true, title: 'Editar' }, legacySpanishHost());
    expect(attr(el, '.sol-modal-close', 'aria-label')).toBe('Cerrar');
  });
});

describe('Explicit inputs always win', () => {
  it('data-table, confirm-dialog and file-upload overrides', () => {
    const table = render(SolDataTableComponent, {
      columns: [{ key: 'name', label: 'Name' }],
      data: [],
      searchPlaceholder: 'Find a user',
      actionsLabel: 'Ops',
      emptyMessage: 'Nothing here',
    });
    expect(attr(table, '.sol-search-input__field', 'placeholder')).toBe('Find a user');
    expect(text(table, '.sol-data-table__th--actions')).toBe('Ops');
    expect(table.textContent).toContain('Nothing here');
  });

  it('confirm-dialog labels', () => {
    const el = render(SolConfirmDialogComponent, { open: true, title: 'Delete?', confirmLabel: 'Yes', cancelLabel: 'No' }, createSolI18n({ lang: 'es-CO' }));
    expect(text(el, '.sol-confirm-title')).toBe('Delete?');
    expect(text(el, '[data-testid="sol-confirm-accept"]')).toBe('Yes');
    expect(text(el, '[data-testid="sol-confirm-cancel"]')).toBe('No');
  });

  it('file-upload label and hint', () => {
    const el = render(SolFileUploadComponent, { label: 'Upload a logo', hint: 'SVG only' });
    expect(text(el, '.sol-file-upload__hint-primary')).toBe('Upload a logo');
    expect(text(el, '.sol-file-upload__hint-secondary')).toBe('SVG only');
  });
});

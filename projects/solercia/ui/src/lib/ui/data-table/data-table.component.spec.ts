import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ThemeService } from '../../tokens';
import {
  SolDataTableComponent,
  type DataTableColumn,
  type SolDataTableRow,
} from './data-table.component';

/**
 * Specs de `SolDataTableComponent` con `ThemeService` MOCKEADO (sin efectos
 * sobre `:root` ni localStorage): tema nulo + light => modo desktop (tabla),
 * ya que `matchMedia` no marca viewport móvil en el entorno de test.
 */

const COLUMNS: DataTableColumn[] = [
  { key: 'name', label: 'Nombre', sortable: true },
  { key: 'email', label: 'Correo' },
  { key: 'status', label: 'Estado', badge: true },
];

const DATA: SolDataTableRow[] = [
  { id: 1, name: 'Ana', email: 'ana@correo.co', status: 'Activo' },
  { id: 2, name: 'Beto', email: 'beto@correo.co', status: 'Inactivo' },
];

describe('SolDataTableComponent — tabla de datos genérica', () => {
  let fixture: ComponentFixture<SolDataTableComponent>;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function makeFixture(inputs: Record<string, unknown> = {}): ComponentFixture<SolDataTableComponent> {
    const f = TestBed.createComponent(SolDataTableComponent);
    f.componentRef.setInput('columns', COLUMNS);
    f.componentRef.setInput('data', DATA);
    for (const [key, value] of Object.entries(inputs)) {
      f.componentRef.setInput(key, value);
    }
    f.detectChanges();
    return f;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolDataTableComponent],
      providers: [
        {
          provide: ThemeService,
          useValue: {
            isDark: signal(false).asReadonly(),
            activeTheme: signal(null).asReadonly(),
          },
        },
      ],
    });
    fixture = makeFixture();
  });

  it('renderiza un encabezado por columna más la columna de acciones', () => {
    const headers = Array.from(el().querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Nombre', 'Correo', 'Estado', 'Acciones']);
  });

  it('renderiza una fila por elemento con sus valores resueltos', () => {
    const rows = el().querySelectorAll('tbody tr.sol-data-table__tr');
    expect(rows.length).toBe(2);
    expect(el().textContent).toContain('Ana');
    expect(el().textContent).toContain('beto@correo.co');
  });

  it('muestra el mensaje de vacío cuando no hay datos', () => {
    fixture.componentRef.setInput('data', []);
    fixture.detectChanges();

    const empty = el().querySelector('.sol-data-table__empty');
    expect(empty?.textContent?.trim()).toBe('No hay datos disponibles');
    expect(el().querySelectorAll('tbody tr.sol-data-table__tr').length).toBe(0);
  });

  it('en carga muestra filas skeleton y marca aria-busy, sin paginación', () => {
    const loadingFixture = makeFixture({ loading: true });
    // Segundo ciclo: el effect anti-flash enciende loadingVisible y el
    // template lo refleja.
    loadingFixture.detectChanges();

    const host = loadingFixture.nativeElement as HTMLElement;
    expect(host.querySelector('.sol-data-table')?.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelectorAll('sol-skeleton').length).toBe(7);
    expect(host.querySelector('sol-pagination')).toBeNull();
  });

  it('emite editClicked con la fila al usar la acción de editar', () => {
    const emitted: SolDataTableRow[] = [];
    fixture.componentInstance.editClicked.subscribe((row) => emitted.push(row));

    const firstRowButtons = el().querySelectorAll<HTMLButtonElement>(
      'tbody tr.sol-data-table__tr:first-child .sol-data-table__td--actions button',
    );
    // [0] editar, [1] eliminar.
    firstRowButtons[0].click();

    expect(emitted).toEqual([DATA[0]]);
  });

  it('emite deleteClicked con la fila al usar la acción de eliminar', () => {
    const emitted: SolDataTableRow[] = [];
    fixture.componentInstance.deleteClicked.subscribe((row) => emitted.push(row));

    const secondRowButtons = el().querySelectorAll<HTMLButtonElement>(
      'tbody tr.sol-data-table__tr:nth-child(2) .sol-data-table__td--actions button',
    );
    secondRowButtons[1].click();

    expect(emitted).toEqual([DATA[1]]);
  });

  it('filtra las filas por el término de búsqueda', () => {
    fixture.componentInstance.onSearch('beto');
    fixture.detectChanges();

    const rows = el().querySelectorAll('tbody tr.sol-data-table__tr');
    expect(rows.length).toBe(1);
    expect(el().textContent).toContain('Beto');
    expect(el().textContent).not.toContain('Ana');
  });

  it('ordena de forma ascendente y descendente por una columna sortable', () => {
    fixture.componentInstance.onSort('name');
    fixture.detectChanges();
    expect(fixture.componentInstance.pagedData().map((r) => r['name'])).toEqual(['Ana', 'Beto']);

    fixture.componentInstance.onSort('name');
    fixture.detectChanges();
    expect(fixture.componentInstance.pagedData().map((r) => r['name'])).toEqual(['Beto', 'Ana']);
  });

  // PR7a (T49) — paridad de defaults con el widget local de boki-front que este
  // componente reemplaza vía puente: `actionsLabel` ya coincidía ('Acciones',
  // ver el primer test de este archivo); `toggleDetailsLabel` NO coincidía
  // ('Ver detalles' vs. la clave i18n real `shared.table.toggleDetails` =
  // 'Mostrar u ocultar el detalle de la fila') — se cierra aquí la brecha.
  it('el default de actionsLabel/toggleDetailsLabel iguala el texto real del widget de boki-front', () => {
    expect(fixture.componentInstance.actionsLabel()).toBe('Acciones');
    expect(fixture.componentInstance.toggleDetailsLabel()).toBe('Mostrar u ocultar el detalle de la fila');
  });
});

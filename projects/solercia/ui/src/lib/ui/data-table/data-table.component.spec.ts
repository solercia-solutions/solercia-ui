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
 * ya que jsdom no implementa `ResizeObserver` (ni `matchMedia`, su valor
 * inicial anti-flicker — ver `observeContainerWidth`) — el host nunca se
 * mide como angosto, así que `mobileCollapse` queda en `false` salvo que un
 * test mockee el observer explícitamente (ver el describe de "colapso por
 * ancho del contenedor" más abajo).
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

/**
 * Mock de `ResizeObserver` (0.6.0, ver `observeContainerWidth` en el
 * componente) — mismo patrón que `MockIntersectionObserver` más abajo: jsdom
 * no lo implementa, así que los tests que necesitan forzar el colapso por
 * ancho del contenedor lo stubbean con `vi.stubGlobal` y disparan `emit(...)`
 * a mano (el `ResizeObserver` real dispara async; aquí es síncrono a propósito).
 */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: (entries: Array<{ contentRect: { width: number } }>) => void) {
    MockResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  emit(width: number): void {
    this.callback([{ contentRect: { width } }]);
  }
}

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

  // PR7a (T49) — el default de cada texto se alinea con la clave i18n real
  // de boki-front para que un consumidor sin override obtenga el texto
  // correcto: `actionsLabel` ya coincidía ('Acciones', ver el primer test
  // de este archivo); `toggleDetailsLabel` NO coincidía ('Ver detalles' vs.
  // la clave i18n real `shared.table.toggleDetails` = 'Mostrar u ocultar el
  // detalle de la fila') — se cierra aquí la brecha.
  it('el default de actionsLabel/toggleDetailsLabel iguala el texto real del widget de boki-front', () => {
    expect(fixture.componentInstance.actionsLabel()).toBe('Acciones');
    expect(fixture.componentInstance.toggleDetailsLabel()).toBe('Mostrar u ocultar el detalle de la fila');
  });
});

/**
 * Specs de `[solRowReveal]` (4R de PR7, WARNING-1): punto de extensión OCP
 * que restaura la animación de entrada del widget local borrado (T51) sin
 * acoplar la lib a `[solReveal]` de boki-front — mismo contrato de clases y
 * tokens (`--sol-reveal-index`, `.sol-reveal-in`, `.sol-reveal-in--replay`),
 * reimplementado dentro de la lib. jsdom NO implementa IntersectionObserver:
 * se stubbea un mock controlable, igual que en `reveal.directive.spec.ts`.
 */
describe('SolDataTableComponent — [solRowReveal] (animación de entrada por fila)', () => {
  type ObserverEntry = Pick<IntersectionObserverEntry, 'isIntersecting'>;
  type ObserverCallback = (entries: ObserverEntry[]) => void;

  class MockIntersectionObserver {
    static instances: MockIntersectionObserver[] = [];
    readonly observed: Element[] = [];
    disconnected = false;

    constructor(
      private readonly callback: ObserverCallback,
      readonly options?: IntersectionObserverInit,
    ) {
      MockIntersectionObserver.instances.push(this);
    }

    observe(element: Element): void {
      this.observed.push(element);
    }

    unobserve(): void {}

    disconnect(): void {
      this.disconnected = true;
    }

    emit(isIntersecting: boolean): void {
      this.callback([{ isIntersecting }]);
    }
  }

  let fixture: ComponentFixture<SolDataTableComponent>;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(el().querySelectorAll('tbody tr.sol-data-table__tr'));
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
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('setea --sol-reveal-index por fila según su posición ($index)', () => {
    fixture = makeFixture();
    const [first, second] = rows();

    expect(first.style.getPropertyValue('--sol-reveal-index')).toBe('0');
    expect(second.style.getPropertyValue('--sol-reveal-index')).toBe('1');
  });

  it('con rowReveal por defecto (true): oculta las filas y las observa con threshold bajo (una instancia por fila)', () => {
    fixture = makeFixture();

    expect(rows()[0].style.opacity).toBe('0');
    expect(rows()[1].style.opacity).toBe('0');
    expect(MockIntersectionObserver.instances.length).toBe(DATA.length);
    expect(MockIntersectionObserver.instances[0].observed).toEqual([rows()[0]]);
    expect(MockIntersectionObserver.instances[1].observed).toEqual([rows()[1]]);
    expect(MockIntersectionObserver.instances[0].options?.threshold).toBe(0.05);
  });

  it('al entrar al viewport agrega .sol-reveal-in, libera la opacidad y desconecta (una sola vez)', () => {
    fixture = makeFixture();
    const observer = MockIntersectionObserver.instances[0];

    observer.emit(true);

    expect(rows()[0].classList.contains('sol-reveal-in')).toBe(true);
    expect(rows()[0].style.opacity).toBe('');
    expect(observer.disconnected).toBe(true);
  });

  it('con [rowReveal]="false": NO oculta las filas ni las observa (opt-out)', () => {
    fixture = makeFixture({ rowReveal: false });

    expect(MockIntersectionObserver.instances.length).toBe(0);
    expect(rows()[0].style.opacity).toBe('');
  });

  it('el replay se dispara al ordenar sobre una fila ya revelada (sin quitarla del set)', () => {
    fixture = makeFixture();
    // Revela la fila de Ana (primera instancia observada); `onSort` reordena
    // sin quitar filas del set, así que su directiva sigue viva (track por
    // `id`) y sí debe reaccionar al cambio de `revealReplayKey`.
    MockIntersectionObserver.instances[0].emit(true);

    fixture.componentInstance.onSort('name');
    fixture.detectChanges();

    const anaRow = Array.from(rows()).find((r) => r.textContent?.includes('Ana'));
    expect(anaRow?.classList.contains('sol-reveal-in--replay')).toBe(true);
  });
});

/** Specs de `actionsPosition` (0.6.0). */
describe('SolDataTableComponent — actionsPosition', () => {
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
  });

  it('por defecto ("end") la columna de acciones va DESPUÉS de las columnas de datos', () => {
    fixture = makeFixture();

    const headerCells = Array.from(el().querySelectorAll('thead tr:first-child th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(headerCells).toEqual(['Nombre', 'Correo', 'Estado', 'Acciones']);

    const firstRowCells = el().querySelectorAll('tbody tr.sol-data-table__tr:first-child > *');
    expect(firstRowCells[firstRowCells.length - 1].className).toContain('sol-data-table__td--actions');
  });

  it('con actionsPosition="start" la columna de acciones va ANTES, como primera columna', () => {
    fixture = makeFixture({ actionsPosition: 'start' });

    const headerCells = Array.from(el().querySelectorAll('thead tr:first-child th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(headerCells).toEqual(['Acciones', 'Nombre', 'Correo', 'Estado']);

    const firstRowCells = el().querySelectorAll('tbody tr.sol-data-table__tr:first-child > *');
    expect(firstRowCells[0].className).toContain('sol-data-table__td--actions');

    // El botón editar de la primera fila sigue funcionando en la nueva posición.
    const emitted: SolDataTableRow[] = [];
    fixture.componentInstance.editClicked.subscribe((row) => emitted.push(row));
    firstRowCells[0].querySelector<HTMLButtonElement>('button')?.click();
    expect(emitted).toEqual([DATA[0]]);
  });
});

/**
 * Variante visual (0.6.0): `variant` del input sobrescribe
 * `component.table.variant` del tema; sin ninguno, sin atributo (look de siempre).
 */
describe('SolDataTableComponent — variante visual', () => {
  const activeTheme = signal<unknown>(null);

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

  function variantOf(f: ComponentFixture<SolDataTableComponent>): string | null {
    return (f.nativeElement as HTMLElement).querySelector('.sol-data-table')!.getAttribute('data-variant');
  }

  function themeWithVariant(variant: string): unknown {
    const mode = { component: { table: { variant } } };
    return { modes: { light: mode, dark: mode } };
  }

  beforeEach(() => {
    activeTheme.set(null);
    TestBed.configureTestingModule({
      imports: [SolDataTableComponent],
      providers: [
        {
          provide: ThemeService,
          useValue: { isDark: signal(false).asReadonly(), activeTheme: activeTheme.asReadonly() },
        },
      ],
    });
  });

  it('sin input ni tema no pone data-variant: la tabla conserva su look de siempre', () => {
    expect(variantOf(makeFixture())).toBeNull();
  });

  it('toma component.table.variant del tema activo', () => {
    activeTheme.set(themeWithVariant('banded'));
    expect(variantOf(makeFixture())).toBe('banded');
  });

  it('el input variant sobrescribe al del tema', () => {
    activeTheme.set(themeWithVariant('banded'));
    expect(variantOf(makeFixture({ variant: 'bordered' }))).toBe('bordered');
  });

  it('las reglas de la variante solo usan tokens var(--sol-*) con respaldo', () => {
    makeFixture({ variant: 'zebra' });
    const css = Array.from(document.head.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
    const start = css.indexOf('--sol-table-header-bg:');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).not.toMatch(/:\s*#[0-9A-Fa-f]{3,8}\s*;/);
  });
});

/**
 * Specs de filtros por columna (0.6.0, ver `DataTableColumn.filter`).
 */
describe('SolDataTableComponent — filtros por columna', () => {
  const FILTER_COLUMNS: DataTableColumn[] = [
    { key: 'name', label: 'Nombre', sortable: true, filter: 'text' },
    { key: 'email', label: 'Correo' },
    { key: 'status', label: 'Estado', badge: true, filter: 'select' },
  ];

  let fixture: ComponentFixture<SolDataTableComponent>;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function makeFixture(
    columns: DataTableColumn[],
    inputs: Record<string, unknown> = {},
  ): ComponentFixture<SolDataTableComponent> {
    const f = TestBed.createComponent(SolDataTableComponent);
    f.componentRef.setInput('columns', columns);
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
  });

  it('sin ninguna columna con `filter` NO renderiza la fila de filtros', () => {
    fixture = makeFixture(COLUMNS);
    expect(el().querySelector('.sol-data-table__filters-row')).toBeNull();
  });

  it('con al menos una columna con `filter` renderiza la fila, con un control por columna filtrable', () => {
    fixture = makeFixture(FILTER_COLUMNS);
    const filterRow = el().querySelector('.sol-data-table__filters-row');

    expect(filterRow).not.toBeNull();
    expect(filterRow?.querySelector('.sol-data-table__filter-input')).not.toBeNull();
    expect(filterRow?.querySelector('.sol-data-table__filter-select')).not.toBeNull();
  });

  it('la fila de filtros tiene el mismo número de celdas que el header (alineación de columnas)', () => {
    fixture = makeFixture(FILTER_COLUMNS);

    const headerCellCount = el().querySelectorAll('thead tr:first-child > *').length;
    const filterCellCount = el().querySelectorAll('.sol-data-table__filters-row > *').length;
    expect(filterCellCount).toBe(headerCellCount);
  });

  it('filtro "text" filtra por contención case-insensitive', () => {
    fixture = makeFixture(FILTER_COLUMNS);

    const input = el().querySelector<HTMLInputElement>('.sol-data-table__filter-input')!;
    input.value = 'an';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const rows = el().querySelectorAll('tbody tr.sol-data-table__tr');
    expect(rows.length).toBe(1);
    expect(el().textContent).toContain('Ana');
    expect(el().textContent).not.toContain('Beto');
  });

  it('filtro "select" puebla opciones únicas y ordenadas desde el dataset, y filtra por igualdad exacta', () => {
    fixture = makeFixture(FILTER_COLUMNS);

    const select = el().querySelector<HTMLSelectElement>('.sol-data-table__filter-select')!;
    const optionValues = Array.from(select.options).map((opt) => opt.value);
    expect(optionValues).toEqual(['', 'Activo', 'Inactivo']);

    select.value = 'Activo';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const rows = el().querySelectorAll('tbody tr.sol-data-table__tr');
    expect(rows.length).toBe(1);
    expect(el().textContent).toContain('Ana');
  });

  it('combina (AND) el filtro de columna con la búsqueda global', () => {
    fixture = makeFixture(FILTER_COLUMNS);

    // La búsqueda global encuentra ambas filas por el correo…
    fixture.componentInstance.onSearch('correo.co');
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredData().length).toBe(2);

    // …pero el filtro exacto de estado deja solo la que además lo cumple.
    const select = el().querySelector<HTMLSelectElement>('.sol-data-table__filter-select')!;
    select.value = 'Activo';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.filteredData().length).toBe(1);
    expect(fixture.componentInstance.filteredData()[0]['name']).toBe('Ana');
  });

  it('en el modo colapsado móvil NO se renderiza la fila de filtros', () => {
    MockResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    fixture = makeFixture(FILTER_COLUMNS);
    MockResizeObserver.instances[0].emit(600);
    fixture.detectChanges();

    expect(el().querySelector('.sol-data-table__cards')).not.toBeNull();
    expect(el().querySelector('.sol-data-table__filters-row')).toBeNull();

    vi.unstubAllGlobals();
  });
});

/**
 * Specs del colapso a cards por ancho del CONTENEDOR (0.6.0): reemplaza el
 * criterio anterior por `matchMedia` sobre el viewport — ver
 * `observeContainerWidth` en el componente y el input `collapseWidth`.
 */
describe('SolDataTableComponent — colapso por ancho del contenedor (ResizeObserver)', () => {
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
    MockResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('observa el HOST del componente (no el viewport) al inicializar', () => {
    fixture = makeFixture();

    expect(MockResizeObserver.instances.length).toBe(1);
    expect(MockResizeObserver.instances[0].observed).toEqual([fixture.nativeElement]);
  });

  it('con el ancho del host <= collapseWidth (default 767) colapsa a cards', () => {
    fixture = makeFixture();
    MockResizeObserver.instances[0].emit(600);
    fixture.detectChanges();

    expect(el().querySelector('.sol-data-table__cards')).not.toBeNull();
    expect(el().querySelector('table')).toBeNull();
  });

  it('con el ancho del host > collapseWidth se queda en modo tabla', () => {
    fixture = makeFixture();
    MockResizeObserver.instances[0].emit(1024);
    fixture.detectChanges();

    expect(el().querySelector('table')).not.toBeNull();
    expect(el().querySelector('.sol-data-table__cards')).toBeNull();
  });

  it('collapseWidth es configurable: 900px con collapseWidth=1000 ya colapsa', () => {
    fixture = makeFixture({ collapseWidth: 1000 });
    MockResizeObserver.instances[0].emit(900);
    fixture.detectChanges();

    expect(el().querySelector('.sol-data-table__cards')).not.toBeNull();
  });

  it('desconecta el observer al destruir el componente', () => {
    fixture = makeFixture();
    const observer = MockResizeObserver.instances[0];

    fixture.destroy();

    expect(observer.disconnected).toBe(true);
  });

  it('actionsPosition no cambia el modo colapsado móvil: las acciones siguen solo en el detalle expandido', () => {
    fixture = makeFixture({ actionsPosition: 'start' });
    MockResizeObserver.instances[0].emit(600);
    fixture.detectChanges();

    expect(el().querySelector('.sol-data-table__card-actions')).toBeNull();

    const toggle = el().querySelector<HTMLButtonElement>('[data-testid="fila-colapsada"]');
    toggle?.click();
    fixture.detectChanges();

    expect(el().querySelector('.sol-data-table__card-actions')).not.toBeNull();
  });
});

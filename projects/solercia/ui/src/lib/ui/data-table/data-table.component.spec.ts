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

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolSelectComponent, type SolSelectOption } from './select.component';

const OPTIONS: SolSelectOption[] = [
  { value: '1', label: 'Golden Nails' },
  { value: '2', label: 'Personería Demo' },
  { value: '3', label: 'Estética Ana' },
];

describe('SolSelectComponent — dropdown propio con CVA', () => {
  let fixture: ComponentFixture<SolSelectComponent>;
  let component: SolSelectComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolSelectComponent] });
    fixture = TestBed.createComponent(SolSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function trigger(): HTMLButtonElement {
    return root().querySelector('.sol-select__trigger')!;
  }

  /** El panel se portalea a document.body (CP-2), así que se consulta en document. */
  function dropdown(): HTMLElement | null {
    return document.querySelector('.sol-select__dropdown');
  }

  function optionEls(): HTMLElement[] {
    return Array.from(document.querySelectorAll('.sol-select__option'));
  }

  it('abre y cierra con el trigger; deshabilitado no abre', () => {
    trigger().click();
    fixture.detectChanges();
    expect(dropdown()).not.toBeNull();

    trigger().click();
    fixture.detectChanges();
    expect(dropdown()).toBeNull();

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    component.toggleDropdown();
    fixture.detectChanges();
    expect(dropdown()).toBeNull();
  });

  it('single: elegir una opción emite el valor, cierra y actualiza el display', () => {
    const emitted: unknown[] = [];
    component.registerOnChange(v => emitted.push(v));

    trigger().click();
    fixture.detectChanges();
    optionEls().find(o => o.textContent?.includes('Personería Demo'))!.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['2']);
    expect(dropdown()).toBeNull();
    expect(root().querySelector('.sol-select__display')?.textContent).toContain('Personería Demo');
  });

  it('single + showAllOption: "Todos" limpia la selección emitiendo cadena vacía', () => {
    fixture.componentRef.setInput('showAllOption', true);
    const emitted: unknown[] = [];
    component.registerOnChange(v => emitted.push(v));
    component.writeValue('2');

    trigger().click();
    fixture.detectChanges();
    optionEls()[0].click(); // la opción "Todos" va primero
    fixture.detectChanges();

    expect(emitted).toEqual(['']);
    expect(component.singleValue()).toBe('');
  });

  it('multiple: alterna valores emitiendo arrays y NO cierra el dropdown', () => {
    fixture.componentRef.setInput('multiple', true);
    const emitted: unknown[] = [];
    component.registerOnChange(v => emitted.push(v));

    trigger().click();
    fixture.detectChanges();
    optionEls()[0].click();
    optionEls()[1].click();
    fixture.detectChanges();

    expect(emitted[0]).toEqual(['1']);
    expect((emitted[1] as string[]).sort()).toEqual(['1', '2']);
    expect(dropdown()).not.toBeNull();

    optionEls()[0].click();
    expect(emitted[2]).toEqual(['2']);
  });

  it('multiple: Todos/Ninguno seleccionan y limpian en bloque', () => {
    fixture.componentRef.setInput('multiple', true);
    const emitted: unknown[] = [];
    component.registerOnChange(v => emitted.push(v));

    component.selectAll();
    expect((emitted[0] as string[]).sort()).toEqual(['1', '2', '3']);

    component.selectNone();
    expect(emitted[1]).toEqual([]);
  });

  it('la búsqueda filtra opciones y sin coincidencias muestra "Sin resultados"', () => {
    trigger().click();
    fixture.detectChanges();

    const search = document.querySelector('.sol-select__search') as HTMLInputElement;
    search.value = 'personería';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(optionEls().map(o => o.textContent?.trim())).toEqual(['Personería Demo']);

    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(document.querySelector('.sol-select__empty')?.textContent).toContain('Sin resultados');
  });

  it('Escape en la búsqueda y el clic FUERA cierran el dropdown', () => {
    trigger().click();
    fixture.detectChanges();

    const search = document.querySelector('.sol-select__search') as HTMLInputElement;
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(dropdown()).toBeNull();

    trigger().click();
    fixture.detectChanges();
    expect(dropdown()).not.toBeNull();

    document.body.click();
    fixture.detectChanges();
    expect(dropdown()).toBeNull();
  });

  it('writeValue soporta single (string) y multiple (array) sin re-emitir', () => {
    const emitted: unknown[] = [];
    component.registerOnChange(v => emitted.push(v));

    component.writeValue(2);
    expect(component.singleValue()).toBe('2');

    fixture.componentRef.setInput('multiple', true);
    component.writeValue(['1', '3']);
    expect(Array.from(component.multiValues()).sort()).toEqual(['1', '3']);

    component.writeValue(null);
    expect(component.multiValues().size).toBe(0);
    expect(emitted).toEqual([]);
  });
});

/**
 * Specs del fix de zoom móvil (11-f PR1). El fix vive dentro del `styles`
 * inline del componente; Angular lo inserta como `<style>` real en
 * `document.head` (encapsulación emulada), así que se verifica ahí en vez
 * de mockear `matchMedia` (jsdom no evalúa layout).
 */
describe('SolSelectComponent — fix de zoom móvil (11-f PR1)', () => {
  let fixture: ComponentFixture<SolSelectComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolSelectComponent] });
    fixture = TestBed.createComponent(SolSelectComponent);
    fixture.detectChanges();
  });

  function headStyles(): string {
    return Array.from(document.head.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
  }

  /** Extrae el bloque `@media (max-width: 640px) { ... }` completo (una sola anidación). */
  function mobileMediaBlock(css: string): string {
    const start = css.indexOf('@media (max-width: 640px)');
    expect(start).toBeGreaterThan(-1);
    const openBrace = css.indexOf('{', start);
    let depth = 0;
    let i = openBrace;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      if (css[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    return css.slice(start, i + 1);
  }

  it('enfocar el buscador interno en iOS Safari no dispara zoom: .sol-select__search llega a font-size:16px dentro de @media (max-width:640px)', () => {
    const block = mobileMediaBlock(headStyles());
    expect(block).toContain('.sol-select__search');
    expect(block).toMatch(/font-size:\s*16px/);
  });

  it('el trigger (<button>, sin zoom) también sube a 16px por paridad visual dentro del mismo breakpoint', () => {
    const block = mobileMediaBlock(headStyles());
    expect(block).toContain('.sol-select__trigger');
  });

  it('escritorio sin cambios: fuera del breakpoint móvil el buscador y el trigger conservan --sol-select-font-size', () => {
    const css = headStyles();
    const outsideMedia = css.replace(mobileMediaBlock(css), '');
    expect(outsideMedia).toMatch(
      /\.sol-select__search(\[[^\]]*\])?\s*\{[^}]*font-size:\s*var\(--sol-select-font-size\)/,
    );
    expect(outsideMedia).toMatch(
      /\.sol-select__trigger(\[[^\]]*\])?\s*\{[^}]*font-size:\s*var\(--sol-select-font-size\)/,
    );
  });

  it('modo oscuro conserva sus tokens: el bloque móvil solo cambia font-size, ningún color/token', () => {
    const block = mobileMediaBlock(headStyles());
    expect(block).not.toMatch(/color:/);
    expect(block).not.toMatch(/background/);
    expect(block).not.toMatch(/border/);
  });
});

/**
 * Portal manual del dropdown (CP-2): el panel se adhiere a document.body con
 * position:fixed y coordenadas del trigger, para que ningún ancestro con
 * overflow (ej. .sol-modal-body) lo recorte. Al cerrar o destruir, el nodo y
 * los listeners se limpian sin fugas.
 */
describe('SolSelectComponent — portal del dropdown a document.body (CP-2)', () => {
  let fixture: ComponentFixture<SolSelectComponent>;
  let component: SolSelectComponent;

  const TRIGGER_RECT: DOMRect = {
    x: 40, y: 100, left: 40, top: 100, right: 280, bottom: 140,
    width: 240, height: 40,
    toJSON: () => ({}),
  } as DOMRect;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolSelectComponent] });
    fixture = TestBed.createComponent(SolSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.sol-select__trigger')!;
  }

  function panel(): HTMLElement | null {
    return document.querySelector('.sol-select__dropdown');
  }

  function mockTriggerRect(rect: DOMRect = TRIGGER_RECT): void {
    trigger().getBoundingClientRect = () => rect;
  }

  it('al abrir, el panel queda como hijo directo de document.body con position fixed', () => {
    mockTriggerRect();
    trigger().click();
    fixture.detectChanges();

    const el = panel();
    expect(el).not.toBeNull();
    expect(el!.parentElement).toBe(document.body);
    expect(el!.style.position).toBe('fixed');
    // Anclado bajo el trigger: top = bottom del trigger + 4px de separación
    expect(el!.style.top).toBe('144px');
    expect(el!.style.left).toBe('40px');
  });

  it('el ancho del panel iguala el del trigger', () => {
    mockTriggerRect();
    trigger().click();
    fixture.detectChanges();

    expect(panel()!.style.width).toBe('240px');
  });

  it('al cerrar no queda nodo huérfano en document.body', () => {
    mockTriggerRect();
    trigger().click();
    fixture.detectChanges();
    expect(panel()).not.toBeNull();

    trigger().click();
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(document.body.querySelectorAll('.sol-select__dropdown').length).toBe(0);
  });

  it('al destruir el componente con el panel abierto no queda nodo huérfano ni doble panel', () => {
    mockTriggerRect();
    trigger().click();
    fixture.detectChanges();
    expect(panel()).not.toBeNull();

    fixture.destroy();
    expect(document.body.querySelectorAll('.sol-select__dropdown').length).toBe(0);
  });

  it('seleccionar una opción en el panel portaleado sigue emitiendo el valor por CVA y cierra', () => {
    const emitted: unknown[] = [];
    component.registerOnChange(v => emitted.push(v));

    mockTriggerRect();
    trigger().click();
    fixture.detectChanges();

    const option = Array.from(document.querySelectorAll('.sol-select__option'))
      .find(o => o.textContent?.includes('Golden Nails')) as HTMLElement;
    option.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['1']);
    expect(panel()).toBeNull();
  });

  it('reposiciona en scroll (captura) mientras está abierto', () => {
    mockTriggerRect();
    trigger().click();
    fixture.detectChanges();
    expect(panel()!.style.top).toBe('144px');

    // El trigger "se movió" por un scroll de un ancestro (ej. .sol-modal-body)
    mockTriggerRect({ ...TRIGGER_RECT, top: 60, bottom: 100, toJSON: () => ({}) } as DOMRect);
    window.dispatchEvent(new Event('scroll'));

    expect(panel()!.style.top).toBe('104px');
  });

  it('sin espacio abajo abre hacia arriba (dropUp) anclado por bottom', () => {
    const nearBottom = {
      ...TRIGGER_RECT,
      top: window.innerHeight - 60,
      bottom: window.innerHeight - 20,
      toJSON: () => ({}),
    } as DOMRect;
    mockTriggerRect(nearBottom);
    trigger().click();
    fixture.detectChanges();

    const el = panel()!;
    expect(component.dropUp()).toBe(true);
    expect(el.style.top).toBe('auto');
    expect(el.style.bottom).toBe(`${window.innerHeight - nearBottom.top + 4}px`);
    expect(el.className).toContain('sol-select__dropdown--up');
  });
});

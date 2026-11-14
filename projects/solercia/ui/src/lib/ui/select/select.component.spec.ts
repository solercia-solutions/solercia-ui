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

describe('SolSelectComponent — teclado y accesibilidad', () => {
  let fixture: ComponentFixture<SolSelectComponent>;
  let component: SolSelectComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolSelectComponent] });
    fixture = TestBed.createComponent(SolSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', OPTIONS);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => (fixture.nativeElement as HTMLElement).remove());

  function trigger(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.sol-select__trigger')!;
  }

  function listbox(): HTMLElement | null {
    return document.querySelector('[role="listbox"]');
  }

  function options(): HTMLElement[] {
    return Array.from(document.querySelectorAll('[role="option"]'));
  }

  function press(target: Element, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  async function open(): Promise<void> {
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function activeText(owner: Element): string | undefined {
    const id = owner.getAttribute('aria-activedescendant');
    return id ? document.getElementById(id)?.textContent?.trim() : undefined;
  }

  it('el trigger anuncia el listbox; las opciones llevan role y aria-selected', async () => {
    component.writeValue('2');
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');

    await open();
    expect(trigger().getAttribute('aria-controls')).toBe(listbox()?.id);
    expect(options().map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('sin buscador: el foco va a la lista y las teclas mueven la opción activa, sin salirse', async () => {
    fixture.componentRef.setInput('searchable', false);
    component.writeValue('2');
    await open();

    const list = listbox()!;
    expect(document.activeElement).toBe(list);
    expect(activeText(list)).toBe('Personería Demo');

    press(list, 'ArrowDown');
    expect(activeText(list)).toBe('Estética Ana');
    press(list, 'ArrowDown');
    expect(activeText(list)).toBe('Estética Ana');
    press(list, 'Home');
    expect(activeText(list)).toBe('Golden Nails');
    press(list, 'ArrowUp');
    expect(activeText(list)).toBe('Golden Nails');
    press(list, 'End');
    expect(activeText(list)).toBe('Estética Ana');
  });

  it('Enter elige la activa, emite y devuelve el foco al trigger', async () => {
    fixture.componentRef.setInput('searchable', false);
    const emitted: string[] = [];
    component.valueChange.subscribe(value => emitted.push(value));
    await open();

    press(listbox()!, 'ArrowDown');
    press(listbox()!, 'Enter');

    expect(emitted).toEqual(['2']);
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('con buscador: el foco queda en el campo, filtra sin tildes y Enter elige la primera coincidencia', async () => {
    const emitted: unknown[] = [];
    component.registerOnChange(value => emitted.push(value));
    await open();

    const search = document.querySelector('.sol-select__search') as HTMLInputElement;
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute('role')).toBe('combobox');

    search.value = 'estetica';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(activeText(search)).toBe('Estética Ana');

    press(search, 'Enter');
    expect(emitted).toEqual(['3']);
    expect(document.activeElement).toBe(trigger());
  });

  it('con texto en el buscador, Inicio y Fin mueven el cursor y no la opción; sin texto, la opción', async () => {
    await open();
    const search = document.querySelector('.sol-select__search') as HTMLInputElement;

    press(search, 'End');
    expect(activeText(search)).toBe('Estética Ana');

    search.value = 'e';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const before = activeText(search);
    expect(press(search, 'End').defaultPrevented).toBe(false);
    expect(activeText(search)).toBe(before);
  });

  it('Esc cierra, devuelve el foco y no llega a un drawer o modal que lo contenga', async () => {
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    await open();

    press(document.querySelector('.sol-select__search')!, 'Escape');

    document.removeEventListener('keydown', outer);
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(outer).not.toHaveBeenCalled();
  });

  it('las flechas abren desde el trigger cerrado', () => {
    press(trigger(), 'ArrowDown');
    expect(listbox()).not.toBeNull();
  });

  it('Tab cierra y sigue desde el trigger', async () => {
    fixture.componentRef.setInput('searchable', false);
    await open();
    const event = press(listbox()!, 'Tab');
    expect(listbox()).toBeNull();
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });

  it('sin opciones, las teclas no fallan', async () => {
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('searchable', false);
    const emitted: string[] = [];
    component.valueChange.subscribe(value => emitted.push(value));
    await open();
    press(listbox()!, 'ArrowDown');
    press(listbox()!, 'Enter');
    expect(emitted).toEqual([]);
  });

  it('los textos del buscador y el nombre del trigger se pueden cambiar; por defecto siguen igual', async () => {
    expect(trigger().getAttribute('aria-label')).toBeNull();
    await open();
    expect((document.querySelector('.sol-select__search') as HTMLInputElement).placeholder).toBe('Buscar...');
    component.closeDropdown();
    fixture.detectChanges();

    fixture.componentRef.setInput('ariaLabel', 'Ciudad');
    fixture.componentRef.setInput('searchPlaceholder', 'Busca una ciudad');
    fixture.componentRef.setInput('emptyLabel', 'No encontramos esa ciudad');
    fixture.componentRef.setInput('options', []);
    component.writeValue('');
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-label')).toBe('Ciudad');

    await open();
    expect((document.querySelector('.sol-select__search') as HTMLInputElement).placeholder).toBe('Busca una ciudad');
    expect(document.querySelector('.sol-select__empty')?.textContent).toContain('No encontramos esa ciudad');
  });

  it('`label` nombra al trigger', () => {
    fixture.componentRef.setInput('label', 'Empresa');
    fixture.detectChanges();
    const label = (fixture.nativeElement as HTMLElement).querySelector('label');
    expect(label?.getAttribute('for')).toBe(trigger().id);
  });

  describe('dentro de un <label>', () => {
    it('el clic en el texto, reenviado al trigger, no vuelve a abrir el panel abierto', async () => {
      const label = document.createElement('label');
      const text = document.createElement('span');
      label.append(text, fixture.nativeElement);
      document.body.appendChild(label);

      text.click();
      fixture.detectChanges();
      expect(component.isOpen()).toBe(true);
      text.click();
      fixture.detectChanges();
      expect(component.isOpen()).toBe(false);
      label.remove();
    });
  });
});

describe('SolSelectComponent — controlado con [value]', () => {
  let fixture: ComponentFixture<SolSelectComponent>;
  let component: SolSelectComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolSelectComponent] });
    fixture = TestBed.createComponent(SolSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', [{ value: '', label: 'Cualquier lugar' }, ...OPTIONS]);
  });

  function display(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.sol-select__display')!;
  }

  it('pinta el valor en la primera detección, sin esperar a un formulario', () => {
    fixture.componentRef.setInput('value', '2');
    fixture.detectChanges();
    expect(display().textContent).toContain('Personería Demo');
  });

  it('una opción con valor vacío se muestra por su nombre y no como marcador', () => {
    fixture.componentRef.setInput('value', '');
    fixture.detectChanges();
    expect(display().textContent).toContain('Cualquier lugar');
    expect(display().classList).not.toContain('sol-select__display--placeholder');
  });

  it('sin opción vacía, el valor vacío sigue mostrando el marcador', () => {
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('value', '');
    fixture.componentRef.setInput('placeholder', 'Elige');
    fixture.detectChanges();
    expect(display().textContent).toContain('Elige');
  });

  it('elegir solo emite: lo que se muestra lo decide el dueño', () => {
    fixture.componentRef.setInput('value', '1');
    fixture.detectChanges();
    const emitted: string[] = [];
    component.valueChange.subscribe(value => emitted.push(value));

    component.onSelectSingle('2');
    fixture.detectChanges();
    expect(emitted).toEqual(['2']);
    expect(display().textContent).toContain('Golden Nails');

    fixture.componentRef.setInput('value', '2');
    fixture.detectChanges();
    expect(display().textContent).toContain('Personería Demo');
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
 * `mobileBreakpoint` (0.6.0): el host cuyo layout móvil corta por encima de
 * 640px (PANDORA, 768px) extiende la protección anti-zoom sin ::ng-deep.
 */
describe('SolSelectComponent — mobileBreakpoint configurable', () => {
  const originalWidth = window.innerWidth;

  function setViewport(width: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    window.dispatchEvent(new Event('resize'));
  }

  afterEach(() => {
    setViewport(originalWidth);
    document.querySelectorAll('.sol-select__dropdown').forEach(el => el.remove());
  });

  function create(breakpoint?: number): ComponentFixture<SolSelectComponent> {
    TestBed.configureTestingModule({ imports: [SolSelectComponent] });
    const fixture = TestBed.createComponent(SolSelectComponent);
    fixture.componentRef.setInput('options', [{ value: '1', label: 'Uno' }]);
    if (breakpoint !== undefined) fixture.componentRef.setInput('mobileBreakpoint', breakpoint);
    fixture.detectChanges();
    return fixture;
  }

  it('por defecto (640) un viewport de 700px no activa la clase táctil', () => {
    setViewport(700);
    const fixture = create();
    expect((fixture.nativeElement as HTMLElement).classList.contains('sol-select--touch')).toBe(false);
  });

  it('con mobileBreakpoint=768 un viewport de 700px activa la clase en el host y en el panel', () => {
    setViewport(700);
    const fixture = create(768);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('sol-select--touch')).toBe(true);

    host.querySelector<HTMLButtonElement>('.sol-select__trigger')!.click();
    fixture.detectChanges();
    expect(document.querySelector('.sol-select__dropdown')?.classList.contains('sol-select__dropdown--touch')).toBe(true);
  });

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  it('en celular la lista abre como hoja inferior sin enfocar el buscador (el teclado no la tapa)', async () => {
    setViewport(390);
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.sol-select__trigger')!.click();
    fixture.detectChanges();
    await wait(80);

    const panel = document.querySelector<HTMLElement>('.sol-select__dropdown')!;
    expect(panel.classList.contains('sol-select__dropdown--touch')).toBe(true);
    expect(document.activeElement).not.toBe(panel.querySelector('.sol-select__search'));
    // El foco queda en la lista, con la opción activa anunciada: las flechas siguen funcionando.
    const listbox = panel.querySelector<HTMLElement>('.sol-select__options')!;
    expect(document.activeElement).toBe(listbox);
    expect(listbox.getAttribute('aria-activedescendant')).toBeTruthy();
  });

  it('en escritorio el buscador sigue tomando el foco al abrir', async () => {
    setViewport(1280);
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.sol-select__trigger')!.click();
    fixture.detectChanges();
    await wait(80);

    const panel = document.querySelector<HTMLElement>('.sol-select__dropdown')!;
    expect(panel.classList.contains('sol-select__dropdown--touch')).toBe(false);
    expect(document.activeElement).toBe(panel.querySelector('.sol-select__search'));
  });

  it('reacciona al resize: al ensanchar por encima del corte se retira la clase', () => {
    setViewport(700);
    const fixture = create(768);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('sol-select--touch')).toBe(true);

    setViewport(1200);
    fixture.detectChanges();
    expect(host.classList.contains('sol-select--touch')).toBe(false);
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

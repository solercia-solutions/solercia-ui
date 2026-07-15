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

  function optionEls(): HTMLElement[] {
    return Array.from(root().querySelectorAll('.sol-select__option'));
  }

  it('abre y cierra con el trigger; deshabilitado no abre', () => {
    trigger().click();
    fixture.detectChanges();
    expect(root().querySelector('.sol-select__dropdown')).not.toBeNull();

    trigger().click();
    fixture.detectChanges();
    expect(root().querySelector('.sol-select__dropdown')).toBeNull();

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    component.toggleDropdown();
    fixture.detectChanges();
    expect(root().querySelector('.sol-select__dropdown')).toBeNull();
  });

  it('single: elegir una opción emite el valor, cierra y actualiza el display', () => {
    const emitted: unknown[] = [];
    component.registerOnChange(v => emitted.push(v));

    trigger().click();
    fixture.detectChanges();
    optionEls().find(o => o.textContent?.includes('Personería Demo'))!.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['2']);
    expect(root().querySelector('.sol-select__dropdown')).toBeNull();
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
    expect(root().querySelector('.sol-select__dropdown')).not.toBeNull();

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

    const search = root().querySelector('.sol-select__search') as HTMLInputElement;
    search.value = 'personería';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(optionEls().map(o => o.textContent?.trim())).toEqual(['Personería Demo']);

    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root().querySelector('.sol-select__empty')?.textContent).toContain('Sin resultados');
  });

  it('Escape en la búsqueda y el clic FUERA cierran el dropdown', () => {
    trigger().click();
    fixture.detectChanges();

    const search = root().querySelector('.sol-select__search') as HTMLInputElement;
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root().querySelector('.sol-select__dropdown')).toBeNull();

    trigger().click();
    fixture.detectChanges();
    expect(root().querySelector('.sol-select__dropdown')).not.toBeNull();

    document.body.click();
    fixture.detectChanges();
    expect(root().querySelector('.sol-select__dropdown')).toBeNull();
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

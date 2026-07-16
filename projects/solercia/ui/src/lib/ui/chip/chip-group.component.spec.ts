import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolChipGroupComponent, type SolChipOption } from './chip-group.component';
import { SolChipComponent } from './chip.component';

/**
 * Specs de `sol-chip-group` (11-f PR2). Cubre: la Strategy de selección
 * (single→radiogroup/radio, multiple→group/checkbox) elegida por
 * `multiple()`, CVA (`writeValue`/`registerOnChange` con `string`|`string[]`),
 * `allowDeselect`, deshabilitado, y navegación por teclado con roving
 * tabindex (flechas mueven foco, Home/End saltan a los extremos, los chips
 * deshabilitados se saltan).
 */
const OPTIONS: SolChipOption[] = [
  { value: 'a', label: 'Opción A' },
  { value: 'b', label: 'Opción B' },
  { value: 'c', label: 'Opción C', disabled: true },
  { value: 'd', label: 'Opción D' },
];

describe('SolChipGroupComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOL_I18N,
          useValue: {
            activeLang: signal('es-CO'),
            translate: (key: string) => `t(${key})`,
          },
        },
      ],
    });
  });

  function create(inputs: Partial<{
    options: SolChipOption[];
    multiple: boolean;
    allowDeselect: boolean;
    disabled: boolean;
    removable: boolean;
    ariaLabelKey: string;
  }> = {}): ComponentFixture<SolChipGroupComponent> {
    const fixture = TestBed.createComponent(SolChipGroupComponent);
    fixture.componentRef.setInput('options', inputs.options ?? OPTIONS);
    fixture.componentRef.setInput('ariaLabelKey', inputs.ariaLabelKey ?? 'test.chipGroup.aria');
    if (inputs.multiple !== undefined) fixture.componentRef.setInput('multiple', inputs.multiple);
    if (inputs.allowDeselect !== undefined) fixture.componentRef.setInput('allowDeselect', inputs.allowDeselect);
    if (inputs.disabled !== undefined) fixture.componentRef.setInput('disabled', inputs.disabled);
    if (inputs.removable !== undefined) fixture.componentRef.setInput('removable', inputs.removable);
    fixture.detectChanges();
    return fixture;
  }

  function root(fixture: ComponentFixture<SolChipGroupComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function groupEl(fixture: ComponentFixture<SolChipGroupComponent>): HTMLElement {
    return root(fixture).querySelector('.sol-chip-group')!;
  }

  function chips(fixture: ComponentFixture<SolChipGroupComponent>): HTMLElement[] {
    return Array.from(root(fixture).querySelectorAll<HTMLElement>('.sol-chip'));
  }

  it('single (default): contenedor role="radiogroup", chips role="radio", aria-label traducido', () => {
    const fixture = create();
    expect(groupEl(fixture).getAttribute('role')).toBe('radiogroup');
    expect(groupEl(fixture).getAttribute('aria-label')).toBe('t(test.chipGroup.aria)');
    chips(fixture).forEach(chip => expect(chip.getAttribute('role')).toBe('radio'));
  });

  it('multiple: contenedor role="group", chips role="checkbox"', () => {
    const fixture = create({ multiple: true });
    expect(groupEl(fixture).getAttribute('role')).toBe('group');
    chips(fixture).forEach(chip => expect(chip.getAttribute('role')).toBe('checkbox'));
  });

  it('single: seleccionar un chip deselecciona el anterior y emite el value vía CVA', () => {
    const fixture = create();
    const emitted: unknown[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    chips(fixture)[0].click();
    fixture.detectChanges();
    expect(emitted).toEqual(['a']);
    expect(chips(fixture)[0].getAttribute('aria-checked')).toBe('true');

    chips(fixture)[1].click();
    fixture.detectChanges();
    expect(emitted).toEqual(['a', 'b']);
    expect(chips(fixture)[0].getAttribute('aria-checked')).toBe('false');
    expect(chips(fixture)[1].getAttribute('aria-checked')).toBe('true');
  });

  it('single + allowDeselect=true (default): reactivar el chip seleccionado limpia la selección (emite "")', () => {
    const fixture = create();
    const emitted: unknown[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    chips(fixture)[0].click();
    chips(fixture)[0].click();

    expect(emitted).toEqual(['a', '']);
  });

  it('single + allowDeselect=false: reactivar el chip seleccionado NO cambia la selección NI reemite (idempotencia CVA)', () => {
    const fixture = create({ allowDeselect: false });
    const emitted: unknown[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    chips(fixture)[0].click();
    chips(fixture)[0].click();

    // La segunda activación no cambia el conjunto seleccionado resultante
    // ('a' de nuevo), así que el CVA NO debe reemitir el mismo valor.
    expect(emitted).toEqual(['a']);
  });

  it('multiple: alternar valores acumula/quita del array emitido vía CVA', () => {
    const fixture = create({ multiple: true });
    const emitted: unknown[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    chips(fixture)[0].click();
    chips(fixture)[1].click();
    fixture.detectChanges();
    expect((emitted[1] as string[]).sort()).toEqual(['a', 'b']);

    chips(fixture)[0].click();
    expect(emitted[2]).toEqual(['b']);
  });

  it('un chip disabled por opción no se activa aunque el grupo esté habilitado', () => {
    const fixture = create();
    const emitted: unknown[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    chips(fixture)[2].click(); // 'c' está disabled en OPTIONS
    expect(emitted).toEqual([]);
  });

  it('grupo disabled: aria-disabled en el contenedor y ningún chip se activa', () => {
    const fixture = create({ disabled: true });
    const emitted: unknown[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    expect(groupEl(fixture).getAttribute('aria-disabled')).toBe('true');
    chips(fixture)[0].click();
    expect(emitted).toEqual([]);
  });

  it('writeValue: single acepta string, multiple acepta string[]', () => {
    const single = create();
    single.componentInstance.writeValue('b');
    single.detectChanges();
    expect(chips(single)[1].getAttribute('aria-checked')).toBe('true');

    const multi = create({ multiple: true });
    multi.componentInstance.writeValue(['a', 'd']);
    multi.detectChanges();
    expect(chips(multi)[0].getAttribute('aria-checked')).toBe('true');
    expect(chips(multi)[3].getAttribute('aria-checked')).toBe('true');
    expect(chips(multi)[1].getAttribute('aria-checked')).toBe('false');
  });

  it('removable: quitar un chip lo deselecciona y emite el nuevo valor, saltando allowDeselect', () => {
    const fixture = create({ removable: true, allowDeselect: false });
    fixture.componentInstance.writeValue('a');
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    const removeBtn = root(fixture).querySelectorAll<HTMLButtonElement>('.sol-chip__remove')[0];
    removeBtn.click();

    expect(emitted).toEqual(['']);
  });

  it('teclado: ArrowRight/ArrowLeft mueven el roving tabindex, saltando el chip disabled', () => {
    const fixture = create();
    const items = chips(fixture);
    // Foco inicial: índice 0 es el único tab-stop (roving tabindex).
    expect(items[0].getAttribute('tabindex')).toBe('0');
    expect(items[1].getAttribute('tabindex')).toBe('-1');

    items[0].focus();
    groupEl(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(chips(fixture)[1].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(chips(fixture)[1]);

    // Desde 'b' (índice 1), ArrowRight debe saltar 'c' (disabled) e ir a 'd' (índice 3).
    groupEl(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(chips(fixture)[3].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(chips(fixture)[3]);
  });

  it('teclado: Home/End saltan al primer/último chip habilitado', () => {
    const fixture = create();
    groupEl(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(chips(fixture)[3].getAttribute('tabindex')).toBe('0');

    groupEl(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(chips(fixture)[0].getAttribute('tabindex')).toBe('0');
  });

  it('las flechas mueven el foco pero NO seleccionan por sí solas (activación explícita requerida)', () => {
    const fixture = create();
    const emitted: unknown[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    groupEl(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(emitted).toEqual([]);
  });

  it('CRÍTICO: si la PRIMERA opción está disabled, el roving tabindex recae en el primer chip habilitado (el grupo sigue siendo alcanzable por Tab)', () => {
    const optionsWithFirstDisabled: SolChipOption[] = [
      { value: 'x', label: 'X', disabled: true },
      { value: 'y', label: 'Y' },
      { value: 'z', label: 'Z' },
    ];
    const fixture = create({ options: optionsWithFirstDisabled });
    const items = chips(fixture);

    // El chip disabled nunca debe quedar como tab-stop del grupo.
    expect(items[0].getAttribute('tabindex')).toBe('-1');
    // El primer chip habilitado ('y') queda como el único tab-stop.
    expect(items[1].getAttribute('tabindex')).toBe('0');
    expect(items[2].getAttribute('tabindex')).toBe('-1');

    // Exactamente un chip con tabindex 0 — el grupo es alcanzable por Tab.
    const tabbable = items.filter(chip => chip.getAttribute('tabindex') === '0');
    expect(tabbable.length).toBe(1);
  });

  it('el grupo enfoca cada chip vía su método público `focus()` (viewChildren), no un querySelector acoplado a la clase CSS interna', () => {
    const focusSpy = vi.spyOn(SolChipComponent.prototype, 'focus');
    const fixture = create();

    chips(fixture)[0].focus();
    groupEl(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });
});

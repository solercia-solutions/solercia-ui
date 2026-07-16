import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolChipComponent } from './chip.component';

/**
 * Specs de `sol-chip` standalone (11-f PR2). Cubre: rol/estado ARIA por
 * defecto (`role="button"` + `aria-pressed`), rol inyectado por un grupo
 * (`radio`/`checkbox` + `aria-checked`), activación por click/Enter/Espacio,
 * deshabilitado, emoji `aria-hidden`, y el botón "quitar" (`removable`).
 */
describe('SolChipComponent', () => {
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
    value: string;
    label: string;
    emoji: string;
    count: number | null;
    selected: boolean;
    disabled: boolean;
    size: 'sm' | 'md';
    removable: boolean;
    role: 'button' | 'radio' | 'checkbox';
    tabIndex: number;
  }> = {}): ComponentFixture<SolChipComponent> {
    const fixture = TestBed.createComponent(SolChipComponent);
    fixture.componentRef.setInput('value', inputs.value ?? 'golden-nails');
    fixture.componentRef.setInput('label', inputs.label ?? 'Golden Nails');
    if (inputs.emoji !== undefined) fixture.componentRef.setInput('emoji', inputs.emoji);
    if (inputs.count !== undefined) fixture.componentRef.setInput('count', inputs.count);
    if (inputs.selected !== undefined) fixture.componentRef.setInput('selected', inputs.selected);
    if (inputs.disabled !== undefined) fixture.componentRef.setInput('disabled', inputs.disabled);
    if (inputs.size) fixture.componentRef.setInput('size', inputs.size);
    if (inputs.removable !== undefined) fixture.componentRef.setInput('removable', inputs.removable);
    if (inputs.role) fixture.componentRef.setInput('role', inputs.role);
    if (inputs.tabIndex !== undefined) fixture.componentRef.setInput('tabIndex', inputs.tabIndex);
    fixture.detectChanges();
    return fixture;
  }

  function chipEl(fixture: ComponentFixture<SolChipComponent>): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.sol-chip')!;
  }

  it('standalone: role="button" + aria-pressed refleja `selected`', () => {
    const fixture = create({ selected: false });
    const el = chipEl(fixture);
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('aria-pressed')).toBe('false');
    expect(el.getAttribute('aria-checked')).toBeNull();

    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();
    expect(el.getAttribute('aria-pressed')).toBe('true');
  });

  it('rol inyectado por el grupo (radio/checkbox) usa aria-checked, no aria-pressed', () => {
    const fixture = create({ role: 'radio', selected: true });
    const el = chipEl(fixture);
    expect(el.getAttribute('role')).toBe('radio');
    expect(el.getAttribute('aria-checked')).toBe('true');
    expect(el.getAttribute('aria-pressed')).toBeNull();
  });

  it('click emite `toggled` con el value', () => {
    const fixture = create();
    const emitted: string[] = [];
    fixture.componentInstance.toggled.subscribe(v => emitted.push(v));

    chipEl(fixture).click();

    expect(emitted).toEqual(['golden-nails']);
  });

  it('Enter y Espacio activan el chip (una sola vez cada uno, sin doble emisión)', () => {
    const fixture = create();
    const emitted: string[] = [];
    fixture.componentInstance.toggled.subscribe(v => emitted.push(v));
    const el = chipEl(fixture);

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(emitted).toEqual(['golden-nails', 'golden-nails']);
  });

  it('otra tecla (ej. Tab) no activa el chip', () => {
    const fixture = create();
    const emitted: string[] = [];
    fixture.componentInstance.toggled.subscribe(v => emitted.push(v));

    chipEl(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(emitted).toEqual([]);
  });

  it('deshabilitado: no emite toggled por click/teclado, aria-disabled y tabindex -1', () => {
    const fixture = create({ disabled: true });
    const emitted: string[] = [];
    fixture.componentInstance.toggled.subscribe(v => emitted.push(v));
    const el = chipEl(fixture);

    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.getAttribute('tabindex')).toBe('-1');

    el.click();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(emitted).toEqual([]);
  });

  it('el emoji se renderiza aria-hidden (el nombre accesible viene de label)', () => {
    const fixture = create({ emoji: '💅' });
    const emojiEl = (fixture.nativeElement as HTMLElement).querySelector('.sol-chip__emoji')!;
    expect(emojiEl.getAttribute('aria-hidden')).toBe('true');
    expect(emojiEl.textContent).toContain('💅');
  });

  it('removable: renderiza un botón "quitar" independiente que emite `removed`, no `toggled`', () => {
    const fixture = create({ removable: true });
    const toggled: string[] = [];
    const removed: string[] = [];
    fixture.componentInstance.toggled.subscribe(v => toggled.push(v));
    fixture.componentInstance.removed.subscribe(v => removed.push(v));

    const removeBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.sol-chip__remove',
    )!;
    expect(removeBtn.tagName).toBe('BUTTON');
    expect(removeBtn.getAttribute('aria-label')).toBe('t(shared.chip.remove)');

    removeBtn.click();

    expect(removed).toEqual(['golden-nails']);
    expect(toggled).toEqual([]);
  });

  it('sin removable no renderiza el botón "quitar"', () => {
    const fixture = create({ removable: false });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.sol-chip__remove'),
    ).toBeNull();
  });

  it('size="sm" agrega la clase de tamaño compacto', () => {
    const fixture = create({ size: 'sm' });
    expect(chipEl(fixture).classList).toContain('sol-chip--sm');
  });
});

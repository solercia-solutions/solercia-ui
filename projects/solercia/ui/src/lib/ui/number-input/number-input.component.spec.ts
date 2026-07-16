import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolNumberInputComponent } from './number-input.component';

/**
 * Specs de `sol-number-input` (11-f PR2). Cubre: bounds min/max/step con
 * deshabilitado en el límite, edición directa del campo (válida/incorrecta),
 * teclado (flechas + Home/End), CVA (`writeValue`/`registerOnChange`), ARIA
 * (`role="spinbutton"` + `aria-valuemin/max/now`), y el criterio de zoom
 * móvil (`font-size:16px` en `@media (max-width:640px)`, patrón PR1).
 */
describe('SolNumberInputComponent', () => {
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
    min: number;
    max: number;
    step: number;
    disabled: boolean;
    ariaLabelKey: string;
  }> = {}): ComponentFixture<SolNumberInputComponent> {
    const fixture = TestBed.createComponent(SolNumberInputComponent);
    fixture.componentRef.setInput('ariaLabelKey', inputs.ariaLabelKey ?? 'test.numberInput.aria');
    if (inputs.min !== undefined) fixture.componentRef.setInput('min', inputs.min);
    if (inputs.max !== undefined) fixture.componentRef.setInput('max', inputs.max);
    if (inputs.step !== undefined) fixture.componentRef.setInput('step', inputs.step);
    if (inputs.disabled !== undefined) fixture.componentRef.setInput('disabled', inputs.disabled);
    fixture.detectChanges();
    return fixture;
  }

  function root(fixture: ComponentFixture<SolNumberInputComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function field(fixture: ComponentFixture<SolNumberInputComponent>): HTMLInputElement {
    return root(fixture).querySelector('.sol-number-input__field')!;
  }

  function decBtn(fixture: ComponentFixture<SolNumberInputComponent>): HTMLButtonElement {
    return root(fixture).querySelector('.sol-number-input__btn--decrement')!;
  }

  function incBtn(fixture: ComponentFixture<SolNumberInputComponent>): HTMLButtonElement {
    return root(fixture).querySelector('.sol-number-input__btn--increment')!;
  }

  it('ARIA: role="spinbutton" con aria-label, aria-valuemin/max/now', () => {
    const fixture = create({ min: 0, max: 5 });
    const el = field(fixture);
    expect(el.getAttribute('role')).toBe('spinbutton');
    expect(el.getAttribute('aria-label')).toBe('t(test.numberInput.aria)');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.getAttribute('aria-valuemax')).toBe('5');
    expect(el.getAttribute('aria-valuenow')).toBe('0');
  });

  it('incrementar/decrementar respeta step y emite el valor vía CVA', () => {
    const fixture = create({ min: 0, max: 10, step: 2 });
    fixture.componentInstance.writeValue(4);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    incBtn(fixture).click();
    fixture.detectChanges();
    expect(field(fixture).value).toBe('6');
    expect(emitted).toEqual([6]);

    decBtn(fixture).click();
    decBtn(fixture).click();
    expect(emitted).toEqual([6, 4, 2]);
  });

  it('bounds: en min el botón "−" se deshabilita y no decrementa más allá', () => {
    const fixture = create({ min: 0, max: 10 });
    const emitted: number[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    expect(decBtn(fixture).disabled).toBe(true);
    decBtn(fixture).click();
    expect(emitted).toEqual([]);
    expect(field(fixture).value).toBe('0');
  });

  it('bounds: en max el botón "+" se deshabilita y no incrementa más allá', () => {
    const fixture = create({ min: 0, max: 3 });
    fixture.componentInstance.writeValue(3);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    expect(incBtn(fixture).disabled).toBe(true);
    incBtn(fixture).click();
    expect(emitted).toEqual([]);
  });

  it('escribir un valor válido directamente en el campo lo clampa y emite', () => {
    const fixture = create({ min: 0, max: 10 });
    const emitted: number[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    const el = field(fixture);
    el.value = '999';
    el.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted).toEqual([10]); // clamped a max
    expect(el.value).toBe('10');
  });

  it('un valor no numérico revierte al último valor válido sin emitir', () => {
    const fixture = create({ min: 0, max: 10 });
    fixture.componentInstance.writeValue(5);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    const el = field(fixture);
    el.value = 'abc';
    el.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(el.value).toBe('5');
  });

  it('teclado: ArrowUp/ArrowDown incrementan/decrementan un step; Home/End saltan a min/max', () => {
    const fixture = create({ min: 0, max: 10, step: 1 });
    fixture.componentInstance.writeValue(5);
    fixture.detectChanges();
    const el = field(fixture);

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    fixture.detectChanges();
    expect(field(fixture).value).toBe('6');

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect(field(fixture).value).toBe('4');

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    fixture.detectChanges();
    expect(field(fixture).value).toBe('10');

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    fixture.detectChanges();
    expect(field(fixture).value).toBe('0');
  });

  it('deshabilitado: botones y campo deshabilitados, sin emitir por click ni teclado', () => {
    const fixture = create({ disabled: true });
    const emitted: number[] = [];
    fixture.componentInstance.registerOnChange(v => emitted.push(v));

    expect(decBtn(fixture).disabled).toBe(true);
    expect(incBtn(fixture).disabled).toBe(true);
    expect(field(fixture).disabled).toBe(true);
    expect(field(fixture).getAttribute('aria-disabled')).toBe('true');

    field(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(emitted).toEqual([]);
  });

  it('CVA: writeValue clampa fuera de rango y null/NaN caen a 0 (clampado)', () => {
    const fixture = create({ min: 2, max: 8 });
    fixture.componentInstance.writeValue(999);
    expect(fixture.componentInstance.value()).toBe(8);

    fixture.componentInstance.writeValue(-50);
    expect(fixture.componentInstance.value()).toBe(2);

    fixture.componentInstance.writeValue(null);
    expect(fixture.componentInstance.value()).toBe(2); // clamp(0) con min=2
  });

  /**
   * Igual que el fix de zoom móvil de PR1: el `styles` inline se inserta
   * como `<style>` real en `document.head` (encapsulación emulada), así que
   * se verifica ahí en vez de mockear `matchMedia`.
   */
  describe('fix de zoom móvil (11-f PR1, aplicado aquí en PR2)', () => {
    function headStyles(): string {
      return Array.from(document.head.querySelectorAll('style'))
        .map(s => s.textContent ?? '')
        .join('\n');
    }

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

    it('el campo central llega a font-size:16px dentro de @media (max-width:640px)', () => {
      create();
      const block = mobileMediaBlock(headStyles());
      expect(block).toContain('.sol-number-input__field');
      expect(block).toMatch(/font-size:\s*16px/);
    });

    it('escritorio sin cambios: fuera del breakpoint conserva --sol-number-input-font-size', () => {
      create();
      const css = headStyles();
      const outsideMedia = css.replace(mobileMediaBlock(css), '');
      expect(outsideMedia).toMatch(
        /\.sol-number-input__field(\[[^\]]*\])?\s*\{[^}]*font-size:\s*var\(--sol-number-input-font-size\)/,
      );
    });
  });
});

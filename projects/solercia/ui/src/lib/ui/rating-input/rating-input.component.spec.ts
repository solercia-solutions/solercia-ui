import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolRatingInputComponent, normalizeRating } from './rating-input.component';

/**
 * Specs de `sol-rating-input`. Cubren: arranque SIN valor (la decisión
 * deliberada contra el sesgo de anclaje), selección con ratón y con teclado,
 * el valor emitido, `aria-checked`, roving tabindex, deshabilitado, solo
 * lectura, error, limpiar, la vista previa que no toca el valor, y la
 * integración real con `ReactiveFormsModule`.
 *
 * El stub de i18n es `createCatalogCheckedI18nStub`: VERIFICA cada clave contra
 * `boki-front/src/assets/i18n/es-CO.json` y lanza si falta, así que una clave
 * olvidada en el catálogo real rompe estos tests en vez de llegar cruda a
 * producción. Ese stub NO interpola `{{...}}` (eso lo hace el motor real, p. ej.
 * Transloco) — el bloque final, con un stub identidad, es el que comprueba los
 * textos es-CO de la casa ya interpolados («3 de 5»).
 */

function stars(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('.sol-rating-input__star'));
}

function group(root: HTMLElement): HTMLElement {
  return root.querySelector<HTMLElement>('.sol-rating-input__group')!;
}

function checkedFlags(root: HTMLElement): string[] {
  return stars(root).map((s) => s.getAttribute('aria-checked')!);
}

function filledCount(root: HTMLElement): number {
  return stars(root).filter((s) => s.classList.contains('sol-rating-input__star--on')).length;
}

function pressKey(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('normalizeRating (pura)', () => {
  it('deja pasar la escala válida 1..5', () => {
    expect([1, 2, 3, 4, 5].map(normalizeRating)).toEqual([1, 2, 3, 4, 5]);
  });

  it('null/undefined/NaN son "sin responder", nunca 0 estrellas', () => {
    expect(normalizeRating(null)).toBeNull();
    expect(normalizeRating(undefined)).toBeNull();
    expect(normalizeRating(NaN)).toBeNull();
  });

  it('[WARNING] 0 y los negativos son "sin responder", NO una calificación mínima', () => {
    expect(normalizeRating(0)).toBeNull();
    expect(normalizeRating(-3)).toBeNull();
  });

  it('recorta por arriba y redondea decimales a la estrella más cercana', () => {
    expect(normalizeRating(9)).toBe(5);
    expect(normalizeRating(3.4)).toBe(3);
    expect(normalizeRating(3.6)).toBe(4);
  });
});

describe('SolRatingInputComponent', () => {
  let fixture: ComponentFixture<SolRatingInputComponent>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolRatingInputComponent],
      providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
    });
    fixture = TestBed.createComponent(SolRatingInputComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  // ── Arranque sin valor ────────────────────────────────────────────────

  it('[spec] arranca SIN valor: value=null y ninguna estrella marcada ni pintada', () => {
    expect(fixture.componentInstance.value()).toBeNull();
    expect(checkedFlags(root)).toEqual(['false', 'false', 'false', 'false', 'false']);
    expect(filledCount(root)).toBe(0);
  });

  it('[spec] arranca sin emitir nada: un radiogroup vacío es válido y no sesga la respuesta', () => {
    const emitted: (number | null)[] = [];
    fixture.componentInstance.ratingChanged.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
    expect(emitted).toEqual([]);
  });

  // ── Accesibilidad estructural ─────────────────────────────────────────

  it('el contenedor es role="radiogroup" y cada estrella role="radio"', () => {
    expect(group(root).getAttribute('role')).toBe('radiogroup');
    expect(stars(root)).toHaveLength(5);
    expect(stars(root).every((s) => s.getAttribute('role') === 'radio')).toBe(true);
  });

  it('el grupo trae el nombre accesible por i18n (clave verificada contra es-CO.json)', () => {
    expect(group(root).getAttribute('aria-label')).toBe('Calificación de 1 a 5 estrellas');
  });

  it('cada estrella trae aria-label propio por la clave shared.ratingInput.option', () => {
    // El stub verifica la clave contra es-CO.json pero NO interpola `{{value}}`
    // (esa sustitución la hace el motor i18n real) — mismo precedente que
    // `itemCountAriaPlural` en sol-kanban. La interpolación real se comprueba
    // en el bloque de textos por defecto es-CO, más abajo.
    expect(stars(root).map((s) => s.getAttribute('aria-label'))).toEqual(
      Array(5).fill('{{value}} de {{max}}'),
    );
  });

  it('una sola parada de tabulación: sin valor, la primera estrella (roving tabindex)', () => {
    expect(stars(root).map((s) => s.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1']);
  });

  it('con valor, la parada de tabulación se mueve a la estrella marcada', () => {
    stars(root)[3].click();
    fixture.detectChanges();
    expect(stars(root).map((s) => s.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1', '0', '-1']);
  });

  // ── Selección con ratón ───────────────────────────────────────────────

  it('[spec] clic en la 4.ª estrella: value=4, aria-checked solo ahí y 4 estrellas pintadas', () => {
    stars(root)[3].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe(4);
    expect(checkedFlags(root)).toEqual(['false', 'false', 'false', 'true', 'false']);
    expect(filledCount(root)).toBe(4);
  });

  it('[spec] el clic emite el valor exacto elegido', () => {
    const emitted: (number | null)[] = [];
    fixture.componentInstance.ratingChanged.subscribe((v) => emitted.push(v));

    stars(root)[2].click();
    fixture.detectChanges();

    expect(emitted).toEqual([3]);
  });

  it('reelegir la MISMA estrella no reemite (no hay cambio real de valor)', () => {
    const emitted: (number | null)[] = [];
    fixture.componentInstance.ratingChanged.subscribe((v) => emitted.push(v));

    stars(root)[2].click();
    stars(root)[2].click();
    fixture.detectChanges();

    expect(emitted).toEqual([3]);
  });

  // ── Vista previa al pasar el ratón ────────────────────────────────────

  it('[WARNING] la vista previa PINTA pero no cambia el valor ni aria-checked', () => {
    stars(root)[1].click();
    fixture.detectChanges();

    stars(root)[4].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(filledCount(root)).toBe(5); // se ve la previa de 5
    expect(fixture.componentInstance.value()).toBe(2); // pero el valor sigue en 2
    expect(checkedFlags(root)).toEqual(['false', 'true', 'false', 'false', 'false']);
  });

  it('al salir el puntero del grupo vuelve lo elegido (la respuesta nunca se pierde)', () => {
    stars(root)[1].click();
    stars(root)[4].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    group(root).dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();

    expect(filledCount(root)).toBe(2);
    expect(fixture.componentInstance.value()).toBe(2);
  });

  // ── Teclado ───────────────────────────────────────────────────────────

  it('[spec] flecha derecha desde el grupo vacío marca y enfoca la 2.ª estrella', () => {
    stars(root)[0].focus();
    pressKey(stars(root)[0], 'ArrowRight');
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe(2);
    expect(checkedFlags(root)[1]).toBe('true');
    expect(document.activeElement).toBe(stars(root)[1]);
  });

  it('[spec] flecha izquierda no da la vuelta: sobre la primera la marca (así "1" se alcanza con teclado)', () => {
    stars(root)[0].focus();
    pressKey(stars(root)[0], 'ArrowLeft');
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe(1);
    expect(checkedFlags(root)).toEqual(['true', 'false', 'false', 'false', 'false']);
  });

  it('flecha abajo/arriba equivalen a derecha/izquierda (patrón radiogroup)', () => {
    stars(root)[0].focus();
    pressKey(stars(root)[0], 'ArrowDown');
    pressKey(stars(root)[1], 'ArrowDown');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(3);

    pressKey(stars(root)[2], 'ArrowUp');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(2);
  });

  it('[spec] Fin salta a la 5.ª e Inicio vuelve a la 1.ª, marcando en ambos casos', () => {
    stars(root)[0].focus();
    pressKey(stars(root)[0], 'End');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(5);
    expect(document.activeElement).toBe(stars(root)[4]);

    pressKey(stars(root)[4], 'Home');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(1);
    expect(document.activeElement).toBe(stars(root)[0]);
  });

  it('[spec] Espacio marca la estrella enfocada sin moverse (entrar al grupo vacío y responder "1")', () => {
    const emitted: (number | null)[] = [];
    fixture.componentInstance.ratingChanged.subscribe((v) => emitted.push(v));

    stars(root)[0].focus();
    pressKey(stars(root)[0], ' ');
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe(1);
    expect(emitted).toEqual([1]);
  });

  it('[WARNING] select() fuera de escala se normaliza: nunca deja un aria-checked imposible', () => {
    // 0 y negativos son "sin responder": se ignoran y el grupo sigue vacío.
    fixture.componentInstance.select(0);
    fixture.componentInstance.select(-2);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBeNull();
    expect(checkedFlags(root)).toEqual(['false', 'false', 'false', 'false', 'false']);

    // Por arriba se recorta al tope de la escala, no se pierde el evento.
    fixture.componentInstance.select(9);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(5);
    expect(checkedFlags(root)).toEqual(['false', 'false', 'false', 'false', 'true']);
  });

  it('una tecla ajena (p. ej. "a") no altera el valor', () => {
    stars(root)[2].click();
    fixture.detectChanges();

    pressKey(stars(root)[2], 'a');
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe(3);
  });

  // ── Deshabilitado ─────────────────────────────────────────────────────

  it('[spec] deshabilitado: botones disabled, aria-disabled en el grupo y el clic no cambia nada', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(group(root).getAttribute('aria-disabled')).toBe('true');
    expect(stars(root).every((s) => s.disabled)).toBe(true);

    stars(root)[3].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('[WARNING] deshabilitado: ni la API pública cambia el valor (la guarda no depende del DOM)', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    fixture.componentInstance.select(4);
    pressKey(group(root), 'ArrowRight');
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBeNull();
  });

  // ── Solo lectura ──────────────────────────────────────────────────────

  it('solo lectura: aria-readonly, estrellas ENFOCABLES (no disabled) y valor congelado', () => {
    fixture.componentInstance.writeValue(3);
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();

    expect(group(root).getAttribute('aria-readonly')).toBe('true');
    expect(group(root).getAttribute('aria-disabled')).toBeNull();
    expect(stars(root).some((s) => s.disabled)).toBe(false);

    stars(root)[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(3);
  });

  // ── Error ─────────────────────────────────────────────────────────────

  it('error: mensaje visible, aria-invalid y aria-describedby apuntando a ese mensaje', () => {
    fixture.componentRef.setInput('error', 'Califica tu cita para continuar');
    fixture.detectChanges();

    const message = root.querySelector<HTMLElement>('.sol-rating-input__error')!;
    expect(message.textContent?.trim()).toBe('Califica tu cita para continuar');
    expect(group(root).getAttribute('aria-invalid')).toBe('true');
    expect(group(root).getAttribute('aria-describedby')).toBe(message.id);
    expect(message.id).not.toBe('');
  });

  it('sin error no hay mensaje ni aria-invalid', () => {
    expect(root.querySelector('.sol-rating-input__error')).toBeNull();
    expect(group(root).getAttribute('aria-invalid')).toBeNull();
  });

  // ── Limpiar ───────────────────────────────────────────────────────────

  it('sin allowClear no existe el botón de limpiar', () => {
    stars(root)[3].click();
    fixture.detectChanges();
    expect(root.querySelector('.sol-rating-input__clear')).toBeNull();
  });

  it('[spec] con allowClear: el botón aparece solo con valor y devuelve el control a "sin responder"', () => {
    fixture.componentRef.setInput('allowClear', true);
    fixture.detectChanges();
    expect(root.querySelector('.sol-rating-input__clear')).toBeNull();

    stars(root)[3].click();
    fixture.detectChanges();

    const clearButton = root.querySelector<HTMLButtonElement>('.sol-rating-input__clear')!;
    expect(clearButton.getAttribute('aria-label')).toBe('Quitar la calificación');

    const emitted: (number | null)[] = [];
    fixture.componentInstance.ratingChanged.subscribe((v) => emitted.push(v));
    clearButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(checkedFlags(root)).toEqual(['false', 'false', 'false', 'false', 'false']);
    expect(emitted).toEqual([null]);
  });

  it('Suprimir limpia con allowClear activo, y no hace nada sin él', () => {
    stars(root)[3].click();
    pressKey(stars(root)[3], 'Delete');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(4);

    fixture.componentRef.setInput('allowClear', true);
    fixture.detectChanges();
    pressKey(stars(root)[3], 'Delete');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBeNull();
  });

  // ── ControlValueAccessor a mano ───────────────────────────────────────

  it('writeValue pinta el valor sin emitir por onChange (evita el bucle del formulario)', () => {
    const seen: (number | null)[] = [];
    fixture.componentInstance.registerOnChange((v) => seen.push(v));

    fixture.componentInstance.writeValue(5);
    fixture.detectChanges();

    expect(checkedFlags(root)[4]).toBe('true');
    expect(seen).toEqual([]);
  });

  it('writeValue(null) devuelve el control al estado "sin responder"', () => {
    fixture.componentInstance.writeValue(4);
    fixture.detectChanges();
    fixture.componentInstance.writeValue(null);
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(checkedFlags(root)).toEqual(['false', 'false', 'false', 'false', 'false']);
  });

  it('registerOnTouched se dispara al salir el foco del grupo', () => {
    let touched = false;
    fixture.componentInstance.registerOnTouched(() => (touched = true));

    group(root).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();

    expect(touched).toBe(true);
  });
});

// ── Integración real con formularios reactivos ──────────────────────────

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, SolRatingInputComponent],
  template: `<sol-rating-input [formControl]="calificacion" [allowClear]="true" />`,
})
class HostFormularioComponent {
  readonly calificacion = new FormControl<number | null>(null);
}

describe('SolRatingInputComponent — integración con formularios reactivos', () => {
  let fixture: ComponentFixture<HostFormularioComponent>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostFormularioComponent],
      providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
    });
    fixture = TestBed.createComponent(HostFormularioComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('[spec] el control arranca en null y ninguna estrella marcada', () => {
    expect(fixture.componentInstance.calificacion.value).toBeNull();
    expect(checkedFlags(root)).toEqual(['false', 'false', 'false', 'false', 'false']);
  });

  it('[spec] elegir una estrella escribe el valor en el FormControl', () => {
    stars(root)[4].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.calificacion.value).toBe(5);
  });

  it('[spec] setValue desde el formulario pinta el control (writeValue)', () => {
    fixture.componentInstance.calificacion.setValue(2);
    fixture.detectChanges();

    expect(checkedFlags(root)).toEqual(['false', 'true', 'false', 'false', 'false']);
    expect(filledCount(root)).toBe(2);
  });

  it('elegir marca el control como touched y dirty (la validación puede reaccionar)', () => {
    expect(fixture.componentInstance.calificacion.touched).toBe(false);

    stars(root)[2].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.calificacion.touched).toBe(true);
    expect(fixture.componentInstance.calificacion.dirty).toBe(true);
  });

  it('[WARNING] control.disable() SÍ deshabilita el control (setDisabledState real, no un no-op)', () => {
    fixture.componentInstance.calificacion.disable();
    fixture.detectChanges();

    expect(group(root).getAttribute('aria-disabled')).toBe('true');
    expect(stars(root).every((s) => s.disabled)).toBe(true);

    stars(root)[3].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.calificacion.value).toBeNull();

    fixture.componentInstance.calificacion.enable();
    fixture.detectChanges();
    expect(stars(root).some((s) => s.disabled)).toBe(false);
  });

  it('limpiar deja el FormControl en null (no en 0)', () => {
    stars(root)[3].click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.sol-rating-input__clear')!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.calificacion.value).toBeNull();
  });
});

// ── Textos por defecto es-CO (i18n identidad: el host no traduce) ───────

describe('SolRatingInputComponent — respaldo es-CO cuando el host no traduce', () => {
  let fixture: ComponentFixture<SolRatingInputComponent>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolRatingInputComponent],
      // Stub identidad: devuelve la clave tal cual, el comportamiento de
      // `SolI18n` ante una clave ausente. Ejercita los textos de la casa.
      providers: [
        {
          provide: SOL_I18N,
          useValue: {
            activeLang: signal('es-CO'),
            translate: (key: string) => key,
            t: (key: string) => signal(key),
            tMany: (keys: string[]) => signal(keys),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(SolRatingInputComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('[spec] el aria-label de cada opción es «N de 5», nunca la clave cruda', () => {
    expect(stars(root).map((s) => s.getAttribute('aria-label'))).toEqual([
      '1 de 5',
      '2 de 5',
      '3 de 5',
      '4 de 5',
      '5 de 5',
    ]);
  });

  it('el grupo y el botón de limpiar caen a los textos es-CO de la casa', () => {
    fixture.componentRef.setInput('allowClear', true);
    stars(root)[1].click();
    fixture.detectChanges();

    expect(group(root).getAttribute('aria-label')).toBe('Calificación de 1 a 5 estrellas');
    expect(
      root.querySelector<HTMLElement>('.sol-rating-input__clear')!.getAttribute('aria-label'),
    ).toBe('Quitar la calificación');
  });
});

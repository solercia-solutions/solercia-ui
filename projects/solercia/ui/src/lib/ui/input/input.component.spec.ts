import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolInputComponent } from './input.component';

/**
 * Specs de `sol-input` (11-f PR1 — fix de zoom móvil).
 * El fix vive dentro del `styles` inline del componente; Angular lo inserta
 * como `<style>` real en `document.head` (encapsulación emulada), así que
 * se verifica ahí en vez de mockear `matchMedia` (jsdom no evalúa layout).
 */
describe('SolInputComponent — fix de zoom móvil (11-f PR1)', () => {
  let fixture: ComponentFixture<SolInputComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolInputComponent] });
    fixture = TestBed.createComponent(SolInputComponent);
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

  it('enfocar en iOS Safari no dispara zoom: .sol-input llega a font-size:16px dentro de @media (max-width:640px)', () => {
    const block = mobileMediaBlock(headStyles());
    expect(block).toContain('.sol-input');
    expect(block).toMatch(/font-size:\s*16px/);
  });

  it('escritorio sin cambios: fuera del breakpoint móvil .sol-input conserva el token --sol-font-size-base', () => {
    const css = headStyles();
    const outsideMedia = css.replace(mobileMediaBlock(css), '');
    expect(outsideMedia).toMatch(/\.sol-input(\[[^\]]*\])?\s*\{[^}]*font-size:\s*var\(--sol-font-size-base\)/);
  });

  it('modo oscuro conserva sus tokens: el bloque móvil solo cambia font-size, ningún color/token', () => {
    const block = mobileMediaBlock(headStyles());
    expect(block).not.toMatch(/color:/);
    expect(block).not.toMatch(/background/);
    expect(block).not.toMatch(/border/);
  });
});

/**
 * Gate 4R A3 (11-c-whatsapp-config PR3): un campo `type="password"` sin
 * `autocomplete` deja que el gestor de contraseñas del navegador/SO
 * (Keychain, 1Password vía la API nativa del navegador) OFREZCA guardar el
 * valor tecleado — inaceptable para un token de acceso de Meta. `sol-input`
 * no exponía forma de pasar `autocomplete` al `<input>` nativo; este
 * cambio es ADITIVO (default `undefined` — ningún consumidor existente
 * cambia de comportamiento).
 */
describe('SolInputComponent — autocomplete passthrough (gate 4R A3)', () => {
  let fixture: ComponentFixture<SolInputComponent>;

  const createComponent = (): ComponentFixture<SolInputComponent> => {
    const created = TestBed.createComponent(SolInputComponent);
    created.detectChanges();
    return created;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = createComponent();
  });

  it('sin autocomplete especificado, el <input> nativo NO tiene el atributo (comportamiento previo intacto)', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('autocomplete')).toBeNull();
  });

  it('con autocomplete="new-password", el <input> nativo lo recibe (token nunca ofrecido al gestor de contraseñas)', () => {
    fixture.componentRef.setInput('autocomplete', 'new-password');
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
  });

  it('con autocomplete="email", el <input> nativo lo recibe (caso de uso normal, no relacionado a secretos)', () => {
    fixture.componentRef.setInput('autocomplete', 'email');
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('autocomplete')).toBe('email');
  });
});

/**
 * `min` passthrough (ola-09, P3b): sin él, un `sol-input type="date"` no
 * tenía forma de impedir elegir una fecha pasada desde el propio selector
 * nativo — el defecto que reportó el fundador ("permite poner cualquier
 * fecha"). Aditivo (default `undefined`), mismo patrón que `autocomplete`.
 */
describe('SolInputComponent — min passthrough (ola-09, P3b)', () => {
  let fixture: ComponentFixture<SolInputComponent>;

  const createComponent = (): ComponentFixture<SolInputComponent> => {
    const created = TestBed.createComponent(SolInputComponent);
    created.detectChanges();
    return created;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = createComponent();
  });

  it('sin min especificado, el <input> nativo NO tiene el atributo (comportamiento previo intacto)', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('min')).toBeNull();
  });

  it('con min="2026-08-23", el <input type="date"> nativo lo recibe', () => {
    fixture.componentRef.setInput('type', 'date');
    fixture.componentRef.setInput('min', '2026-08-23');
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('min')).toBe('2026-08-23');
  });
});

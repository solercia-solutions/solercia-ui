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

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolCheckboxComponent } from './checkbox.component';

/**
 * Radio tematizado del shape "rounded" (CP-1): la esquina del checkbox debe
 * seguir el token del tema (var(--sol-border-radius-sm)) en vez de un px
 * fijo, conservando el fallback por tamaño (--_r) para temas sin el token.
 * El CSS vive en el `styles` inline del componente; Angular lo inserta como
 * `<style>` real en `document.head` (encapsulación emulada), así que se
 * verifica ahí (jsdom no evalúa layout).
 */
describe('SolCheckboxComponent — radio del shape rounded por token (CP-1)', () => {
  let fixture: ComponentFixture<SolCheckboxComponent>;
  let component: SolCheckboxComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolCheckboxComponent] });
    fixture = TestBed.createComponent(SolCheckboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function headStyles(): string {
    return Array.from(document.head.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
  }

  it('la regla .sol-checkbox__box--rounded usa var(--sol-border-radius-sm) con fallback, no un px fijo', () => {
    expect(headStyles()).toMatch(
      /\.sol-checkbox__box--rounded(\[[^\]]*\])?\s*\{[^}]*border-radius:\s*var\(--sol-border-radius-sm/,
    );
  });

  it('el shape por defecto sigue siendo "rounded" y el box lo refleja en su clase', () => {
    expect(component.shape()).toBe('rounded');
    const box = (fixture.nativeElement as HTMLElement).querySelector('.sol-checkbox__box');
    expect(box?.className).toContain('sol-checkbox__box--rounded');
  });

  it('los shapes square y circle no cambian: conservan sus radios propios', () => {
    const css = headStyles();
    expect(css).toMatch(/\.sol-checkbox__box--square(\[[^\]]*\])?\s*\{[^}]*border-radius:\s*2px/);
    expect(css).toMatch(/\.sol-checkbox__box--circle(\[[^\]]*\])?\s*\{[^}]*border-radius:\s*50%/);
  });
});

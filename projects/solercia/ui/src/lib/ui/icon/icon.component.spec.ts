import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolIconComponent } from './icon.component';

/**
 * Cubre el fix de review-readability del PR2: un ícono outline-only
 * (`IconDef.fill === ''` en `icon.registry.ts`) pedido con `variant="fill"`
 * debe degradar a su trazo outline (visible y correcto), NUNCA renderizar
 * con `fill="currentColor" stroke="none"` sobre paths de trazo abierto —
 * eso los dejaría con área cero (icono roto/invisible).
 */
describe('SolIconComponent — variant fill sobre íconos outline-only', () => {
  let fixture: ComponentFixture<SolIconComponent>;

  function svgEl(): SVGSVGElement {
    return (fixture.nativeElement as HTMLElement).querySelector('svg')!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolIconComponent] });
    fixture = TestBed.createComponent(SolIconComponent);
  });

  it('un ícono outline-only (robot) con variant="fill" degrada al trazo outline, no a fill sólido', () => {
    fixture.componentRef.setInput('name', 'robot');
    fixture.componentRef.setInput('variant', 'fill');
    fixture.detectChanges();

    const svg = svgEl();
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('stroke-width')).toBe('1.5');
    // el contenido sigue siendo el mismo trazo (antena/ojos/boca visibles).
    expect(svg.innerHTML).toContain('M7 9a2 2 0 0 1 2-2h6');
  });

  it('un ícono outline-only del rich-editor (bold) con variant="fill" también degrada a trazo', () => {
    fixture.componentRef.setInput('name', 'bold');
    fixture.componentRef.setInput('variant', 'fill');
    fixture.detectChanges();

    const svg = svgEl();
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });

  it('un ícono CON silueta sólida real (chevron-down) sigue renderizando fill="currentColor" en variant="fill"', () => {
    fixture.componentRef.setInput('name', 'chevron-down');
    fixture.componentRef.setInput('variant', 'fill');
    fixture.detectChanges();

    const svg = svgEl();
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.getAttribute('stroke')).toBe('none');
  });

  it('variant="outline" (default) siempre renderiza trazo, sin cambios de comportamiento', () => {
    fixture.componentRef.setInput('name', 'chevron-down');
    fixture.detectChanges();

    const svg = svgEl();
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });

  it('un nombre de ícono desconocido no rompe el render (dot de respaldo)', () => {
    fixture.componentRef.setInput('name', 'esto-no-existe');
    fixture.componentRef.setInput('variant', 'fill');
    fixture.detectChanges();

    expect(svgEl().innerHTML).toContain('<circle');
  });
});

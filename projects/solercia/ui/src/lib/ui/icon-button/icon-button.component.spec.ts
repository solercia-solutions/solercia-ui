import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolIconButtonComponent } from './icon-button.component';

describe('SolIconButtonComponent — botón de solo ícono', () => {
  let fixture: ComponentFixture<SolIconButtonComponent>;

  function button(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button')!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolIconButtonComponent] });
    fixture = TestBed.createComponent(SolIconButtonComponent);
    fixture.componentRef.setInput('icon', 'edit');
    fixture.componentRef.setInput('ariaLabel', 'Editar');
    fixture.detectChanges();
  });

  it('renderiza un botón con el ícono del registry y su aria-label', () => {
    expect(button().getAttribute('aria-label')).toBe('Editar');
    expect((fixture.nativeElement as HTMLElement).querySelector('sol-icon')).not.toBeNull();
    expect(button().getAttribute('type')).toBe('button');
  });

  it('aplica las clases de variante y tamaño', () => {
    fixture.componentRef.setInput('variant', 'danger');
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();

    expect(button().className).toContain('sol-icon-btn--danger');
    expect(button().className).toContain('sol-icon-btn--lg');
  });

  it('0.6.0 — variant="outline" aplica sol-icon-btn--outline (fondo transparente + reborde homogéneo)', () => {
    fixture.componentRef.setInput('variant', 'outline');
    fixture.detectChanges();

    expect(button().className).toContain('sol-icon-btn--outline');
  });

  it('PR-C4 (≥44px hit-area, GOAL §4) — size="touch" aplica sol-icon-btn--touch, preset ADITIVO', () => {
    fixture.componentRef.setInput('size', 'touch');
    fixture.detectChanges();

    expect(button().className).toContain('sol-icon-btn--touch');
  });

  it('emite clicked al hacer clic cuando está habilitado', () => {
    let count = 0;
    fixture.componentInstance.clicked.subscribe(() => (count += 1));

    button().click();
    expect(count).toBe(1);
  });

  it('no emite clicked ni pierde el aria cuando está deshabilitado', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    let count = 0;
    fixture.componentInstance.clicked.subscribe(() => (count += 1));

    // Llamada directa al handler (jsdom no bloquea el click en botones disabled).
    fixture.componentInstance.onClick(new MouseEvent('click'));
    expect(count).toBe(0);
    expect(button().disabled).toBe(true);
  });
});

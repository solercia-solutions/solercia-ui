import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolButtonComponent } from './button.component';

/**
 * `SolButtonComponent` no tenía spec propio antes de PR-C4 (Ola 5, GOAL §4
 * punto 2, "≥44px hit-area... de la paleta/drawer"). Este archivo cubre el
 * contrato mínimo (variante/tamaño/disabled/loading/click) y, en particular,
 * el preset NUEVO `size="touch"` (44px, ADITIVO — ver docstring de
 * `SolButtonSize`) que consumen `flow-node-palette`/`flow-node-editor-drawer`.
 */
describe('SolButtonComponent', () => {
  let fixture: ComponentFixture<SolButtonComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(): HTMLButtonElement {
    return host().querySelector('button') as HTMLButtonElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolButtonComponent] });
    fixture = TestBed.createComponent(SolButtonComponent);
    fixture.detectChanges();
  });

  it('default: variant primary, size md', () => {
    expect(button().className).toContain('sol-btn--primary');
    expect(button().className).toContain('sol-btn--md');
  });

  it('PR-C4 — size="touch" aplica la clase sol-btn--touch (preset ADITIVO de ≥44px)', () => {
    fixture.componentRef.setInput('size', 'touch');
    fixture.detectChanges();
    expect(button().className).toContain('sol-btn--touch');
  });

  it('sm/md/lg siguen intactos tras agregar el preset touch (regresión)', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      fixture.componentRef.setInput('size', size);
      fixture.detectChanges();
      expect(button().className).toContain(`sol-btn--${size}`);
      expect(button().className).not.toContain('sol-btn--touch');
    }
  });

  it('disabled bloquea el click; loading muestra spinner y bloquea el click', () => {
    const clicks: void[] = [];
    fixture.componentInstance.clicked.subscribe(() => clicks.push(undefined));

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    button().click();
    expect(clicks.length).toBe(0);

    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(host().querySelector('.sol-btn__spinner')).not.toBeNull();
    button().click();
    expect(clicks.length).toBe(0);

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    button().click();
    expect(clicks.length).toBe(1);
  });
});

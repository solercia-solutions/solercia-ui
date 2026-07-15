import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolTabsComponent, type SolTabItem } from './tabs.component';

const TABS: SolTabItem[] = [
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'categorias', label: 'Categorías FAQs' },
  { id: 'faqs', label: 'FAQs' },
];

describe('SolTabsComponent — navegación por pestañas', () => {
  let fixture: ComponentFixture<SolTabsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolTabsComponent] });
    fixture = TestBed.createComponent(SolTabsComponent);
    fixture.componentRef.setInput('tabs', TABS);
    fixture.componentRef.setInput('activeTab', 'etiquetas');
    fixture.detectChanges();
  });

  function tabs(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]'));
  }

  it('renderiza el tablist con una pestaña accesible por item', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs().map(t => t.textContent?.trim())).toEqual(['Etiquetas', 'Categorías FAQs', 'FAQs']);
  });

  it('marca la pestaña activa con aria-selected y su clase de estado', () => {
    const [etiquetas, , faqs] = tabs();
    expect(etiquetas.getAttribute('aria-selected')).toBe('true');
    expect(etiquetas.className).toContain('sol-tabs__tab--active');
    expect(faqs.getAttribute('aria-selected')).toBe('false');
  });

  it('el clic emite tabChange con el id (el padre gobierna el estado)', () => {
    const emitted: string[] = [];
    fixture.componentInstance.tabChange.subscribe(id => emitted.push(id));

    tabs()[2].click();
    expect(emitted).toEqual(['faqs']);

    // El componente NO se auto-activa: sigue mandando el input del padre.
    fixture.detectChanges();
    expect(tabs()[2].getAttribute('aria-selected')).toBe('false');
  });

  it('al cambiar el input activeTab la marca visual migra de pestaña', () => {
    fixture.componentRef.setInput('activeTab', 'faqs');
    fixture.detectChanges();

    const [etiquetas, , faqs] = tabs();
    expect(etiquetas.getAttribute('aria-selected')).toBe('false');
    expect(faqs.getAttribute('aria-selected')).toBe('true');
  });
});

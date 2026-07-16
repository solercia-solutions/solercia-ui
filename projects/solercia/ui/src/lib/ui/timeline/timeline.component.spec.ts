import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolTimelineComponent } from './timeline.component';
import type { TimelineNode } from './timeline.model';

describe('SolTimelineComponent', () => {
  let fixture: ComponentFixture<SolTimelineComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rowLabels(): string[] {
    return Array.from(host().querySelectorAll('.sol-timeline__label')).map((el) => el.textContent!.trim());
  }

  function toggleButtons(): HTMLButtonElement[] {
    return Array.from(host().querySelectorAll<HTMLButtonElement>('.sol-timeline__toggle'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolTimelineComponent],
      // Stub que VERIFICA la clave contra el catálogo real es-CO.json —
      // detecta claves i18n olvidadas (mismo patrón de los átomos del PR3).
      providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
    });
    fixture = TestBed.createComponent(SolTimelineComponent);
  });

  function threeLevelTree(): TimelineNode[] {
    return [
      {
        id: 'root',
        label: 'Raíz',
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 31),
        children: [
          {
            id: 'mid',
            label: 'Medio',
            start: new Date(2024, 0, 5),
            end: new Date(2024, 0, 20),
            children: [
              { id: 'leaf', label: 'Hoja', start: new Date(2024, 0, 8), end: new Date(2024, 0, 12) },
            ],
          },
        ],
      },
    ];
  }

  it('[spec] renderiza 3 niveles anidados con indentación creciente por depth', () => {
    fixture.componentRef.setInput('nodes', threeLevelTree());
    fixture.detectChanges();

    expect(rowLabels()).toEqual(['Raíz', 'Medio', 'Hoja']);

    const headers = Array.from(host().querySelectorAll<HTMLElement>('.sol-timeline__row-header'));
    const indents = headers.map((h) => parseFloat(h.style.paddingLeft));
    expect(indents).toEqual([0, 20, 40]);
  });

  it('[spec] colapsar el nodo raíz oculta TODOS sus descendientes (medio y hoja)', () => {
    fixture.componentRef.setInput('nodes', threeLevelTree());
    fixture.detectChanges();

    expect(rowLabels()).toEqual(['Raíz', 'Medio', 'Hoja']);

    toggleButtons()[0].click(); // colapsa "root"
    fixture.detectChanges();

    expect(rowLabels()).toEqual(['Raíz']);
    expect(toggleButtons()[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('[spec] expandir restaura los hijos con sus datos intactos (mismas etiquetas, mismo orden)', () => {
    fixture.componentRef.setInput('nodes', threeLevelTree());
    fixture.detectChanges();

    toggleButtons()[0].click(); // colapsa
    fixture.detectChanges();
    expect(rowLabels()).toEqual(['Raíz']);

    toggleButtons()[0].click(); // expande de nuevo
    fixture.detectChanges();

    expect(rowLabels()).toEqual(['Raíz', 'Medio', 'Hoja']);
    expect(toggleButtons()[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('emite nodeToggled con el id y el nuevo estado de colapso', () => {
    fixture.componentRef.setInput('nodes', threeLevelTree());
    fixture.detectChanges();

    const events: Array<{ id: string | number; collapsed: boolean }> = [];
    fixture.componentInstance.nodeToggled.subscribe((e) => events.push(e));

    toggleButtons()[0].click();
    fixture.detectChanges();

    expect(events).toEqual([{ id: 'root', collapsed: true }]);
  });

  it('un nodo sin hijos no tiene botón de colapso (solo un espaciador)', () => {
    fixture.componentRef.setInput('nodes', [
      { id: 'leaf-only', label: 'Sin hijos', start: new Date(2024, 0, 1), end: new Date(2024, 0, 5) },
    ]);
    fixture.detectChanges();

    expect(toggleButtons().length).toBe(0);
    expect(host().querySelector('.sol-timeline__toggle-spacer')).not.toBeNull();
  });

  it('barra envolvente: un padre sin fechas propias cubre el rango de sus hijos', () => {
    fixture.componentRef.setInput('nodes', [
      {
        id: 'p',
        label: 'Padre sin fechas propias',
        children: [
          { id: 'a', label: 'A', start: new Date(2024, 0, 5), end: new Date(2024, 0, 10) },
          { id: 'b', label: 'B', start: new Date(2024, 0, 8), end: new Date(2024, 0, 15) },
        ],
      },
    ]);
    fixture.detectChanges();

    const bars = Array.from(host().querySelectorAll<HTMLElement>('.sol-timeline__bar'));
    expect(bars.length).toBe(3); // padre + 2 hijos
  });

  it('nodos sin ninguna fecha resoluble se muestran en la sección "sin fechas" (chips)', () => {
    fixture.componentRef.setInput('nodes', [
      { id: 'undated', label: 'Sin fecha' },
      { id: 'dated', label: 'Con fecha', start: new Date(2024, 0, 1), end: new Date(2024, 0, 10) },
    ]);
    fixture.detectChanges();

    const chips = Array.from(host().querySelectorAll('.sol-timeline__chip')).map((c) => c.textContent!.trim());
    expect(chips).toEqual(['Sin fecha']);
    expect(rowLabels()).toEqual(['Con fecha']);
  });

  it('arreglo vacío o sin nodos muestra el estado vacío (clave verificada contra es-CO.json)', () => {
    fixture.componentRef.setInput('nodes', []);
    fixture.detectChanges();
    expect(host().querySelector('.sol-timeline__empty')?.textContent?.trim()).toBe('No hay elementos para mostrar');
  });

  it('[robustez PR3] nodes=null no revienta el render — se comporta como vacío', () => {
    expect(() => {
      fixture.componentRef.setInput('nodes', null);
      fixture.detectChanges();
    }).not.toThrow();
    expect(host().querySelector('.sol-timeline__empty')).not.toBeNull();
  });

  it('[robustez PR3] nodes=undefined no revienta el render', () => {
    expect(() => {
      fixture.componentRef.setInput('nodes', undefined);
      fixture.detectChanges();
    }).not.toThrow();
  });

  it('[robustez PR3] fechas inválidas dentro del árbol degradan con gracia (nodo cae a "sin fechas")', () => {
    expect(() => {
      fixture.componentRef.setInput('nodes', [
        { id: 'bad', label: 'Fecha inválida', start: 'no-es-fecha', end: new Date(2024, 0, 5) },
      ]);
      fixture.detectChanges();
    }).not.toThrow();

    const chips = Array.from(host().querySelectorAll('.sol-timeline__chip')).map((c) => c.textContent!.trim());
    expect(chips).toEqual(['Fecha inválida']);
  });

  it('collapsible=false deshabilita el control de colapso — todo se renderiza siempre expandido', () => {
    fixture.componentRef.setInput('nodes', threeLevelTree());
    fixture.componentRef.setInput('collapsible', false);
    fixture.detectChanges();

    expect(toggleButtons().length).toBe(0);
    expect(rowLabels()).toEqual(['Raíz', 'Medio', 'Hoja']);
  });

  it('renderiza la leyenda cuando se provee, con las claves i18n verificadas', () => {
    fixture.componentRef.setInput('nodes', threeLevelTree());
    fixture.componentRef.setInput('legend', [{ status: 'done', labelKey: 'shared.trend.up' }]);
    fixture.detectChanges();

    expect(host().querySelector('.sol-timeline__legend-item')?.textContent).toContain('En aumento');
  });

  it('emite nodeClicked al hacer clic en la barra', () => {
    fixture.componentRef.setInput('nodes', threeLevelTree());
    fixture.detectChanges();

    const clicked: TimelineNode[] = [];
    fixture.componentInstance.nodeClicked.subscribe((n) => clicked.push(n));

    host().querySelector<HTMLElement>('.sol-timeline__bar')!.click();
    expect(clicked.map((n) => n.id)).toEqual(['root']);
  });
});

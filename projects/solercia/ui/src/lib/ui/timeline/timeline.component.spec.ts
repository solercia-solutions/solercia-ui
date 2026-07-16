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

  it('[CRITICAL-4] tras un toggle() del usuario, reasignar `nodes` (misma estructura) NO descarta su colapso', () => {
    // Antes del fix, el effect() re-sembraba collapsedIds en CADA cambio de
    // `nodes()`, descartando lo que el usuario ya había colapsado/expandido —
    // contrario al contrato de TimelineNode.collapsed ("estado INICIAL al
    // montar; clics posteriores NO mutan la entrada").
    const tree = threeLevelTree();
    fixture.componentRef.setInput('nodes', tree);
    fixture.detectChanges();
    expect(rowLabels()).toEqual(['Raíz', 'Medio', 'Hoja']);

    toggleButtons()[0].click(); // el usuario colapsa "root"
    fixture.detectChanges();
    expect(rowLabels()).toEqual(['Raíz']);

    // El consumidor reasigna `nodes` con la MISMA estructura (p. ej. porque
    // llegó una actualización del backend) — el objeto es nuevo, pero
    // `collapsed` en los datos de origen sigue sin tocar (undefined/false).
    fixture.componentRef.setInput('nodes', threeLevelTree());
    fixture.detectChanges();

    expect(rowLabels()).toEqual(['Raíz']); // el colapso del usuario PERSISTE
    expect(toggleButtons()[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('[CRITICAL nuevo] nodes=null inicial (patrón asíncrono) y LUEGO llegan datos con collapsed:true: el nodo SÍ inicia colapsado', () => {
    // Reproduce exactamente el bug introducido por el fix anterior: si la
    // PRIMERA corrida del effect ve nodes()=null (mientras la data carga,
    // p. ej. `[nodes]="stream$ | async"`) y marca "ya sembrado" sin sembrar
    // nada, cuando después llegan los datos reales con `collapsed: true` ya
    // no se siembran — el nodo se renderiza EXPANDIDO sin que el usuario lo
    // pidiera. La condición correcta exige `nodes()?.length` antes de
    // marcar hasSeededCollapse.
    fixture.componentRef.setInput('nodes', null); // 1ª emisión: sin datos todavía
    fixture.detectChanges();
    expect(host().querySelector('.sol-timeline__empty')).not.toBeNull();

    const tree: TimelineNode[] = [
      {
        id: 'root',
        label: 'Raíz',
        collapsed: true, // debe iniciar colapsado
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 31),
        children: [{ id: 'child', label: 'Hijo', start: new Date(2024, 0, 5), end: new Date(2024, 0, 10) }],
      },
    ];
    fixture.componentRef.setInput('nodes', tree); // 2ª emisión: llegan los datos reales
    fixture.detectChanges();

    expect(rowLabels()).toEqual(['Raíz']); // colapsado desde el arranque — "Hijo" no se ve
    expect(toggleButtons()[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('[CRITICAL-1] threeLevelTree (fechas propias en los 3 niveles): TODAS las barras caen dentro de [0,100]', () => {
    fixture.componentRef.setInput('nodes', threeLevelTree());
    fixture.detectChanges();

    const bars = Array.from(host().querySelectorAll<HTMLElement>('.sol-timeline__bar'));
    expect(bars.length).toBe(3);
    for (const bar of bars) {
      const left = parseFloat(bar.style.left);
      const width = parseFloat(bar.style.width);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100.000001);
    }
  });

  it('[CRITICAL-3] un árbol con ciclo no revienta el render del componente', () => {
    const cyclic: TimelineNode & { children: TimelineNode[] } = {
      id: 'cyclic',
      label: 'Ciclo',
      start: new Date(2024, 0, 5),
      end: new Date(2024, 0, 10),
      children: [],
    };
    cyclic.children = [cyclic];

    expect(() => {
      fixture.componentRef.setInput('nodes', [cyclic]);
      fixture.detectChanges();
    }).not.toThrow();
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

  it('[WARNING] start > end (fechas invertidas) se trata como "sin fecha", no como barra mal ubicada', () => {
    fixture.componentRef.setInput('nodes', [
      { id: 'inv', label: 'Invertido', start: new Date(2024, 0, 20), end: new Date(2024, 0, 10) },
    ]);
    fixture.detectChanges();

    const chips = Array.from(host().querySelectorAll('.sol-timeline__chip')).map((c) => c.textContent!.trim());
    expect(chips).toEqual(['Invertido']);
    expect(host().querySelectorAll('.sol-timeline__bar').length).toBe(0);
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

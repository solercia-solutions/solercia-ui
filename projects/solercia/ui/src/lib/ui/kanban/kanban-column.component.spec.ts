import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDropList, type CdkDragDrop, type CdkDragEnter, type CdkDragExit } from '@angular/cdk/drag-drop';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolKanbanColumnComponent } from './kanban-column.component';
import type { KanbanColumn, KanbanColumnAction } from './kanban.model';
import type { KanbanRawDropEvent } from './kanban-reorder.service';

interface DemoItem {
  id: string;
  title: string;
  status: string;
}

@Component({
  standalone: true,
  template: `
    <ng-template #card let-item>
      <span class="demo-card-title">{{ item.title }}</span>
    </ng-template>
    <ng-template #anchor let-column>
      <span class="demo-anchor">🏆 {{ column.id }}</span>
    </ng-template>
  `,
})
class TemplateHostComponent {
  readonly cardTemplate = viewChild.required<TemplateRef<unknown>>('card');
  readonly anchorTemplate = viewChild.required<TemplateRef<unknown>>('anchor');
}

describe('SolKanbanColumnComponent', () => {
  let templates: TemplateHostComponent;
  let fixture: ComponentFixture<SolKanbanColumnComponent<DemoItem>>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Instancia REAL de la directiva `CdkDropList` cableada en el template (spec: no simula drag real en jsdom). */
  function dropList(): CdkDropList {
    return fixture.debugElement.query(By.directive(CdkDropList)).injector.get(CdkDropList);
  }

  function mockDrop(previousIndex: number, currentIndex: number, previousContainerId: string, containerId: string): CdkDragDrop<DemoItem[]> {
    return {
      previousIndex,
      currentIndex,
      container: { id: containerId },
      previousContainer: { id: previousContainerId },
      item: {},
      isPointerOverContainer: true,
      distance: { x: 0, y: 0 },
      dropPoint: { x: 0, y: 0 },
      event: new MouseEvent('mouseup'),
    } as unknown as CdkDragDrop<DemoItem[]>;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TemplateHostComponent, SolKanbanColumnComponent],
      providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
    });
    const templateHost = TestBed.createComponent(TemplateHostComponent);
    templateHost.detectChanges();
    templates = templateHost.componentInstance;

    fixture = TestBed.createComponent<SolKanbanColumnComponent<DemoItem>>(SolKanbanColumnComponent);
    fixture.componentRef.setInput('cardTemplate', templates.cardTemplate());
  });

  it('[spec] board de dominio arbitrario: renderiza items {id,title,status} propios del consumidor', () => {
    const column: KanbanColumn<DemoItem> = {
      id: 'col-1',
      title: 'Por hacer',
      items: [
        { id: '1', title: 'Tarea A', status: 'active' },
        { id: '2', title: 'Tarea B', status: 'active' },
      ],
    };
    fixture.componentRef.setInput('column', column);
    fixture.detectChanges();

    const titles = Array.from(host().querySelectorAll('.demo-card-title')).map((el) => el.textContent);
    expect(titles).toEqual(['Tarea A', 'Tarea B']);
    expect(host().querySelector('.sol-kanban-column__count')?.textContent?.trim()).toBe('2');
    expect(host().querySelector('.sol-kanban-column__title')?.textContent).toBe('Por hacer');
  });

  it('[spec] ancla terminal: renderiza el template proyectado del consumidor sin que la librería conozca su significado de negocio', () => {
    const column: KanbanColumn<DemoItem> = {
      id: 'ganada',
      title: 'Ganada',
      items: [],
      terminalAnchor: true,
    };
    fixture.componentRef.setInput('column', column);
    fixture.componentRef.setInput('anchorTemplate', templates.anchorTemplate());
    fixture.detectChanges();

    expect(host().querySelector('.demo-anchor')?.textContent?.trim()).toBe('🏆 ganada');
  });

  it('sin terminalAnchor, el anchorTemplate NO se renderiza aunque se provea', () => {
    fixture.componentRef.setInput('column', { id: 'col-1', title: 'Normal', items: [] });
    fixture.componentRef.setInput('anchorTemplate', templates.anchorTemplate());
    fixture.detectChanges();

    expect(host().querySelector('.demo-anchor')).toBeNull();
  });

  it('columna vacía muestra el empty-state por defecto (clave i18n verificada contra es-CO.json)', () => {
    fixture.componentRef.setInput('column', { id: 'col-1', title: 'Vacía', items: [] });
    fixture.detectChanges();

    expect(host().querySelector('.sol-kanban-column__empty')?.textContent?.trim()).toBe('Sin tarjetas');
  });

  it('emite `action` con {columnId, action:"add"} al hacer clic en el botón de agregar', () => {
    fixture.componentRef.setInput('column', { id: 'col-1', title: 'Por hacer', items: [] });
    fixture.detectChanges();

    const emitted: KanbanColumnAction[] = [];
    fixture.componentInstance.action.subscribe((a) => emitted.push(a));

    host().querySelector<HTMLButtonElement>('.sol-kanban-column__add')!.click();
    expect(emitted).toEqual([{ columnId: 'col-1', action: 'add' }]);
  });

  it('[robustez PR3/PR4] column=null/undefined no revienta el render — se comporta como columna vacía', () => {
    expect(() => {
      fixture.componentRef.setInput('column', null);
      fixture.detectChanges();
    }).not.toThrow();

    expect(host().querySelector('.sol-kanban-column__title')?.textContent).toBe('');
    expect(host().querySelector('.sol-kanban-column__count')?.textContent?.trim()).toBe('0');
  });

  it('[robustez PR3/PR4] column.items=null/undefined se trata como arreglo vacío, sin lanzar', () => {
    expect(() => {
      fixture.componentRef.setInput('column', { id: 'col-1', title: 'Sin items', items: null as unknown as DemoItem[] });
      fixture.detectChanges();
    }).not.toThrow();

    expect(host().querySelector('.sol-kanban-column__count')?.textContent?.trim()).toBe('0');
  });

  it('[robustez PR3/PR4] title/titleKey no-string (dato malformado) no lanza — cae a cadena vacía', () => {
    expect(() => {
      fixture.componentRef.setInput('column', { id: 'col-1', title: 42 as unknown as string, items: [] });
      fixture.detectChanges();
    }).not.toThrow();

    expect(host().querySelector('.sol-kanban-column__title')?.textContent).toBe('');
  });

  it('sin accent explícito, usa el tono neutral de ui/tone/sol-tone.ts como fallback', () => {
    fixture.componentRef.setInput('column', { id: 'col-1', title: 'Sin accent', items: [] });
    fixture.detectChanges();

    expect(fixture.componentInstance.accentColor()).toContain('--sol-color-text-muted');
  });

  it('[WARNING] items con id duplicado o ausente no lanzan NG0955 — degradan (track cae al índice)', () => {
    const items: DemoItem[] = [
      { id: 'dup', title: 'Item 1', status: 'active' },
      { id: 'dup', title: 'Item 2 (id duplicado)', status: 'active' },
      { id: undefined as unknown as string, title: 'Item sin id', status: 'active' },
    ];

    expect(() => {
      fixture.componentRef.setInput('column', { id: 'col-1', title: 'Con duplicados', items });
      fixture.detectChanges();
    }).not.toThrow();

    const titles = Array.from(host().querySelectorAll('.demo-card-title')).map((el) => el.textContent);
    expect(titles).toEqual(['Item 1', 'Item 2 (id duplicado)', 'Item sin id']);
  });

  it('[WARNING] plural correcto: columna con 1 item usa la clave singular ("1 tarjeta")', () => {
    fixture.componentRef.setInput('column', {
      id: 'col-1',
      title: 'Con una',
      items: [{ id: '1', title: 'Única', status: 'active' }],
    });
    fixture.detectChanges();

    expect(host().querySelector('.sol-kanban-column__count')?.getAttribute('aria-label')).toBe('1 tarjeta');
  });

  it('[WARNING] plural correcto: columna con 2+ items usa la clave PLURAL (shared.kanban.itemCountAriaPlural)', () => {
    fixture.componentRef.setInput('column', {
      id: 'col-1',
      title: 'Con varias',
      items: [
        { id: '1', title: 'A', status: 'active' },
        { id: '2', title: 'B', status: 'active' },
      ],
    });
    fixture.detectChanges();

    // El stub de test VERIFICA la clave contra es-CO.json pero no interpola
    // {{count}} (esa sustitución la hace el motor i18n real, p. ej.
    // Transloco) — se confirma que se usó la clave PLURAL (no la singular)
    // y que el conteo real de items es el esperado.
    expect(host().querySelector('.sol-kanban-column__count')?.getAttribute('aria-label')).toBe('{{count}} tarjetas');
    expect(fixture.componentInstance.items().length).toBe(2);
  });

  it('[WARNING] plural correcto: columna vacía (0 items) usa la clave PLURAL, no la singular', () => {
    fixture.componentRef.setInput('column', { id: 'col-1', title: 'Vacía', items: [] });
    fixture.detectChanges();

    expect(host().querySelector('.sol-kanban-column__count')?.getAttribute('aria-label')).toBe('{{count}} tarjetas');
    expect(fixture.componentInstance.items().length).toBe(0);
  });

  describe('DnD (PR5b, T38) — cablea el `cdkDropList` de la columna, sin filtrar tipos de CDK hacia el board', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('column', {
        id: 'A',
        title: 'Columna A',
        items: [
          { id: '1', title: 'Uno', status: 'active' },
          { id: '2', title: 'Dos', status: 'active' },
        ],
      });
      fixture.detectChanges();
    });

    it('[spec] `cdkDropListDropped` (cross-columna) reenvía `itemDropped` como `KanbanRawDropEvent` CDK-free', () => {
      const emitted: KanbanRawDropEvent[] = [];
      fixture.componentInstance.itemDropped.subscribe((e) => emitted.push(e));

      dropList().dropped.emit(mockDrop(0, 1, 'A', 'B'));

      expect(emitted).toEqual([{ fromColumnId: 'A', toColumnId: 'B', previousIndex: 0, currentIndex: 1 }]);
    });

    it('[spec] `cdkDropListDropped` (misma columna) reenvía `itemDropped` con fromColumnId === toColumnId', () => {
      const emitted: KanbanRawDropEvent[] = [];
      fixture.componentInstance.itemDropped.subscribe((e) => emitted.push(e));

      dropList().dropped.emit(mockDrop(0, 1, 'A', 'A'));

      expect(emitted).toEqual([{ fromColumnId: 'A', toColumnId: 'A', previousIndex: 0, currentIndex: 1 }]);
    });

    it('un drop trivial (mismo contenedor, mismo índice) NO emite `itemDropped`', () => {
      const emitted: KanbanRawDropEvent[] = [];
      fixture.componentInstance.itemDropped.subscribe((e) => emitted.push(e));

      const trivial = mockDrop(0, 0, 'A', 'A');
      // El handler compara `previousContainer === container` por REFERENCIA — mismo objeto en ambos campos.
      trivial.container = trivial.previousContainer;
      dropList().dropped.emit(trivial);

      expect(emitted).toEqual([]);
    });

    it('[spec] UX de arrastre: `cdkDropListEntered` enciende el anillo de columna-destino activa (clase CSS)', () => {
      expect(host().querySelector('.sol-kanban-column--drop-active')).toBeNull();

      dropList().entered.emit({ container: dropList(), item: {}, currentIndex: 0 } as unknown as CdkDragEnter<DemoItem[]>);
      fixture.detectChanges();

      expect(host().querySelector('.sol-kanban-column--drop-active')).not.toBeNull();
    });

    it('`cdkDropListExited` apaga el anillo de columna-destino activa', () => {
      dropList().entered.emit({ container: dropList(), item: {}, currentIndex: 0 } as unknown as CdkDragEnter<DemoItem[]>);
      fixture.detectChanges();
      expect(host().querySelector('.sol-kanban-column--drop-active')).not.toBeNull();

      dropList().exited.emit({ container: dropList(), item: {} } as unknown as CdkDragExit<DemoItem[]>);
      fixture.detectChanges();
      expect(host().querySelector('.sol-kanban-column--drop-active')).toBeNull();
    });

    it('un drop exitoso apaga el anillo también (CDK no emite `exited` cuando el drop es en la MISMA columna)', () => {
      dropList().entered.emit({ container: dropList(), item: {}, currentIndex: 0 } as unknown as CdkDragEnter<DemoItem[]>);
      fixture.detectChanges();
      expect(host().querySelector('.sol-kanban-column--drop-active')).not.toBeNull();

      dropList().dropped.emit(mockDrop(0, 1, 'A', 'A'));
      fixture.detectChanges();

      expect(host().querySelector('.sol-kanban-column--drop-active')).toBeNull();
    });

    it('`droppable: false` deshabilita el drop-list (`cdkDropListDisabled`)', () => {
      fixture.componentRef.setInput('column', {
        id: 'A',
        title: 'No droppable',
        items: [{ id: '1', title: 'Uno', status: 'active' }],
        droppable: false,
      });
      fixture.detectChanges();

      expect(dropList().disabled).toBe(true);
    });

    it('sin `droppable` explícito (undefined), el drop-list queda HABILITADO por defecto', () => {
      expect(dropList().disabled).toBe(false);
    });

    it('[robustez] `column` null no impide que el drop-list exista con id vacío, sin lanzar', () => {
      expect(() => {
        fixture.componentRef.setInput('column', null);
        fixture.detectChanges();
      }).not.toThrow();

      expect(dropList().id).toBe('');
    });
  });

  describe('[corrección 4R CRITICAL] mover tarjeta 100% por teclado (select nativo, sin depender del drag de CDK)', () => {
    function moveSelects(): HTMLSelectElement[] {
      return Array.from(host().querySelectorAll<HTMLSelectElement>('.sol-kanban-column__move-select'));
    }

    function selectOption(select: HTMLSelectElement, value: string): void {
      select.value = value;
      select.dispatchEvent(new Event('change'));
    }

    beforeEach(() => {
      fixture.componentRef.setInput('column', {
        id: 'A',
        title: 'Columna A',
        items: [
          { id: '1', title: 'Uno', status: 'active' },
          { id: '2', title: 'Dos', status: 'active' },
          { id: '3', title: 'Tres', status: 'active' },
        ],
      });
      fixture.componentRef.setInput('allColumns', [
        { id: 'A', title: 'Columna A', items: [] },
        { id: 'B', title: 'Columna B', items: [] },
      ]);
      fixture.detectChanges();
    });

    it('[spec] cada tarjeta expone un `<select>` operable por teclado con `aria-label`', () => {
      const selects = moveSelects();
      expect(selects.length).toBe(3);
      for (const select of selects) {
        expect(select.getAttribute('aria-label')).toBe('Mover tarjeta');
      }
    });

    it('el select de la PRIMERA tarjeta NO ofrece "Subir" (ya está arriba)', () => {
      const options = Array.from(moveSelects()[0].querySelectorAll('option')).map((o) => o.value);
      expect(options).not.toContain('up');
      expect(options).toContain('down');
    });

    it('el select de la ÚLTIMA tarjeta NO ofrece "Bajar" (ya está abajo)', () => {
      const options = Array.from(moveSelects()[2].querySelectorAll('option')).map((o) => o.value);
      expect(options).not.toContain('down');
      expect(options).toContain('up');
    });

    it('el select ofrece la OTRA columna (no la propia) como opción "mover a"', () => {
      const options = Array.from(moveSelects()[1].querySelectorAll('option'));
      // El stub de test verifica la clave contra es-CO.json pero NO interpola
      // `{{column}}` (esa sustitución la hace el motor i18n real, p. ej.
      // Transloco) — igual que el precedente de itemCountAriaPlural (PR5a).
      const toOption = options.find((o) => o.value === 'to:B');
      expect(toOption?.textContent).toBe('Mover a {{column}}');
      expect(options.some((o) => o.value === 'to:A')).toBe(false);
    });

    it('[spec] elegir "Subir" emite `itemDropped` (misma columna, previousIndex→previousIndex-1) — MISMO output que el drag real', () => {
      const emitted: KanbanRawDropEvent[] = [];
      fixture.componentInstance.itemDropped.subscribe((e) => emitted.push(e));

      selectOption(moveSelects()[1], 'up');

      expect(emitted).toEqual([{ fromColumnId: 'A', toColumnId: 'A', previousIndex: 1, currentIndex: 0 }]);
    });

    it('elegir "Bajar" emite `itemDropped` (misma columna, previousIndex→previousIndex+1)', () => {
      const emitted: KanbanRawDropEvent[] = [];
      fixture.componentInstance.itemDropped.subscribe((e) => emitted.push(e));

      selectOption(moveSelects()[0], 'down');

      expect(emitted).toEqual([{ fromColumnId: 'A', toColumnId: 'A', previousIndex: 0, currentIndex: 1 }]);
    });

    it('elegir "Mover a Columna B" emite `itemDropped` hacia esa columna, al FINAL (índice grande, KanbanReorderService lo clampa)', () => {
      const emitted: KanbanRawDropEvent[] = [];
      fixture.componentInstance.itemDropped.subscribe((e) => emitted.push(e));

      selectOption(moveSelects()[0], 'to:B');

      expect(emitted.length).toBe(1);
      expect(emitted[0].fromColumnId).toBe('A');
      expect(emitted[0].toColumnId).toBe('B');
      expect(emitted[0].previousIndex).toBe(0);
      expect(emitted[0].currentIndex).toBeGreaterThan(0);
    });

    it('el select vuelve a su placeholder ("") después de cada selección — permite elegir la MISMA opción de nuevo', () => {
      const select = moveSelects()[1];
      selectOption(select, 'up');
      expect(select.value).toBe('');
    });

    it('sin `allColumns` (input no provisto), el select igual funciona para subir/bajar (solo faltan las opciones "mover a")', () => {
      fixture.componentRef.setInput('allColumns', null);
      fixture.detectChanges();

      const options = Array.from(moveSelects()[1].querySelectorAll('option')).map((o) => o.value);
      expect(options).toEqual(['', 'up', 'down']);
    });
  });
});

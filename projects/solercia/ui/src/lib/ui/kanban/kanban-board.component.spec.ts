import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolKanbanBoardComponent } from './kanban-board.component';
import type { KanbanColumn, KanbanColumnAction, KanbanItemMoved } from './kanban.model';

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

describe('SolKanbanBoardComponent', () => {
  let cardTemplate: TemplateRef<unknown>;
  let fixture: ComponentFixture<SolKanbanBoardComponent<DemoItem>>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function columnTitles(): string[] {
    return Array.from(host().querySelectorAll('.sol-kanban-column__title')).map((el) => el.textContent ?? '');
  }

  /** Títulos de tarjeta (`.demo-card-title`), en orden, dentro de la N-ésima `sol-kanban-column` renderizada. */
  function cardTitlesIn(columnIndex: number): string[] {
    const column = host().querySelectorAll('sol-kanban-column')[columnIndex];
    return Array.from(column?.querySelectorAll('.demo-card-title') ?? []).map((el) => el.textContent ?? '');
  }

  /** Instancia REAL de `CdkDropList` de la columna con ese `id` (spec: no simula drag real en jsdom). */
  function dropListOf(columnId: string): CdkDropList {
    const lists = fixture.debugElement.queryAll(By.directive(CdkDropList)).map((de) => de.injector.get(CdkDropList));
    const match = lists.find((list) => list.id === columnId);
    if (!match) throw new Error(`No se encontró cdkDropList para la columna "${columnId}"`);
    return match;
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
      imports: [TemplateHostComponent, SolKanbanBoardComponent],
      providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
    });
    const templateHost = TestBed.createComponent(TemplateHostComponent);
    templateHost.detectChanges();
    cardTemplate = templateHost.componentInstance.cardTemplate();

    fixture = TestBed.createComponent<SolKanbanBoardComponent<DemoItem>>(SolKanbanBoardComponent);
    fixture.componentRef.setInput('cardTemplate', cardTemplate);
  });

  const demoColumns: KanbanColumn<DemoItem>[] = [
    { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
    { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
  ];

  it('[spec] board de dominio arbitrario: renderiza una sol-kanban-column por columna, sin conocer el modelo de dominio', () => {
    fixture.componentRef.setInput('columns', demoColumns);
    fixture.detectChanges();

    expect(columnTitles()).toEqual(['Por hacer', 'Hecho']);
    expect(host().querySelectorAll('.demo-card-title').length).toBe(2);
  });

  it('el espejo interno refleja SIEMPRE la última verdad de `columns` (a diferencia del colapso de sol-timeline)', () => {
    fixture.componentRef.setInput('columns', demoColumns);
    fixture.detectChanges();
    expect(columnTitles()).toEqual(['Por hacer', 'Hecho']);

    fixture.componentRef.setInput('columns', [{ id: 'todo', title: 'Solo una', items: [] }]);
    fixture.detectChanges();
    expect(columnTitles()).toEqual(['Solo una']);
  });

  it('columnAction se re-emite y, si action==="add", ADEMÁS emite addRequested(columnId)', () => {
    fixture.componentRef.setInput('columns', demoColumns);
    fixture.detectChanges();

    const columnActions: KanbanColumnAction[] = [];
    const addRequests: string[] = [];
    fixture.componentInstance.columnAction.subscribe((a) => columnActions.push(a));
    fixture.componentInstance.addRequested.subscribe((id) => addRequests.push(id));

    const addButtons = Array.from(host().querySelectorAll<HTMLButtonElement>('.sol-kanban-column__add'));
    addButtons[0].click();

    expect(columnActions).toEqual([{ columnId: 'todo', action: 'add' }]);
    expect(addRequests).toEqual(['todo']);
  });

  it('[robustez PR3/PR4] columns=null/undefined no revienta el render — se comporta como tablero vacío', () => {
    expect(() => {
      fixture.componentRef.setInput('columns', null);
      fixture.detectChanges();
    }).not.toThrow();
    expect(host().querySelectorAll('sol-kanban-column').length).toBe(0);
  });

  it('[robustez PR3/PR4] un elemento null dentro de `columns` se filtra sin romper el render', () => {
    expect(() => {
      fixture.componentRef.setInput('columns', [null as unknown as KanbanColumn<DemoItem>, demoColumns[0]]);
      fixture.detectChanges();
    }).not.toThrow();
    expect(columnTitles()).toEqual(['Por hacer']);
  });

  it('[WARNING — O] el board expone y reenvía anchorTemplate a sol-kanban-column: el ancla se renderiza vía el board', () => {
    const templateHost = TestBed.createComponent(TemplateHostComponent);
    templateHost.detectChanges();

    fixture.componentRef.setInput('anchorTemplate', templateHost.componentInstance.anchorTemplate());
    fixture.componentRef.setInput('columns', [
      { id: 'ganada', title: 'Ganada', items: [], terminalAnchor: true },
    ]);
    fixture.detectChanges();

    expect(host().querySelector('.demo-anchor')?.textContent?.trim()).toBe('🏆 ganada');
  });

  it('[WARNING — blindaje D4] columns=null inicial (patrón asíncrono) y LUEGO llegan datos reales: el espejo las refleja', () => {
    // Mismo escenario que causó el 2º CRITICAL de sol-timeline (PR4) — acá
    // el espejo se re-siembra SIEMPRE (comportamiento correcto en PR5a, sin
    // flag de "ya sembrado"), así que la llegada tardía de datos SÍ debe
    // reflejarse sin necesitar ningún fix adicional. Test de blindaje antes
    // de que el PR5b construya el DnD encima de este mismo espejo.
    fixture.componentRef.setInput('columns', null);
    fixture.detectChanges();
    expect(host().querySelectorAll('sol-kanban-column').length).toBe(0);

    fixture.componentRef.setInput('columns', demoColumns);
    fixture.detectChanges();

    expect(columnTitles()).toEqual(['Por hacer', 'Hecho']);
  });

  it('[WARNING] columnas con id duplicado o ausente no lanzan NG0955 — degradan (track cae al índice)', () => {
    const dupOrMissing: KanbanColumn<DemoItem>[] = [
      { id: 'dup', title: 'Primera', items: [] },
      { id: 'dup', title: 'Segunda (id duplicado)', items: [] },
      { id: undefined as unknown as string, title: 'Sin id', items: [] },
    ];

    expect(() => {
      fixture.componentRef.setInput('columns', dupOrMissing);
      fixture.detectChanges();
    }).not.toThrow();

    expect(columnTitles()).toEqual(['Primera', 'Segunda (id duplicado)', 'Sin id']);
  });

  describe('DnD (PR5b, T38) — reorden vía KanbanReorderService + espejo optimista/rollback (D4)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('columns', [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ]);
      fixture.detectChanges();
    });

    it('[spec] mover tarjeta entre columnas: cross-columna actualiza el espejo (render) Y emite itemMoved', () => {
      const moved: KanbanItemMoved<DemoItem>[] = [];
      fixture.componentInstance.itemMoved.subscribe((e) => moved.push(e));

      dropListOf('todo').dropped.emit(mockDrop(0, 1, 'todo', 'done'));
      fixture.detectChanges();

      expect(moved).toEqual([
        { item: { id: '1', title: 'Tarea A', status: 'active' }, fromColumnId: 'todo', toColumnId: 'done', previousIndex: 0, currentIndex: 1 },
      ]);
      expect(cardTitlesIn(0)).toEqual([]);
      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);
    });

    it('[spec] reordenar dentro de la misma columna emite itemMoved con fromColumnId === toColumnId y reordena el render', () => {
      fixture.componentRef.setInput('columns', [
        {
          id: 'todo',
          title: 'Por hacer',
          items: [
            { id: '1', title: 'A', status: 'active' },
            { id: '2', title: 'B', status: 'active' },
            { id: '3', title: 'C', status: 'active' },
          ],
        },
      ]);
      fixture.detectChanges();

      const moved: KanbanItemMoved<DemoItem>[] = [];
      fixture.componentInstance.itemMoved.subscribe((e) => moved.push(e));

      dropListOf('todo').dropped.emit(mockDrop(0, 2, 'todo', 'todo'));
      fixture.detectChanges();

      expect(moved[0].fromColumnId).toBe(moved[0].toColumnId);
      expect(cardTitlesIn(0)).toEqual(['B', 'C', 'A']);
    });

    it('un drop con columna destino INEXISTENTE (evento inconsistente) se ignora sin lanzar ni emitir itemMoved', () => {
      const moved: KanbanItemMoved<DemoItem>[] = [];
      fixture.componentInstance.itemMoved.subscribe((e) => moved.push(e));

      expect(() => {
        dropListOf('todo').dropped.emit(mockDrop(0, 0, 'todo', 'columna-inexistente'));
      }).not.toThrow();

      expect(moved).toEqual([]);
      expect(cardTitlesIn(0)).toEqual(['Tarea A']);
    });

    it('[optimista+rollback D4] reasignar `columns` (nueva referencia, mismos datos) tras un itemMoved deshace la actualización optimista del espejo', () => {
      // Snapshot ANTES del drop — el consumidor reasigna a esto si el PATCH falla.
      const beforeDrop: KanbanColumn<DemoItem>[] = [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ];
      fixture.componentRef.setInput('columns', beforeDrop);
      fixture.detectChanges();

      // Optimista: el usuario arrastra "Tarea A" a "Hecho". El `[columns]` del
      // consumidor NO cambia con el drag (el mirror interno es independiente,
      // D4) — solo cambia si el consumidor reasigna explícitamente.
      dropListOf('todo').dropped.emit(mockDrop(0, 1, 'todo', 'done'));
      fixture.detectChanges();
      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);

      // El consumidor simula que el PATCH falló: reasigna `[columns]` a una
      // referencia NUEVA con los mismos datos de ANTES del drop (rollback) —
      // el `effect` D4 re-siembra el espejo desde esta referencia.
      fixture.componentRef.setInput('columns', [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ]);
      fixture.detectChanges();

      expect(cardTitlesIn(0)).toEqual(['Tarea A']);
      expect(cardTitlesIn(1)).toEqual(['Tarea B']);
    });
  });
});

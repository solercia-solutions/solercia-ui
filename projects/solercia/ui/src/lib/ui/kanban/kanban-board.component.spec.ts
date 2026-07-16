import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDrag, CdkDropList, type CdkDragDrop, type CdkDragStart, type CdkDragEnd } from '@angular/cdk/drag-drop';
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

  /** Primera instancia REAL de `CdkDrag` renderizada (la tarjeta en curso de arrastre). */
  function firstCardDrag(): CdkDrag {
    return fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);
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

    it('[optimista+rollback D4, corrección 4R WARNING] `board.rollback()` restaura el espejo desde `columns()` tras un PATCH fallido, SIN depender del juego de referencias', () => {
      const beforeDrop: KanbanColumn<DemoItem>[] = [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ];
      fixture.componentRef.setInput('columns', beforeDrop);
      fixture.detectChanges();

      // Optimista: el usuario arrastra "Tarea A" a "Hecho". El `[columns]` del
      // consumidor NO cambia con el drag (el mirror interno es independiente,
      // D4) — sigue apuntando a `beforeDrop`, sin tocar.
      dropListOf('todo').dropped.emit(mockDrop(0, 1, 'todo', 'done'));
      fixture.detectChanges();
      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);

      // El consumidor simula que el PATCH falló: llama `board.rollback()` —
      // NO reasigna `[columns]` (sigue siendo `beforeDrop`, la MISMA
      // referencia de siempre). `rollback()` fuerza el re-seed del espejo
      // desde el `columns()` ACTUAL sin depender de que la referencia
      // cambie (a diferencia de un simple efecto reactivo por Object.is).
      fixture.componentInstance.rollback();
      fixture.detectChanges();

      expect(cardTitlesIn(0)).toEqual(['Tarea A']);
      expect(cardTitlesIn(1)).toEqual(['Tarea B']);
    });

    it('[corrección 4R WARNING] reasignar `[columns]` a la MISMA referencia (Object.is) NO dispara el re-seed automático — por eso existe `rollback()`', () => {
      const beforeDrop: KanbanColumn<DemoItem>[] = [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ];
      fixture.componentRef.setInput('columns', beforeDrop);
      fixture.detectChanges();

      dropListOf('todo').dropped.emit(mockDrop(0, 1, 'todo', 'done'));
      fixture.detectChanges();
      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);

      // Reasignar la MISMA referencia (sin `rollback()`) no revierte nada —
      // documenta el comportamiento real de `Object.is` en signal inputs.
      fixture.componentRef.setInput('columns', beforeDrop);
      fixture.detectChanges();

      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);
    });

    it('[optimista+rollback D4] reasignar `columns` a una referencia NUEVA (mismos datos) también re-siembra el espejo (vía el effect normal)', () => {
      const beforeDrop: KanbanColumn<DemoItem>[] = [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ];
      fixture.componentRef.setInput('columns', beforeDrop);
      fixture.detectChanges();

      dropListOf('todo').dropped.emit(mockDrop(0, 1, 'todo', 'done'));
      fixture.detectChanges();
      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);

      fixture.componentRef.setInput('columns', [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ]);
      fixture.detectChanges();

      expect(cardTitlesIn(0)).toEqual(['Tarea A']);
      expect(cardTitlesIn(1)).toEqual(['Tarea B']);
    });
  });

  describe('[corrección 4R WARNING] reseed del espejo pospuesto mientras hay un drag CDK activo', () => {
    it('reasignar `columns()` DURANTE un drag activo NO reseedea el espejo hasta que el drag termina (cdkDragEnded)', () => {
      fixture.componentRef.setInput('columns', [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ]);
      fixture.detectChanges();

      const drag = firstCardDrag();
      drag.started.emit({ source: drag, event: new MouseEvent('mousedown') } as CdkDragStart);

      // El consumidor empuja un refresh en vivo MIENTRAS el usuario arrastra.
      fixture.componentRef.setInput('columns', [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A (actualizada)', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ]);
      fixture.detectChanges();

      // Pospuesto: el render SIGUE mostrando el dato viejo — reseedear ahora
      // destruiría/recrearía el nodo DOM que CDK está arrastrando (`@for`).
      expect(cardTitlesIn(0)).toEqual(['Tarea A']);

      drag.ended.emit({
        source: drag,
        distance: { x: 0, y: 0 },
        dropPoint: { x: 0, y: 0 },
        event: new MouseEvent('mouseup'),
      } as CdkDragEnd);
      fixture.detectChanges();

      // Al terminar el drag, el espejo se pone al día con la ÚLTIMA verdad.
      expect(cardTitlesIn(0)).toEqual(['Tarea A (actualizada)']);
    });

    it('si `columns()` NO cambia durante el drag, terminar el drag no pisa la actualización optimista de un drop concurrente', () => {
      fixture.componentRef.setInput('columns', [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ]);
      fixture.detectChanges();

      const drag = firstCardDrag();
      drag.started.emit({ source: drag, event: new MouseEvent('mousedown') } as CdkDragStart);

      // El drop real ocurre (actualiza el espejo de forma optimista, sin pasar por el effect).
      dropListOf('todo').dropped.emit(mockDrop(0, 1, 'todo', 'done'));
      fixture.detectChanges();
      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);

      drag.ended.emit({
        source: drag,
        distance: { x: 0, y: 0 },
        dropPoint: { x: 0, y: 0 },
        event: new MouseEvent('mouseup'),
      } as CdkDragEnd);
      fixture.detectChanges();

      // `columns()` del consumidor nunca cambió durante el drag → no hay
      // nada pospuesto que aplicar → la actualización optimista se conserva.
      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);
    });

    it('[corrección quirúrgica] AMBOS ocurren en el MISMO gesto (refresh externo + drop real) → el DROP gana; el refresh pospuesto se descarta', () => {
      fixture.componentRef.setInput('columns', [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ]);
      fixture.detectChanges();

      const moved: KanbanItemMoved<DemoItem>[] = [];
      fixture.componentInstance.itemMoved.subscribe((e) => moved.push(e));

      const drag = firstCardDrag();
      drag.started.emit({ source: drag, event: new MouseEvent('mousedown') } as CdkDragStart);

      // (a) Refresh externo MIENTRAS se arrastra: queda pospuesto (pendingColumnsSeed).
      fixture.componentRef.setInput('columns', [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A (refresh)', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ]);
      fixture.detectChanges();
      expect(cardTitlesIn(0)).toEqual(['Tarea A']); // pospuesto, aún no aplicado

      // (b) Drop real en el MISMO gesto: en CDK real, `cdkDropListDropped` Y
      // `cdkDrag.ended` disparan SINCRÓNICAMENTE, uno tras otro, ANTES de
      // que Angular reconcilie el `@for` (que recién ocurre en el próximo
      // `detectChanges()`). Por eso NO se llama `detectChanges()` entre
      // ambos emits acá — si se llamara, el `@for` destruiría el card
      // (se mueve de columna) y `takeUntilDestroyed()` desuscribiría
      // `cdkDrag.ended` ANTES de emitirlo, ocultando el bug real.
      dropListOf('todo').dropped.emit(mockDrop(0, 1, 'todo', 'done'));
      drag.ended.emit({
        source: drag,
        distance: { x: 0, y: 0 },
        dropPoint: { x: 0, y: 0 },
        event: new MouseEvent('mouseup'),
      } as CdkDragEnd);
      fixture.detectChanges();

      expect(moved.length).toBe(1); // itemMoved emitido UNA sola vez
      expect(cardTitlesIn(0)).toEqual([]);
      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);
    });
  });

  describe('[corrección 4R CRITICAL] mover una tarjeta SOLO con teclado (extremo a extremo, sin drag) — Tests requeridos por el 4R', () => {
    function announce(): string {
      return (host().querySelector('.sol-kanban-board__announce') as HTMLElement).textContent ?? '';
    }

    beforeEach(() => {
      fixture.componentRef.setInput('columns', [
        { id: 'todo', title: 'Por hacer', items: [{ id: '1', title: 'Tarea A', status: 'active' }] },
        { id: 'done', title: 'Hecho', items: [{ id: '2', title: 'Tarea B', status: 'done' }] },
      ]);
      fixture.detectChanges();
    });

    it('[spec] foco en el select → elegir "mover a Hecho" → itemMoved emitido — MISMO KanbanReorderService/itemMoved que el drag', () => {
      const moved: KanbanItemMoved<DemoItem>[] = [];
      fixture.componentInstance.itemMoved.subscribe((e) => moved.push(e));

      const select = host().querySelector<HTMLSelectElement>('.sol-kanban-column__move-select')!;
      select.focus();
      expect(document.activeElement).toBe(select);

      select.value = 'to:done';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(moved).toEqual([
        { item: { id: '1', title: 'Tarea A', status: 'active' }, fromColumnId: 'todo', toColumnId: 'done', previousIndex: 0, currentIndex: 1 },
      ]);
      expect(cardTitlesIn(1)).toEqual(['Tarea B', 'Tarea A']);
    });

    it('[spec] la región `aria-live="polite"` anuncia el movimiento tras mover por teclado', () => {
      expect(announce()).toBe('');

      const select = host().querySelector<HTMLSelectElement>('.sol-kanban-column__move-select')!;
      select.value = 'to:done';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(announce()).toContain('movida a la columna');
    });

    it('la región `aria-live="polite"` también anuncia un movimiento hecho por DRAG real (mismo mecanismo)', () => {
      dropListOf('todo').dropped.emit(mockDrop(0, 1, 'todo', 'done'));
      fixture.detectChanges();

      expect(announce()).toContain('movida a la columna');
    });

    it('reordenar dentro de la MISMA columna por teclado ("Bajar") anuncia un texto distinto ("reordenada", no "movida a")', () => {
      fixture.componentRef.setInput('columns', [
        {
          id: 'todo',
          title: 'Por hacer',
          items: [
            { id: '1', title: 'A', status: 'active' },
            { id: '2', title: 'B', status: 'active' },
          ],
        },
      ]);
      fixture.detectChanges();

      const selects = Array.from(host().querySelectorAll<HTMLSelectElement>('.sol-kanban-column__move-select'));
      selects[0].value = 'down';
      selects[0].dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(announce()).toBe('Tarjeta reordenada dentro de la columna');
    });
  });
});

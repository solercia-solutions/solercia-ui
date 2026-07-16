import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolKanbanBoardComponent } from './kanban-board.component';
import type { KanbanColumn, KanbanColumnAction } from './kanban.model';

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
  `,
})
class TemplateHostComponent {
  readonly cardTemplate = viewChild.required<TemplateRef<unknown>>('card');
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
});

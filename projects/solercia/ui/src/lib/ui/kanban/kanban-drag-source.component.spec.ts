import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { SolKanbanDragSourceComponent } from './kanban-drag-source.component';

/**
 * Specs de `sol-kanban-drag-source` (11-g-crm-contactos-y-acciones, PR2 de
 * boki-front, T06) — origen de arrastre EXTERNO conectado a las columnas de
 * un `sol-kanban-board` ajeno. Sin conocimiento de dominio: se prueba con un
 * item genérico, igual que el resto de `ui/kanban/`.
 */

interface DemoContact {
  id: number;
  name: string;
}

@Component({
  standalone: true,
  template: `
    <ng-template #row let-item>
      <span class="demo-row-name">{{ item.name }}</span>
    </ng-template>
  `,
})
class TemplateHostComponent {
  readonly itemTemplate = viewChild.required<TemplateRef<{ $implicit: DemoContact }>>('row');
}

describe('SolKanbanDragSourceComponent', () => {
  let fixture: ComponentFixture<SolKanbanDragSourceComponent<DemoContact>>;
  let itemTemplate: TemplateRef<{ $implicit: DemoContact }>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  const items: DemoContact[] = [
    { id: 1, name: 'Laura' },
    { id: 2, name: 'Carlos' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TemplateHostComponent, SolKanbanDragSourceComponent],
    });
    const templateHost = TestBed.createComponent(TemplateHostComponent);
    templateHost.detectChanges();
    itemTemplate = templateHost.componentInstance.itemTemplate();

    fixture = TestBed.createComponent<SolKanbanDragSourceComponent<DemoContact>>(SolKanbanDragSourceComponent);
    fixture.componentRef.setInput('itemTemplate', itemTemplate);
  });

  it('renderiza un item arrastrable por cada elemento, proyectando el itemTemplate del consumidor', () => {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();

    const names = Array.from(host().querySelectorAll('.demo-row-name')).map(el => el.textContent);
    expect(names).toEqual(['Laura', 'Carlos']);
  });

  it('[robustez, mismo criterio que sol-kanban-board] items null/undefined no revienta el render', () => {
    expect(() => {
      fixture.componentRef.setInput('items', null);
      fixture.detectChanges();
    }).not.toThrow();
    expect(host().querySelectorAll('.demo-row-name').length).toBe(0);
  });

  it('cdkDropListConnectedTo se enlaza con los ids provistos (destino: columnas del board ajeno)', () => {
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('connectedTo', ['stage-1', 'stage-2']);
    fixture.detectChanges();

    const dropList = fixture.debugElement.query(By.directive(CdkDropList)).injector.get(CdkDropList);
    expect(dropList.connectedTo).toEqual(['stage-1', 'stage-2']);
  });

  it('cdkDragData de cada item ES el item completo (para que sol-kanban-board lo reenvíe en externalItemDropped)', () => {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();

    const drags = fixture.debugElement.queryAll(By.directive(CdkDrag)).map(de => de.injector.get(CdkDrag));
    expect(drags.map(d => d.data)).toEqual(items);
  });

  it('disabledIds deshabilita el cdkDrag del item correspondiente (paridad con el badge "ya en pipeline")', () => {
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('disabledIds', new Set([1]));
    fixture.detectChanges();

    const drags = fixture.debugElement.queryAll(By.directive(CdkDrag)).map(de => de.injector.get(CdkDrag));
    expect(drags[0].disabled).toBe(true);
    expect(drags[1].disabled).toBe(false);
  });

  it('un item con id duplicado no lanza NG0955 (track cae al índice, mismo criterio que sol-kanban-board)', () => {
    expect(() => {
      fixture.componentRef.setInput('items', [
        { id: 1, name: 'A' },
        { id: 1, name: 'B' },
      ]);
      fixture.detectChanges();
    }).not.toThrow();
  });
});

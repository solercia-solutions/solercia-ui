import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CdkDrag, type CdkDragStart, type CdkDragEnd } from '@angular/cdk/drag-drop';
import { SolKanbanCardComponent, type KanbanCardTemplateContext } from './kanban-card.component';

interface DemoItem {
  id: string;
  title: string;
  status: string;
}

/** Provee un `TemplateRef` real (Angular no permite construirlo a mano). */
@Component({
  standalone: true,
  template: `
    <ng-template #card let-item>
      <span class="demo-card-title">{{ item.title }}</span>
      <span class="demo-card-status">{{ item.status }}</span>
    </ng-template>
  `,
})
class TemplateHostComponent {
  readonly cardTemplate = viewChild.required<TemplateRef<KanbanCardTemplateContext<DemoItem>>>('card');
}

describe('SolKanbanCardComponent', () => {
  let fixture: ComponentFixture<SolKanbanCardComponent<DemoItem>>;

  /**
   * Call it BEFORE creating the component under test: without zone.js every fixture is attached
   * to ApplicationRef, so this detectChanges() would also check a card whose required inputs are
   * not set yet (NG0950).
   */
  function createTemplate(): TemplateRef<KanbanCardTemplateContext<DemoItem>> {
    const host = TestBed.createComponent(TemplateHostComponent);
    host.detectChanges();
    return host.componentInstance.cardTemplate();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TemplateHostComponent, SolKanbanCardComponent] });
  });

  it('[spec] board de dominio arbitrario: renderiza el contenido del template proyectado del consumidor sin cambios en la librería', () => {
    const cardTemplate = createTemplate();
    fixture = TestBed.createComponent<SolKanbanCardComponent<DemoItem>>(SolKanbanCardComponent);
    fixture.componentRef.setInput('item', { id: '1', title: 'Tarea de dominio arbitrario', status: 'active' });
    fixture.componentRef.setInput('cardTemplate', cardTemplate);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.demo-card-title')?.textContent).toBe('Tarea de dominio arbitrario');
    expect(host.querySelector('.demo-card-status')?.textContent).toBe('active');
  });

  describe('DnD (PR5b, T38/T39) — `cdkDrag` vía hostDirectives, sin que el consumidor lo escriba', () => {
    beforeEach(() => {
      const cardTemplate = createTemplate();
      fixture = TestBed.createComponent<SolKanbanCardComponent<DemoItem>>(SolKanbanCardComponent);
      fixture.componentRef.setInput('item', { id: '2', title: 'Otra tarea', status: 'done' });
      fixture.componentRef.setInput('cardTemplate', cardTemplate);
    });

    it('[spec] `cdkDrag` está aplicado al host (vía hostDirectives) sin que ningún template de consumidor lo escriba', () => {
      fixture.detectChanges();
      expect(() => fixture.debugElement.injector.get(CdkDrag)).not.toThrow();
    });

    it('el `data` del `CdkDrag` se sincroniza reactivamente con el `item` actual', () => {
      fixture.detectChanges();
      const drag = fixture.debugElement.injector.get(CdkDrag);
      expect(drag.data).toEqual({ id: '2', title: 'Otra tarea', status: 'done' });

      fixture.componentRef.setInput('item', { id: '3', title: 'Tarea nueva', status: 'active' });
      fixture.detectChanges();

      expect(drag.data).toEqual({ id: '3', title: 'Tarea nueva', status: 'active' });
    });

    it('`previewClass` queda fijo en "sol-kanban-card__drag-preview" (overlay rotado 2°+sombra, spec#UX de arrastre)', () => {
      fixture.detectChanges();
      const drag = fixture.debugElement.injector.get(CdkDrag);
      expect(drag.previewClass).toBe('sol-kanban-card__drag-preview');
    });

    it('el host NO expone ningún atributo `cdkdrag` literal (hostDirectives no lo agrega al DOM, a diferencia de escribirlo en un template)', () => {
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.hasAttribute('cdkdrag')).toBe(false);
    });

    it('[corrección 4R WARNING] emite `dragActiveChanged(true)` cuando `cdkDrag.started` dispara y `dragActiveChanged(false)` cuando `cdkDrag.ended` dispara', () => {
      fixture.detectChanges();
      const drag = fixture.debugElement.injector.get(CdkDrag);
      const changes: boolean[] = [];
      fixture.componentInstance.dragActiveChanged.subscribe((active) => changes.push(active));

      drag.started.emit({ source: drag, event: new MouseEvent('mousedown') } as CdkDragStart);
      expect(changes).toEqual([true]);

      drag.ended.emit({
        source: drag,
        distance: { x: 0, y: 0 },
        dropPoint: { x: 0, y: 0 },
        event: new MouseEvent('mouseup'),
      } as CdkDragEnd);
      expect(changes).toEqual([true, false]);
    });
  });
});

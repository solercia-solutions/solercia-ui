import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
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

  function createTemplate(): TemplateRef<KanbanCardTemplateContext<DemoItem>> {
    const host = TestBed.createComponent(TemplateHostComponent);
    host.detectChanges();
    return host.componentInstance.cardTemplate();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TemplateHostComponent, SolKanbanCardComponent] });
  });

  it('[spec] board de dominio arbitrario: renderiza el contenido del template proyectado del consumidor sin cambios en la librería', () => {
    fixture = TestBed.createComponent<SolKanbanCardComponent<DemoItem>>(SolKanbanCardComponent);
    fixture.componentRef.setInput('item', { id: '1', title: 'Tarea de dominio arbitrario', status: 'active' });
    fixture.componentRef.setInput('cardTemplate', createTemplate());
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.demo-card-title')?.textContent).toBe('Tarea de dominio arbitrario');
    expect(host.querySelector('.demo-card-status')?.textContent).toBe('active');
  });

  it('sin cdkDrag todavía (PR5a): el host no expone ningún atributo/directiva de arrastre', () => {
    fixture = TestBed.createComponent<SolKanbanCardComponent<DemoItem>>(SolKanbanCardComponent);
    fixture.componentRef.setInput('item', { id: '2', title: 'Otra tarea', status: 'done' });
    fixture.componentRef.setInput('cardTemplate', createTemplate());
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.hasAttribute('cdkdrag')).toBe(false);
  });
});

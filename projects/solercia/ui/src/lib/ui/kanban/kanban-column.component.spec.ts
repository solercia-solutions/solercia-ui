import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolKanbanColumnComponent } from './kanban-column.component';
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
});

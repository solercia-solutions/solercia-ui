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
});

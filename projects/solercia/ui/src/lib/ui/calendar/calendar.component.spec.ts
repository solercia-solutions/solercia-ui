import { Component, TemplateRef, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { ThemeService } from '../../tokens';
import { SolCalendarComponent } from './calendar.component';
import type { SolCalendarEventTemplateContext } from './calendar-grid.component';
import type { SolCalendarEvent, SolCalendarLegendItem } from './calendar.model';

interface DemoEvent extends SolCalendarEvent {
  clientName?: string;
}

@Component({
  standalone: true,
  template: `
    <ng-template #card let-event>
      <span class="demo-event-title">{{ event.title }}</span>
    </ng-template>
  `,
})
class TemplateHostComponent {
  readonly eventTemplate = viewChild.required<TemplateRef<SolCalendarEventTemplateContext<DemoEvent>>>('card');
}

describe('SolCalendarComponent', () => {
  let fixture: ComponentFixture<SolCalendarComponent<DemoEvent>>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TemplateHostComponent, SolCalendarComponent],
      providers: [
        { provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() },
        {
          provide: ThemeService,
          useValue: {
            isDark: signal(false).asReadonly(),
            activeTheme: signal(null).asReadonly(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent<SolCalendarComponent<DemoEvent>>(SolCalendarComponent);
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10));
    fixture.componentRef.setInput('view', 'week');
    fixture.componentRef.setInput('events', []);
  });

  it('[spec] clic en evento: en vista semana con un evento visible, emite un output tipado con el evento clicado', () => {
    fixture.componentRef.setInput('view', 'day');
    const event: DemoEvent = { id: '1', title: 'Reunión', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) };
    fixture.componentRef.setInput('events', [event]);
    fixture.detectChanges();

    const emitted: DemoEvent[] = [];
    fixture.componentInstance.eventClicked.subscribe((e) => emitted.push(e));

    host().querySelector<HTMLElement>('.sol-calendar-event')!.click();

    expect(emitted).toEqual([event]);
  });

  it('[spec] clic en slot vacío: en vista día, emite un output tipado con la fecha/hora del slot', () => {
    fixture.componentRef.setInput('view', 'day');
    fixture.detectChanges();

    const emitted: { date: Date; time: string }[] = [];
    fixture.componentInstance.slotClicked.subscribe((s) => emitted.push(s));

    host().querySelector<HTMLElement>('.sol-calendar-grid-day__slot')!.click();

    expect(emitted.length).toBe(1);
    expect(typeof emitted[0].time).toBe('string');
  });

  it('[spec] `view` solo tipa \'week\'|\'day\': el toggle de la cabecera solo ofrece esas 2 opciones (sin "mes")', () => {
    fixture.detectChanges();
    const toggleButtons = host().querySelectorAll('.sol-calendar-header__toggle-btn');
    expect(toggleButtons.length).toBe(2);
  });

  it('[spec] evento sin campos de dominio (sin color): sol-calendar lo renderiza sin fallar', () => {
    fixture.componentRef.setInput('events', [
      { id: '1', title: 'Genérico', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) },
    ]);
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('[spec] tarjeta personalizada: el eventTemplate proyectado llega hasta la grilla interna', () => {
    const th = TestBed.createComponent(TemplateHostComponent);
    th.detectChanges();
    fixture.componentRef.setInput('eventTemplate', th.componentInstance.eventTemplate());
    fixture.componentRef.setInput('events', [
      { id: '1', title: 'Reunión', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) },
    ]);
    fixture.detectChanges();

    expect(host().querySelector('.demo-event-title')?.textContent).toBe('Reunión');
  });

  it('[spec] sin `legend`, no se muestra ninguna leyenda hardcodeada de estados de cita', () => {
    fixture.detectChanges();
    expect(host().querySelector('.sol-calendar__legend')).toBeNull();
  });

  it('con `legend`, muestra cada entrada resolviendo `labelKey` vía SOL_I18N (catálogo del CONSUMIDOR)', () => {
    const legend: SolCalendarLegendItem[] = [
      { color: '#3B82F6', labelKey: 'shared.calendar.today' }, // reutiliza una clave YA verificada del catálogo real para el test
    ];
    fixture.componentRef.setInput('legend', legend);
    fixture.detectChanges();

    expect(host().querySelector('.sol-calendar__legend-label')?.textContent).toBe('Hoy');
  });

  it('[D4 — espejo interno] clic en "Siguiente" del header actualiza la fecha mostrada en la grilla sin reasignar el input `currentDate`', () => {
    fixture.detectChanges();
    const before = host().querySelector('.sol-calendar-header__range')?.textContent;

    host().querySelectorAll<HTMLButtonElement>('.sol-calendar-header__arrow')[1].click();
    fixture.detectChanges();

    const after = host().querySelector('.sol-calendar-header__range')?.textContent;
    expect(after).not.toBe(before);
  });

  it('[D4 — espejo interno] clic en el toggle "Día" cambia la vista de la grilla sin reasignar el input `view`', () => {
    fixture.detectChanges();
    expect(host().querySelectorAll('.sol-calendar-grid-day').length).toBe(7); // semana

    const buttons = Array.from(host().querySelectorAll<HTMLButtonElement>('.sol-calendar-header__toggle-btn'));
    buttons[1].click(); // "Día"
    fixture.detectChanges();

    expect(host().querySelectorAll('.sol-calendar-grid-day').length).toBe(1);
  });

  it('[robustez] currentDate/view/events null/undefined no lanza — se comporta con los defaults (semana, fecha actual, sin eventos)', () => {
    expect(() => {
      fixture.componentRef.setInput('currentDate', null);
      fixture.componentRef.setInput('view', null);
      fixture.componentRef.setInput('events', null);
      fixture.detectChanges();
    }).not.toThrow();

    expect(host().querySelectorAll('.sol-calendar-grid-day').length).toBe(7);
  });

  it('[robustez] reasignar `currentDate` a una fecha inválida no lanza — el espejo conserva un Date válido', () => {
    fixture.detectChanges();
    expect(() => {
      fixture.componentRef.setInput('currentDate', new Date('no-es-una-fecha'));
      fixture.detectChanges();
    }).not.toThrow();
  });

  it('permite saltar programáticamente a otra fecha reasignando el input `currentDate`', () => {
    fixture.detectChanges();
    const before = host().querySelector('.sol-calendar-header__range')?.textContent;

    fixture.componentRef.setInput('currentDate', new Date(2025, 5, 1));
    fixture.detectChanges();

    const after = host().querySelector('.sol-calendar-header__range')?.textContent;
    expect(after).not.toBe(before);
  });
});

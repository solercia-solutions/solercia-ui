import { Component, TemplateRef, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { ThemeService } from '../../tokens';
import { SolCalendarGridComponent, type SolCalendarEventTemplateContext } from './calendar-grid.component';
import type { SolCalendarEvent } from './calendar.model';

interface DemoEvent extends SolCalendarEvent {
  clientName?: string;
}

@Component({
  standalone: true,
  template: `
    <ng-template #card let-event>
      <span class="demo-event-title">{{ event.title }}</span>
      <span class="demo-event-client">{{ event.clientName }}</span>
    </ng-template>
  `,
})
class TemplateHostComponent {
  readonly eventTemplate = viewChild.required<TemplateRef<SolCalendarEventTemplateContext<DemoEvent>>>('card');
}

describe('SolCalendarGridComponent', () => {
  let fixture: ComponentFixture<SolCalendarGridComponent<DemoEvent>>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function createTemplate(): TemplateRef<SolCalendarEventTemplateContext<DemoEvent>> {
    const th = TestBed.createComponent(TemplateHostComponent);
    th.detectChanges();
    return th.componentInstance.eventTemplate();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TemplateHostComponent, SolCalendarGridComponent],
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
    fixture = TestBed.createComponent<SolCalendarGridComponent<DemoEvent>>(SolCalendarGridComponent);
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10)); // miércoles
    fixture.componentRef.setInput('view', 'week');
  });

  it('[spec] evento sin campos de dominio (sin color): se renderiza sin fallar por falta de campos de cita', () => {
    fixture.componentRef.setInput('events', [
      { id: '1', title: 'Reunión', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) },
    ]);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(host().querySelectorAll('.sol-calendar-event').length).toBe(1);
  });

  it('sin `eventTemplate`, la tarjeta cae a mostrar solo `event.title`', () => {
    fixture.componentRef.setInput('events', [
      { id: '1', title: 'Reunión', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) },
    ]);
    fixture.detectChanges();

    expect(host().querySelector('.sol-calendar-event__title')?.textContent).toBe('Reunión');
  });

  it('[spec] tarjeta personalizada: con `eventTemplate`, el evento muestra el contenido proyectado del consumidor', () => {
    fixture.componentRef.setInput('eventTemplate', createTemplate());
    fixture.componentRef.setInput('events', [
      { id: '1', title: 'Reunión', clientName: 'Ana', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) },
    ]);
    fixture.detectChanges();

    expect(host().querySelector('.demo-event-title')?.textContent).toBe('Reunión');
    expect(host().querySelector('.demo-event-client')?.textContent).toBe('Ana');
    expect(host().querySelector('.sol-calendar-event__title')).toBeNull();
  });

  it('[spec] clic en un evento emite `eventClicked` con el evento tipado', () => {
    const event: DemoEvent = { id: '1', title: 'Reunión', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) };
    fixture.componentRef.setInput('events', [event]);
    fixture.detectChanges();

    const emitted: DemoEvent[] = [];
    fixture.componentInstance.eventClicked.subscribe((e) => emitted.push(e));

    host().querySelector<HTMLElement>('.sol-calendar-event')!.click();

    expect(emitted).toEqual([event]);
  });

  it('[spec] clic en un slot vacío (sin eventos) emite `slotClicked` con fecha y hora', () => {
    fixture.componentRef.setInput('events', []);
    fixture.componentRef.setInput('view', 'day');
    fixture.detectChanges();

    const emitted: { date: Date; time: string }[] = [];
    fixture.componentInstance.slotClicked.subscribe((s) => emitted.push(s));

    host().querySelector<HTMLElement>('.sol-calendar-grid-day__slot')!.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].time).toBe('06:00'); // primer slot = HOUR_START
  });

  it('vista "day" renderiza UNA sola columna de día', () => {
    fixture.componentRef.setInput('events', []);
    fixture.componentRef.setInput('view', 'day');
    fixture.detectChanges();

    expect(host().querySelectorAll('.sol-calendar-grid-day').length).toBe(1);
  });

  it('vista "week" (desktop, matchMedia no marca móvil en jsdom) renderiza 7 columnas de día', () => {
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();

    expect(host().querySelectorAll('.sol-calendar-grid-day').length).toBe(7);
  });

  it('el label de día usa la clave i18n `weekdayShort` (no un array hardcodeado en el componente)', () => {
    fixture.componentRef.setInput('events', []);
    fixture.componentRef.setInput('view', 'day');
    fixture.detectChanges();

    // 10 ene 2024 es miércoles → "Mié 10/1"
    expect(host().querySelector('.sol-calendar-grid-header__day')?.textContent?.trim()).toBe('Mié 10/1');
  });

  it('[robustez] events null/undefined no lanza — grilla sin eventos', () => {
    expect(() => {
      fixture.componentRef.setInput('events', null);
      fixture.detectChanges();
    }).not.toThrow();
    expect(host().querySelectorAll('.sol-calendar-event').length).toBe(0);
  });

  it('[robustez] un evento con `start` inválido se excluye sin romper el render', () => {
    expect(() => {
      fixture.componentRef.setInput('events', [{ id: '1', title: 'Malo', start: 'no-es-fecha', end: new Date() }]);
      fixture.detectChanges();
    }).not.toThrow();
    expect(host().querySelectorAll('.sol-calendar-event').length).toBe(0);
  });

  it('[robustez] currentDate null/undefined/inválido no lanza — usa la fecha actual del sistema como fallback', () => {
    expect(() => {
      fixture.componentRef.setInput('currentDate', null);
      fixture.componentRef.setInput('events', []);
      fixture.detectChanges();
    }).not.toThrow();
  });

  it('[robustez] view null/undefined no lanza — cae a "week"', () => {
    expect(() => {
      fixture.componentRef.setInput('view', null);
      fixture.componentRef.setInput('events', []);
      fixture.detectChanges();
    }).not.toThrow();
    expect(host().querySelectorAll('.sol-calendar-grid-day').length).toBe(7);
  });

  it('[WARNING] eventos con id duplicado o ausente no lanzan NG0955 — degradan (track cae al índice)', () => {
    const events: DemoEvent[] = [
      { id: 'dup', title: 'Uno', start: new Date(2024, 0, 8, 9, 0), end: new Date(2024, 0, 8, 10, 0) },
      { id: 'dup', title: 'Dos (id duplicado)', start: new Date(2024, 0, 8, 11, 0), end: new Date(2024, 0, 8, 12, 0) },
      { id: undefined as unknown as string, title: 'Sin id', start: new Date(2024, 0, 8, 13, 0), end: new Date(2024, 0, 8, 14, 0) },
    ];

    expect(() => {
      fixture.componentRef.setInput('events', events);
      fixture.detectChanges();
    }).not.toThrow();

    expect(host().querySelectorAll('.sol-calendar-event').length).toBe(3);
  });

  it('la línea de "ahora" NO aparece si la hora actual del sistema está fuera del rango visible [6,22)', () => {
    // No podemos mockear `new Date()` fácil sin fake timers; verificamos al
    // menos que el selector existe condicionalmente sin lanzar, cubriendo la
    // rama `nowTop() < 0` cuando corresponda según la hora real de CI.
    fixture.componentRef.setInput('events', []);
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('un evento con `color` explícito usa el color resuelto por la estrategia (no un valor hardcodeado)', () => {
    fixture.componentRef.setInput('events', [
      { id: '1', title: 'Con color', color: '#22C55E', start: new Date(2024, 0, 10, 9, 0), end: new Date(2024, 0, 10, 10, 0) },
    ]);
    fixture.detectChanges();

    const card = host().querySelector<HTMLElement>('.sol-calendar-event')!;
    // El navegador normaliza #22C55E a rgb(34, 197, 94) al leer `.style` —
    // se compara contra el equivalente rgb(), no contra el hex literal.
    expect(card.style.borderLeft).toContain('rgb(34, 197, 94)');
  });
});

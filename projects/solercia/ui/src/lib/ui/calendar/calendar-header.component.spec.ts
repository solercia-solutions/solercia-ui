import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolCalendarHeaderComponent } from './calendar-header.component';
import type { SolCalendarView } from './calendar.model';

describe('SolCalendarHeaderComponent', () => {
  let fixture: ComponentFixture<SolCalendarHeaderComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolCalendarHeaderComponent],
      providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
    });
    fixture = TestBed.createComponent(SolCalendarHeaderComponent);
  });

  it('vista "day": el rango muestra día de semana + fecha + mes por clave i18n', () => {
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10)); // miércoles 10 ene 2024
    fixture.componentRef.setInput('view', 'day');
    fixture.detectChanges();

    expect(host().querySelector('.sol-calendar-header__range')?.textContent).toBe('Mié 10 ene');
  });

  it('vista "week": el rango muestra lunes–domingo de la semana con el mes por clave i18n', () => {
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10)); // miércoles
    fixture.componentRef.setInput('view', 'week');
    fixture.detectChanges();

    expect(host().querySelector('.sol-calendar-header__range')?.textContent).toBe('8 ene – 14 ene');
  });

  it('[spec] clic en "Siguiente" en vista semana avanza 7 días y emite dateChange', () => {
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10));
    fixture.componentRef.setInput('view', 'week');
    fixture.detectChanges();

    const emitted: Date[] = [];
    fixture.componentInstance.dateChange.subscribe((d) => emitted.push(d));

    host().querySelectorAll<HTMLButtonElement>('.sol-calendar-header__arrow')[1].click();

    expect(emitted[0].getDate()).toBe(17);
  });

  it('clic en "Anterior" en vista día retrocede 1 día', () => {
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10));
    fixture.componentRef.setInput('view', 'day');
    fixture.detectChanges();

    const emitted: Date[] = [];
    fixture.componentInstance.dateChange.subscribe((d) => emitted.push(d));

    host().querySelectorAll<HTMLButtonElement>('.sol-calendar-header__arrow')[0].click();

    expect(emitted[0].getDate()).toBe(9);
  });

  it('[spec] clic en "Hoy" emite dateChange con la fecha actual del sistema', () => {
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10));
    fixture.componentRef.setInput('view', 'week');
    fixture.detectChanges();

    const emitted: Date[] = [];
    fixture.componentInstance.dateChange.subscribe((d) => emitted.push(d));

    host().querySelector<HTMLButtonElement>('.sol-calendar-header__today')!.click();

    const now = new Date();
    expect(emitted[0].getDate()).toBe(now.getDate());
  });

  it('[spec] clic en el toggle "Día" emite viewChange("day")', () => {
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10));
    fixture.componentRef.setInput('view', 'week');
    fixture.detectChanges();

    const emitted: SolCalendarView[] = [];
    fixture.componentInstance.viewChange.subscribe((v) => emitted.push(v));

    const buttons = Array.from(host().querySelectorAll<HTMLButtonElement>('.sol-calendar-header__toggle-btn'));
    buttons[1].click();

    expect(emitted).toEqual(['day']);
  });

  it('el botón de vista activa refleja `view()` con la clase --active', () => {
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10));
    fixture.componentRef.setInput('view', 'day');
    fixture.detectChanges();

    const buttons = Array.from(host().querySelectorAll<HTMLButtonElement>('.sol-calendar-header__toggle-btn'));
    expect(buttons[0].classList.contains('sol-calendar-header__toggle-btn--active')).toBe(false);
    expect(buttons[1].classList.contains('sol-calendar-header__toggle-btn--active')).toBe(true);
  });

  it('[robustez] currentDate null/undefined no lanza — el rango queda vacío y la navegación no emite', () => {
    fixture.componentRef.setInput('currentDate', null);
    fixture.componentRef.setInput('view', 'week');

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(host().querySelector('.sol-calendar-header__range')?.textContent).toBe('');

    const emitted: Date[] = [];
    fixture.componentInstance.dateChange.subscribe((d) => emitted.push(d));
    host().querySelectorAll<HTMLButtonElement>('.sol-calendar-header__arrow')[1].click();
    expect(emitted).toEqual([]);
  });

  it('[robustez] currentDate = fecha inválida (Invalid Date) no lanza — degrada igual que null', () => {
    fixture.componentRef.setInput('currentDate', new Date('no-es-una-fecha'));
    fixture.componentRef.setInput('view', 'week');

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(host().querySelector('.sol-calendar-header__range')?.textContent).toBe('');
  });

  it('[robustez] view null/undefined no lanza — el rango cae al formato de semana por defecto', () => {
    fixture.componentRef.setInput('currentDate', new Date(2024, 0, 10));
    fixture.componentRef.setInput('view', null);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(host().querySelector('.sol-calendar-header__range')?.textContent).toBe('8 ene – 14 ene');
  });
});

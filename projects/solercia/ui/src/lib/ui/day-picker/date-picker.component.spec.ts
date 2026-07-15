import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolDatePickerComponent } from './date-picker.component';

/**
 * Specs de `sol-date-picker` (E8): calendario propio con tres vistas
 * (días/meses/años), navegación, min/max y ControlValueAccessor.
 * El I18nService se mockea igual que en `sol-stepper` para no arrastrar
 * Transloco real; los nombres de mes/día se derivan de Intl('es-CO').
 */
describe('SolDatePickerComponent', () => {
  let fixture: ComponentFixture<SolDatePickerComponent>;
  let component: SolDatePickerComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolDatePickerComponent],
      providers: [
        {
          provide: SOL_I18N,
          useValue: {
            activeLang: signal('es-CO'),
            translate: (key: string) => key,
            t: (key: string) => signal(key),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(SolDatePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Aplana las 6 semanas en una sola lista de celdas de día. */
  function flatDays() {
    return component.weeks().flat();
  }

  it('arranca en la vista DÍAS y el encabezado muestra el año', () => {
    expect(component.view()).toBe('days');
    // Abre para fijar el mes visible a partir de una fecha conocida.
    component.writeValue('2026-07-15');
    component.open();
    expect(component.headerLabel()).toContain('2026');
    // Semana lunes→domingo: 7 etiquetas de día.
    fixture.detectChanges();
    expect(root().querySelectorAll('.sol-date-picker__weekday').length).toBe(7);
  });

  it('cambia de vista días → meses → años y vuelve al elegir', () => {
    component.writeValue('2026-07-15');
    component.open();
    expect(component.view()).toBe('days');

    // El encabezado promueve a MESES y luego a AÑOS.
    component.promoteView();
    expect(component.view()).toBe('months');
    expect(component.headerLabel()).toBe('2026');
    expect(component.months().length).toBe(12);

    component.promoteView();
    expect(component.view()).toBe('years');
    expect(component.headerLabel()).toBe('2020 – 2029');
    expect(component.years().length).toBe(12);

    // Elegir un año vuelve a MESES en ese año.
    component.pickYear(2030);
    expect(component.view()).toBe('months');
    expect(component.headerLabel()).toBe('2030');

    // Elegir un mes vuelve a DÍAS en ese mes (junio = índice 5).
    component.pickMonth(5);
    expect(component.view()).toBe('days');
    expect(component.headerLabel()).toContain('2030');
  });

  it('navega mes / año / década con las flechas del encabezado', () => {
    component.writeValue('2026-07-15');
    component.open(); // DÍAS, julio 2026

    const julyLabel = component.headerLabel();
    component.goPrev();
    expect(component.headerLabel()).not.toBe(julyLabel); // mes anterior
    component.goNext();
    expect(component.headerLabel()).toBe(julyLabel); // vuelve a julio

    // MESES: las flechas cambian de año.
    component.promoteView();
    expect(component.headerLabel()).toBe('2026');
    component.goNext();
    expect(component.headerLabel()).toBe('2027');
    component.goPrev();
    expect(component.headerLabel()).toBe('2026');

    // AÑOS: las flechas cambian de década.
    component.promoteView();
    expect(component.headerLabel()).toBe('2020 – 2029');
    component.goNext();
    expect(component.headerLabel()).toBe('2030 – 2039');
    component.goPrev();
    expect(component.headerLabel()).toBe('2020 – 2029');
  });

  it('renderiza 12 celdas en las vistas de meses y años', () => {
    component.open();

    component.promoteView(); // meses
    fixture.detectChanges();
    expect(root().querySelectorAll('.sol-date-picker__cell').length).toBe(12);

    component.promoteView(); // años
    fixture.detectChanges();
    expect(root().querySelectorAll('.sol-date-picker__cell').length).toBe(12);
  });

  it('seleccionar un día emite yyyy-MM-dd, cierra y actualiza el display', () => {
    const emitted: string[] = [];
    component.valueChange.subscribe(v => emitted.push(v));
    const changes: string[] = [];
    component.registerOnChange(v => changes.push(v));

    component.open();
    component.pickDay(new Date(2026, 6, 15)); // 15 de julio de 2026

    expect(emitted).toEqual(['2026-07-15']);
    expect(changes).toEqual(['2026-07-15']);
    expect(component.isOpen()).toBe(false);
    const display = component.displayText();
    expect(display).toContain('15');
    expect(display).toContain('07');
    expect(display).toContain('2026');
  });

  it('respeta min / max: deshabilita días fuera de rango y no los selecciona', () => {
    component.writeValue('2026-07-15');
    fixture.componentRef.setInput('min', '2026-07-10');
    fixture.componentRef.setInput('max', '2026-07-20');
    fixture.detectChanges();
    component.open();

    const byIso = (iso: string) => flatDays().find(c => c.iso === iso)!;
    expect(byIso('2026-07-05').disabled).toBe(true); // antes de min
    expect(byIso('2026-07-15').disabled).toBe(false); // dentro
    expect(byIso('2026-07-25').disabled).toBe(true); // después de max

    // Intentar elegir un día fuera de rango no emite ni cambia el valor.
    const emitted: string[] = [];
    component.valueChange.subscribe(v => emitted.push(v));
    component.pickDay(new Date(2026, 6, 25));
    expect(emitted).toEqual([]);
  });

  it('CVA: writeValue escribe el display y null lo limpia', () => {
    component.writeValue('2026-03-08');
    let display = component.displayText();
    expect(display).toContain('08');
    expect(display).toContain('03');
    expect(display).toContain('2026');

    component.writeValue(null);
    expect(component.displayText()).toBe('');
  });

  it('CVA: input `value` enlazado sincroniza el display vía effect', () => {
    fixture.componentRef.setInput('value', '2026-01-20');
    fixture.detectChanges();
    const display = component.displayText();
    expect(display).toContain('20');
    expect(display).toContain('01');
    expect(display).toContain('2026');
  });

  it('CVA: setDisabledState bloquea la apertura del popover', () => {
    component.setDisabledState(true);
    expect(component.isDisabled()).toBe(true);
    component.open();
    expect(component.isOpen()).toBe(false);
  });

  it('los nombres de la semana empiezan en lunes (convención es-CO)', () => {
    const labels = component.weekdayLabels();
    expect(labels.length).toBe(7);
    // El primero corresponde a lunes y el último a domingo.
    expect(labels[0].toLowerCase()).toContain('l'); // lun
    expect(labels[6].toLowerCase()).toContain('d'); // dom
  });
});

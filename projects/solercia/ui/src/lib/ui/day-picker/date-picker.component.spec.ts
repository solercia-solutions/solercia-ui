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

  /**
   * Raíz de consulta del contenido del popover: desde la migración a la
   * directiva `solFloatingPanel` el panel se portalea a `document.body`, así
   * que deja de ser descendiente del host del componente.
   */
  function pop(): HTMLElement {
    return document.body;
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
    expect(pop().querySelectorAll('.sol-date-picker__weekday').length).toBe(7);
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
    expect(pop().querySelectorAll('.sol-date-picker__cell').length).toBe(12);

    component.promoteView(); // años
    fixture.detectChanges();
    expect(pop().querySelectorAll('.sol-date-picker__cell').length).toBe(12);
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

/**
 * Specs del fix de zoom móvil (11-f PR1) sobre `.sol-date-picker__input`
 * (campo readonly, ajuste defensivo). El fix vive dentro del `styles`
 * inline del componente; Angular lo inserta como `<style>` real en
 * `document.head` (encapsulación emulada), así que se verifica ahí en vez
 * de mockear `matchMedia` (jsdom no evalúa layout).
 */
describe('SolDatePickerComponent — fix de zoom móvil (11-f PR1)', () => {
  let fixture: ComponentFixture<SolDatePickerComponent>;

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
    fixture.detectChanges();
  });

  function headStyles(): string {
    return Array.from(document.head.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
  }

  /** Extrae el bloque `@media (max-width: 640px) { ... }` completo (una sola anidación). */
  function mobileMediaBlock(css: string): string {
    const start = css.indexOf('@media (max-width: 640px)');
    expect(start).toBeGreaterThan(-1);
    const openBrace = css.indexOf('{', start);
    let depth = 0;
    let i = openBrace;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      if (css[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    return css.slice(start, i + 1);
  }

  it('enfocar en iOS Safari no dispara zoom: .sol-date-picker__input llega a font-size:16px dentro de @media (max-width:640px)', () => {
    const block = mobileMediaBlock(headStyles());
    expect(block).toContain('.sol-date-picker__input');
    expect(block).toMatch(/font-size:\s*16px/);
  });

  it('escritorio sin cambios: fuera del breakpoint móvil .sol-date-picker__input conserva el token --sol-dp-font-size', () => {
    const css = headStyles();
    const outsideMedia = css.replace(mobileMediaBlock(css), '');
    expect(outsideMedia).toMatch(
      /\.sol-date-picker__input(\[[^\]]*\])?\s*\{[^}]*font-size:\s*var\(--sol-dp-font-size\)/,
    );
  });

  it('modo oscuro conserva sus tokens: el bloque móvil solo cambia font-size, ningún color/token', () => {
    const block = mobileMediaBlock(headStyles());
    expect(block).not.toMatch(/color:/);
    expect(block).not.toMatch(/background/);
    expect(block).not.toMatch(/border/);
  });

  it('variante size="sm" también llega a 16px en móvil: el bloque @media incluye .sol-date-picker--sm .sol-date-picker__input (evita que la regla --sm de mayor especificidad gane la cascada)', () => {
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    const block = mobileMediaBlock(headStyles());
    // Angular con ViewEncapsulation.Emulated inserta [_ngcontent-xxx] tras cada
    // parte del selector compuesto, así que se tolera ese atributo y espacios extra.
    expect(block).toMatch(/\.sol-date-picker--sm(\[[^\]]*\])?\s+\.sol-date-picker__input(\[[^\]]*\])?\s*\{[^}]*font-size:\s*16px/);
  });
});

/**
 * Specs del portal del popover a `document.body` vía la directiva compartida
 * `solFloatingPanel`: el calendario debe flotar por encima de un `sol-modal`
 * o un `sol-drawer` sin que sus contenedores con `overflow`/`backdrop-filter`
 * lo recorten. Se verifica el contrato observable (padre, `position`, ausencia
 * de nodo huérfano y capa por encima del modal), no el cálculo de layout, que
 * jsdom no evalúa.
 */
describe('SolDatePickerComponent — portal del popover a document.body', () => {
  let fixture: ComponentFixture<SolDatePickerComponent>;
  let component: SolDatePickerComponent;

  /** Rectángulo del campo con espacio de sobra hacia abajo y a la derecha. */
  const FIELD_RECT: DOMRect = {
    x: 24, y: 120, left: 24, top: 120, right: 264, bottom: 160,
    width: 240, height: 40,
    toJSON: () => ({}),
  } as DOMRect;

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

  function field(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.sol-date-picker__field')!;
  }

  function popover(): HTMLElement | null {
    return document.querySelector('.sol-date-picker__pop');
  }

  function mockFieldRect(rect: DOMRect = FIELD_RECT): void {
    field().getBoundingClientRect = () => rect;
  }

  function openPopover(rect: DOMRect = FIELD_RECT): void {
    mockFieldRect(rect);
    component.open();
    fixture.detectChanges();
  }

  it('al abrir, el popover queda como hijo directo de document.body con position fixed', () => {
    openPopover();

    const el = popover();
    expect(el).not.toBeNull();
    expect(el!.parentElement).toBe(document.body);
    expect(el!.style.position).toBe('fixed');
    // Anclado bajo el campo: top = bottom del campo + 4px de separación.
    expect(el!.style.top).toBe('164px');
  });

  it('conserva su ancho propio: la directiva no le impone el del disparador', () => {
    openPopover();

    // matchTriggerWidth:false ⇒ no se escribe width inline (el calendario mide 300px por CSS).
    expect(popover()!.style.width).toBe('');
  });

  it('queda por encima del modal: aplica la clase compartida .sol-floating-panel', () => {
    openPopover();

    expect(popover()!.classList.contains('sol-floating-panel')).toBe(true);
    const shared = Array.from(document.head.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
    expect(shared).toContain('.sol-floating-panel');
    expect(shared).toContain('calc(var(--sol-z-modal, 1050) + 10)');
  });

  it('al cerrar no queda nodo huérfano en document.body', () => {
    openPopover();
    expect(popover()).not.toBeNull();

    component.close();
    fixture.detectChanges();

    expect(popover()).toBeNull();
    expect(document.body.querySelectorAll('.sol-date-picker__pop').length).toBe(0);
  });

  it('al destruir el componente con el popover abierto no queda nodo huérfano', () => {
    openPopover();
    expect(popover()).not.toBeNull();

    fixture.destroy();

    expect(document.body.querySelectorAll('.sol-date-picker__pop').length).toBe(0);
  });

  it('conserva el flip: sin espacio abajo abre hacia arriba anclado por bottom', () => {
    const nearBottom = {
      ...FIELD_RECT,
      top: window.innerHeight - 60,
      bottom: window.innerHeight - 20,
      toJSON: () => ({}),
    } as DOMRect;
    openPopover(nearBottom);

    const el = popover()!;
    expect(component.dropUp()).toBe(true);
    expect(el.style.top).toBe('auto');
    expect(el.style.bottom).toBe(`${window.innerHeight - nearBottom.top + 4}px`);
    expect(el.className).toContain('sol-date-picker__pop--up');
  });

  it('reposiciona en scroll (captura) mientras está abierto', () => {
    openPopover();
    expect(popover()!.style.top).toBe('164px');

    // El campo "se movió" por el scroll de un ancestro (ej. .sol-modal-body).
    mockFieldRect({ ...FIELD_RECT, top: 40, bottom: 80, toJSON: () => ({}) } as DOMRect);
    window.dispatchEvent(new Event('scroll'));

    expect(popover()!.style.top).toBe('84px');
  });

  it('clic dentro del popover portaleado no cierra el calendario', () => {
    openPopover();

    const nav = popover()!.querySelector('.sol-date-picker__nav') as HTMLElement;
    nav.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
  });
});

import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import {
  SolProgressBarComponent,
  type SolProgressMode,
  type SolProgressSize,
  type SolProgressVariant,
} from './progress-bar.component';

/**
 * Specs de `sol-progress-bar`. Cubren: modo continuo (llenado + recorte),
 * modo segmentado (segmentos activos), etiquetas (%, "Paso X de N", override),
 * variantes/tamaño y accesibilidad (role + aria-value*).
 *
 * El mock de I18nService devuelve la clave tal cual (como Transloco ante una
 * clave ausente) para ejercitar los textos por defecto es-CO del componente.
 */
describe('SolProgressBarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOL_I18N,
          useValue: {
            activeLang: signal('es-CO'),
            translate: (key: string) => key,
          },
        },
      ],
    });
  });

  function create(
    inputs: Partial<{
      mode: SolProgressMode;
      value: number;
      max: number;
      steps: number;
      current: number;
      size: SolProgressSize;
      variant: SolProgressVariant;
      showLabel: boolean;
      label: string;
      ariaLabel: string;
    }> = {},
  ): ComponentFixture<SolProgressBarComponent> {
    const fixture = TestBed.createComponent(SolProgressBarComponent);
    for (const [key, val] of Object.entries(inputs)) {
      if (val !== undefined) fixture.componentRef.setInput(key, val);
    }
    fixture.detectChanges();
    return fixture;
  }

  function el(fixture: ComponentFixture<SolProgressBarComponent>, sel: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(sel) as HTMLElement;
  }

  it('modo continuo: llena la barra al porcentaje y expone role/aria', () => {
    const fixture = create({ value: 50, max: 100 });
    const bar = el(fixture, '.sol-progress__track');
    const fill = el(fixture, '.sol-progress__fill');

    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(fill.style.width).toBe('50%');
  });

  it('modo continuo: recorta valores fuera de rango a [0, max]', () => {
    const over = create({ value: 150, max: 100 });
    expect(el(over, '.sol-progress__fill').style.width).toBe('100%');

    const under = create({ value: -20, max: 100 });
    expect(el(under, '.sol-progress__fill').style.width).toBe('0%');
  });

  it('modo continuo: respeta un max personalizado', () => {
    const fixture = create({ value: 1, max: 4 });
    expect(el(fixture, '.sol-progress__fill').style.width).toBe('25%');
    expect(el(fixture, '.sol-progress__track').getAttribute('aria-valuemax')).toBe('4');
  });

  it('modo segmentado: pinta activos los segmentos hasta current (incluido)', () => {
    const fixture = create({ mode: 'segmented', steps: 4, current: 1 });
    const segments = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.sol-progress__segment'),
    );

    expect(segments.length).toBe(4);
    expect(segments[0].classList).toContain('is-active');
    expect(segments[1].classList).toContain('is-active');
    expect(segments[2].classList).not.toContain('is-active');
    expect(segments[3].classList).not.toContain('is-active');

    const container = el(fixture, '.sol-progress__segments');
    expect(container.getAttribute('role')).toBe('progressbar');
    expect(container.getAttribute('aria-valuemax')).toBe('4');
    expect(container.getAttribute('aria-valuenow')).toBe('2');
  });

  it('etiqueta continua: muestra el porcentaje cuando showLabel es true', () => {
    const fixture = create({ value: 50, max: 100, showLabel: true });
    expect(el(fixture, '.sol-progress__label').textContent).toContain('50 %');
  });

  it('etiqueta segmentada: muestra "Paso X de N" (default es-CO)', () => {
    const fixture = create({ mode: 'segmented', steps: 4, current: 1, showLabel: true });
    expect(el(fixture, '.sol-progress__label').textContent).toContain('Paso 2 de 4');
  });

  it('el override de label tiene prioridad sobre el texto derivado', () => {
    const fixture = create({ value: 50, showLabel: true, label: 'Casi listo' });
    expect(el(fixture, '.sol-progress__label').textContent).toContain('Casi listo');
  });

  it('expone aria-valuetext aunque la etiqueta visible esté oculta', () => {
    const fixture = create({ mode: 'segmented', steps: 3, current: 0 });
    expect(fixture.nativeElement.querySelector('.sol-progress__label')).toBeNull();
    expect(el(fixture, '.sol-progress__segments').getAttribute('aria-valuetext')).toContain(
      'Paso 1 de 3',
    );
  });

  it('aplica las clases de variante y tamaño', () => {
    const fixture = create({ variant: 'success', size: 'lg' });
    const root = el(fixture, '.sol-progress');
    expect(root.classList).toContain('sol-progress--success');
    expect(root.classList).toContain('sol-progress--lg');
  });

  it('modo segmentado con steps 0: no renderiza segmentos', () => {
    const fixture = create({ mode: 'segmented', steps: 0 });
    const segments = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.sol-progress__segment',
    );
    expect(segments.length).toBe(0);
  });
});

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import {
  SolWizardComponent,
  SolWizardStepDirective,
  type SolWizardStep,
  type SolWizardCanAdvance,
} from './wizard.component';

/**
 * Specs de `sol-wizard`. Cubren: render de pills (reusa `sol-stepper`) y de
 * la barra de fases (`sol-progress-bar`), navegación con "Anterior"/"Siguiente",
 * "Finalizar" en el último paso, `canAdvance` (bool y predicado), retroceso por
 * pill, proyección `*solWizardStep`, fallback `<ng-content>`, textos es-CO y
 * overrides.
 *
 * El mock de I18nService devuelve la clave tal cual (Transloco ante clave
 * ausente): así se ejercitan los textos por defecto y las etiquetas literales.
 */

const STEPS: SolWizardStep[] = [
  { id: 'a', label: 'Servicios' },
  { id: 'b', label: 'Detalles' },
  { id: 'c', label: 'Confirmar' },
];

/** Host mínimo para probar la proyección de pasos con `*solWizardStep`. */
@Component({
  standalone: true,
  imports: [SolWizardComponent, SolWizardStepDirective],
  template: `
    <sol-wizard [steps]="steps" [(current)]="current">
      <ng-container *solWizardStep><p class="panel-1">Uno</p></ng-container>
      <ng-container *solWizardStep><p class="panel-2">Dos</p></ng-container>
      <ng-container *solWizardStep><p class="panel-3">Tres</p></ng-container>
    </sol-wizard>
  `,
})
class ProjectionHostComponent {
  steps = STEPS;
  current = 0;
}

/** Host sin plantillas de paso: debe caer al `<ng-content>` único. */
@Component({
  standalone: true,
  imports: [SolWizardComponent],
  template: `
    <sol-wizard [steps]="steps" [(current)]="current">
      <p class="fallback">Contenido único</p>
    </sol-wizard>
  `,
})
class FallbackHostComponent {
  steps = STEPS;
  current = 0;
}

describe('SolWizardComponent', () => {
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
      steps: SolWizardStep[];
      current: number;
      canAdvance: SolWizardCanAdvance;
      hidePreviousOnFirst: boolean;
      previousLabel: string;
      nextLabel: string;
      finishLabel: string;
      showProgressBar: boolean;
    }> = {},
  ): ComponentFixture<SolWizardComponent> {
    const fixture = TestBed.createComponent(SolWizardComponent);
    fixture.componentRef.setInput('steps', inputs.steps ?? STEPS);
    for (const key of [
      'current',
      'canAdvance',
      'hidePreviousOnFirst',
      'previousLabel',
      'nextLabel',
      'finishLabel',
      'showProgressBar',
    ] as const) {
      if (inputs[key] !== undefined) fixture.componentRef.setInput(key, inputs[key]);
    }
    fixture.detectChanges();
    return fixture;
  }

  function collect(fixture: ComponentFixture<SolWizardComponent>) {
    const events: string[] = [];
    const steps: number[] = [];
    const inst = fixture.componentInstance;
    inst.next.subscribe(() => events.push('next'));
    inst.previous.subscribe(() => events.push('previous'));
    inst.finish.subscribe(() => events.push('finish'));
    inst.stepChange.subscribe((i: number) => steps.push(i));
    return { events, steps };
  }

  const root = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const nextBtn = (f: ComponentFixture<unknown>) =>
    root(f).querySelector('.sol-wizard__next button') as HTMLButtonElement;
  const prevBtn = (f: ComponentFixture<unknown>) =>
    root(f).querySelector('.sol-wizard__prev button') as HTMLButtonElement | null;
  const pills = (f: ComponentFixture<unknown>) =>
    Array.from(root(f).querySelectorAll<HTMLButtonElement>('.sol-stepper__step'));

  it('renderiza las pills (sol-stepper) y la barra de fases (sol-progress-bar)', () => {
    const fixture = create();
    expect(pills(fixture).length).toBe(3);
    expect(root(fixture).querySelectorAll('.sol-progress__segment').length).toBe(3);
  });

  it('puede ocultar la barra de fases con showProgressBar=false', () => {
    const fixture = create({ showProgressBar: false });
    expect(root(fixture).querySelector('.sol-progress__segments')).toBeNull();
    expect(pills(fixture).length).toBe(3);
  });

  it('en el paso 0 oculta "Anterior" y habilita "Siguiente"', () => {
    const fixture = create();
    expect(prevBtn(fixture)).toBeNull();
    expect(nextBtn(fixture).disabled).toBe(false);
    expect(nextBtn(fixture).textContent).toContain('Siguiente');
  });

  it('"Siguiente" avanza: actualiza current y emite next + stepChange', () => {
    const fixture = create();
    const seen = collect(fixture);

    nextBtn(fixture).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.current()).toBe(1);
    expect(seen.events).toContain('next');
    expect(seen.steps).toEqual([1]);
  });

  it('"Anterior" aparece tras avanzar y retrocede emitiendo previous + stepChange', () => {
    const fixture = create();
    nextBtn(fixture).click();
    fixture.detectChanges();

    const seen = collect(fixture);
    const back = prevBtn(fixture);
    expect(back).not.toBeNull();
    back!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.current()).toBe(0);
    expect(seen.events).toContain('previous');
    expect(seen.steps).toEqual([0]);
  });

  it('en el último paso el botón dice "Finalizar", emite finish y NO cambia current', () => {
    const fixture = create({ current: 2 });
    const seen = collect(fixture);

    expect(nextBtn(fixture).textContent).toContain('Finalizar');
    nextBtn(fixture).click();
    fixture.detectChanges();

    expect(seen.events).toContain('finish');
    expect(fixture.componentInstance.current()).toBe(2);
  });

  it('canAdvance=false deshabilita "Siguiente" y bloquea el avance', () => {
    const fixture = create({ canAdvance: false });
    const seen = collect(fixture);

    expect(nextBtn(fixture).disabled).toBe(true);
    nextBtn(fixture).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.current()).toBe(0);
    expect(seen.events).not.toContain('next');
  });

  it('canAdvance como predicado se evalúa contra el índice actual', () => {
    const fixture = create({ canAdvance: (i: number) => i > 0 });
    // En el paso 0 el predicado es false → deshabilitado.
    expect(nextBtn(fixture).disabled).toBe(true);
  });

  it('retroceso por pill: tras avanzar, clic en una pill visitada vuelve y emite stepChange', () => {
    const fixture = create();
    nextBtn(fixture).click();
    fixture.detectChanges();
    nextBtn(fixture).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.current()).toBe(2);

    const seen = collect(fixture);
    pills(fixture)[0].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.current()).toBe(0);
    expect(seen.steps).toEqual([0]);
  });

  it('usa los textos por defecto es-CO en los botones', () => {
    const fixture = create({ current: 1 });
    expect(nextBtn(fixture).textContent).toContain('Siguiente');
    expect(prevBtn(fixture)!.textContent).toContain('Anterior');
  });

  it('permite el override de los textos por input', () => {
    const fixture = create({ current: 1, previousLabel: 'Volver', nextLabel: 'Continuar' });
    expect(prevBtn(fixture)!.textContent).toContain('Volver');
    expect(nextBtn(fixture).textContent).toContain('Continuar');
  });

  it('con hidePreviousOnFirst=false muestra "Anterior" deshabilitado en el paso 0', () => {
    const fixture = create({ hidePreviousOnFirst: false });
    const back = prevBtn(fixture);
    expect(back).not.toBeNull();
    expect(back!.disabled).toBe(true);
  });

  it('proyección *solWizardStep: muestra solo el panel del paso actual y cambia al avanzar', () => {
    const fixture = TestBed.createComponent(ProjectionHostComponent);
    fixture.detectChanges();

    expect(root(fixture).querySelector('.panel-1')).not.toBeNull();
    expect(root(fixture).querySelector('.panel-2')).toBeNull();

    (root(fixture).querySelector('.sol-wizard__next button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root(fixture).querySelector('.panel-1')).toBeNull();
    expect(root(fixture).querySelector('.panel-2')).not.toBeNull();
  });

  it('sin plantillas *solWizardStep cae al slot único <ng-content>', () => {
    const fixture = TestBed.createComponent(FallbackHostComponent);
    fixture.detectChanges();
    expect(root(fixture).querySelector('.fallback')).not.toBeNull();
    expect(root(fixture).querySelector('.sol-wizard__panel')).toBeNull();
  });
});

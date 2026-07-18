import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolStepperComponent, type SolStepperStep } from './stepper.component';

/**
 * Specs de `sol-stepper` (E4 — primer consumidor: onboarding v2).
 * Cubren: estados derivados (completado/actual/pendiente/error), a11y
 * (aria-current, aria-orientation, aria-disabled), interactividad (solo
 * pasos visitados son navegables) y navegación por teclado (roving focus).
 */

const STEPS: SolStepperStep[] = [
  { id: 'vertical', labelKey: 'steps.vertical' },
  { id: 'datos', labelKey: 'steps.datos' },
  { id: 'negocio', labelKey: 'steps.negocio', descriptionKey: 'steps.negocioDesc' },
  { id: 'plan', labelKey: 'steps.plan' },
];

describe('SolStepperComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOL_I18N,
          useValue: {
            activeLang: signal('es-CO'),
            translate: (key: string) => `t(${key})`,
          },
        },
      ],
    });
  });

  function create(inputs: Partial<{
    steps: SolStepperStep[];
    activeIndex: number;
    furthestIndex: number;
    orientation: 'horizontal' | 'vertical';
    interactive: boolean;
    navigation: 'linear' | 'free';
  }> = {}): ComponentFixture<SolStepperComponent> {
    const fixture = TestBed.createComponent(SolStepperComponent);
    fixture.componentRef.setInput('steps', inputs.steps ?? STEPS);
    if (inputs.activeIndex !== undefined) fixture.componentRef.setInput('activeIndex', inputs.activeIndex);
    if (inputs.furthestIndex !== undefined) fixture.componentRef.setInput('furthestIndex', inputs.furthestIndex);
    if (inputs.orientation) fixture.componentRef.setInput('orientation', inputs.orientation);
    if (inputs.interactive !== undefined) fixture.componentRef.setInput('interactive', inputs.interactive);
    if (inputs.navigation) fixture.componentRef.setInput('navigation', inputs.navigation);
    fixture.detectChanges();
    return fixture;
  }

  function stepButtons(fixture: ComponentFixture<SolStepperComponent>): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.sol-stepper__step'),
    );
  }

  it('renderiza un ítem por paso con la etiqueta traducida por clave i18n', () => {
    const fixture = create({ activeIndex: 0 });
    const buttons = stepButtons(fixture);
    expect(buttons.length).toBe(4);
    expect(buttons[0].textContent).toContain('t(steps.vertical)');
    expect(buttons[2].textContent).toContain('t(steps.negocio)');
    expect(buttons[2].textContent).toContain('t(steps.negocioDesc)');
  });

  it('deriva los estados: anteriores completados, activo actual (aria-current="step"), posteriores pendientes', () => {
    const fixture = create({ activeIndex: 2 });
    const buttons = stepButtons(fixture);

    expect(buttons[0].classList).toContain('sol-stepper__step--completed');
    expect(buttons[1].classList).toContain('sol-stepper__step--completed');
    expect(buttons[2].classList).toContain('sol-stepper__step--current');
    expect(buttons[3].classList).toContain('sol-stepper__step--pending');

    expect(buttons[2].getAttribute('aria-current')).toBe('step');
    expect(buttons[0].getAttribute('aria-current')).toBeNull();
    expect(buttons[3].getAttribute('aria-current')).toBeNull();
  });

  it('un paso marcado con error muestra el estado error aunque esté visitado', () => {
    const withError = STEPS.map((s, i) => (i === 1 ? { ...s, error: true } : s));
    const fixture = create({ steps: withError, activeIndex: 2 });
    const buttons = stepButtons(fixture);

    expect(buttons[1].classList).toContain('sol-stepper__step--error');
    expect(buttons[1].classList).not.toContain('sol-stepper__step--completed');
  });

  it('en modo interactivo, clic en un paso visitado emite stepSelected; en uno futuro NO', () => {
    const fixture = create({ activeIndex: 2, interactive: true });
    const emitted: number[] = [];
    fixture.componentInstance.stepSelected.subscribe((i: number) => emitted.push(i));
    const buttons = stepButtons(fixture);

    buttons[0].click();
    buttons[3].click(); // futuro → no navegable (wizard lineal)
    buttons[2].click(); // actual → no re-emite

    expect(emitted).toEqual([0]);
    expect(buttons[3].getAttribute('aria-disabled')).toBe('true');
    expect(buttons[0].getAttribute('aria-disabled')).toBe('false');
  });

  it('sin modo interactivo, ningún clic emite y ningún paso es foco de tab', () => {
    const fixture = create({ activeIndex: 2 });
    const emitted: number[] = [];
    fixture.componentInstance.stepSelected.subscribe((i: number) => emitted.push(i));
    const buttons = stepButtons(fixture);

    buttons[0].click();
    expect(emitted).toEqual([]);
    expect(buttons.every(b => b.tabIndex === -1)).toBe(true);
  });

  it('con furthestIndex, los pasos ya alcanzados por delante del activo se muestran completados (retroceso)', () => {
    // El usuario llegó al paso 3 (frontera) y retrocedió a revisar el paso 1.
    const fixture = create({ activeIndex: 1, furthestIndex: 3 });
    const buttons = stepButtons(fixture);

    expect(buttons[0].classList).toContain('sol-stepper__step--completed');
    expect(buttons[1].classList).toContain('sol-stepper__step--current');
    // Índices 2 y 3 van por delante del activo pero YA se alcanzaron.
    expect(buttons[2].classList).toContain('sol-stepper__step--completed');
    expect(buttons[3].classList).toContain('sol-stepper__step--completed');
  });

  it('con furthestIndex, clic hacia ADELANTE en un paso ya alcanzado emite; más allá de la frontera NO', () => {
    const fixture = create({ activeIndex: 1, furthestIndex: 3, interactive: true });
    const emitted: number[] = [];
    fixture.componentInstance.stepSelected.subscribe((i: number) => emitted.push(i));
    const buttons = stepButtons(fixture);

    buttons[3].click(); // adelante, dentro de la frontera → navegable
    buttons[0].click(); // atrás → navegable
    buttons[1].click(); // actual → no re-emite

    expect(emitted).toEqual([3, 0]);
    expect(buttons[3].getAttribute('aria-disabled')).toBe('false');
  });

  it('sin furthestIndex el comportamiento sigue lineal: los pasos futuros no son navegables', () => {
    const fixture = create({ activeIndex: 1, interactive: true });
    const buttons = stepButtons(fixture);
    // Sin frontera declarada, el paso 3 (futuro) queda bloqueado como antes.
    expect(buttons[3].getAttribute('aria-disabled')).toBe('true');
    expect(buttons[2].classList).toContain('sol-stepper__step--pending');
  });

  it('teclado (interactivo) con furthestIndex: la flecha derecha alcanza pasos ya visitados por delante', () => {
    const fixture = create({ activeIndex: 1, furthestIndex: 3, interactive: true });
    const buttons = stepButtons(fixture);
    const list = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.sol-stepper')!;

    buttons[1].focus();
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(buttons[2]);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(buttons[3]); // frontera alcanzada
  });

  it('aplica la orientación como clase y como aria-orientation', () => {
    const fixture = create({ orientation: 'vertical' });
    const list = (fixture.nativeElement as HTMLElement).querySelector('.sol-stepper')!;
    expect(list.classList).toContain('sol-stepper--vertical');
    expect(list.getAttribute('aria-orientation')).toBe('vertical');

    const horizontal = create({});
    const hList = (horizontal.nativeElement as HTMLElement).querySelector('.sol-stepper')!;
    expect(hList.classList).toContain('sol-stepper--horizontal');
    expect(hList.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('teclado (interactivo): las flechas mueven el foco entre pasos navegables y Home/End saltan a los extremos', () => {
    const fixture = create({ activeIndex: 2, interactive: true });
    const buttons = stepButtons(fixture);
    const list = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.sol-stepper')!;

    buttons[2].focus(); // el paso actual es el tab-stop (roving tabindex)
    expect(buttons[2].tabIndex).toBe(0);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(buttons[2]);

    // Desde el paso actual, la flecha derecha NO avanza a pasos futuros (no navegables).
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(buttons[2]);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(buttons[0]);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(buttons[2]); // el último navegable es el actual
  });

  // ── D7: navigation:'linear'|'free' (11-a-solercia-ui, PR3) ──────────────────

  it('[spec] navigation por defecto es "linear" — retrocompatibilidad total con la API 0.1.x sin declarar el input', () => {
    const fixture = create({ activeIndex: 1, interactive: true });
    expect(fixture.componentInstance.navigation()).toBe('linear');
    // mismo comportamiento que el resto de la suite (sin navigation): el futuro sigue bloqueado.
    const buttons = stepButtons(fixture);
    expect(buttons[3].getAttribute('aria-disabled')).toBe('true');
  });

  it('[spec] navigation="free": clic mueve a CUALQUIER etapa, incluida una nunca visitada, y emite stepSelected', () => {
    const fixture = create({ activeIndex: 1, interactive: true, navigation: 'free' });
    const emitted: number[] = [];
    fixture.componentInstance.stepSelected.subscribe((i: number) => emitted.push(i));
    const buttons = stepButtons(fixture);

    // el paso 3 nunca fue alcanzado (furthestIndex por defecto = activeIndex = 1)
    // y aun así es navegable en modo 'free' — pipeline CRM accionable.
    expect(buttons[3].getAttribute('aria-disabled')).toBe('false');
    buttons[3].click();
    buttons[0].click();
    buttons[1].click(); // actual → no re-emite

    expect(emitted).toEqual([3, 0]);
  });

  it('navigation="free" no cambia el estado VISUAL (completado/actual/pendiente), solo la navegabilidad', () => {
    const fixture = create({ activeIndex: 1, interactive: true, navigation: 'free' });
    const buttons = stepButtons(fixture);

    expect(buttons[0].classList).toContain('sol-stepper__step--completed');
    expect(buttons[1].classList).toContain('sol-stepper__step--current');
    expect(buttons[2].classList).toContain('sol-stepper__step--pending'); // sigue "pendiente" visualmente
    expect(buttons[3].classList).toContain('sol-stepper__step--pending');
  });

  it('navigation="free" sin interactive=true sigue sin emitir (navigation por sí solo no activa la navegación)', () => {
    const fixture = create({ activeIndex: 1, navigation: 'free' });
    const emitted: number[] = [];
    fixture.componentInstance.stepSelected.subscribe((i: number) => emitted.push(i));
    const buttons = stepButtons(fixture);

    buttons[3].click();
    expect(emitted).toEqual([]);
    expect(buttons.every((b) => b.tabIndex === -1)).toBe(true);
  });

  it('teclado en navigation="free": End salta al ÚLTIMO paso aunque nunca se haya visitado', () => {
    const fixture = create({ activeIndex: 1, interactive: true, navigation: 'free' });
    const buttons = stepButtons(fixture);
    const list = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.sol-stepper')!;

    buttons[1].focus();
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(buttons[3]);
  });
});

import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolFloatingPanelDirective } from './floating-panel.directive';

/**
 * Specs de la primitiva compartida `solFloatingPanel`, extraída del portal
 * inline de `sol-select` (CP-2). Se verifica el contrato observable sobre un
 * host de prueba: portal a `document.body`, coordenadas fijas, alineación,
 * volteo y limpieza. jsdom no evalúa layout, así que los rectángulos del
 * disparador se simulan.
 */
@Component({
  standalone: true,
  imports: [SolFloatingPanelDirective],
  template: `
    <button #trigger type="button">Abrir</button>
    @if (open()) {
      <div
        class="test-panel"
        [solFloatingPanel]="trigger"
        [gap]="gap()"
        [flipThreshold]="flipThreshold()"
        [matchTriggerWidth]="matchTriggerWidth()"
        [align]="align()"
        (dropUpChange)="dropUpEvents.push($event)"
      >
        contenido
      </div>
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly gap = signal(4);
  readonly flipThreshold = signal(300);
  readonly matchTriggerWidth = signal(true);
  readonly align = signal<'start' | 'end'>('start');
  readonly dropUpEvents: boolean[] = [];
  readonly panel = viewChild(SolFloatingPanelDirective);
}

describe('SolFloatingPanelDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const TRIGGER_RECT: DOMRect = {
    x: 40, y: 100, left: 40, top: 100, right: 280, bottom: 140,
    width: 240, height: 40,
    toJSON: () => ({}),
  } as DOMRect;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button')!;
  }

  function panel(): HTMLElement | null {
    return document.querySelector('.test-panel');
  }

  function openWith(rect: DOMRect = TRIGGER_RECT): void {
    trigger().getBoundingClientRect = () => rect;
    host.open.set(true);
    fixture.detectChanges();
  }

  it('portalea el panel a document.body con position fixed anclado bajo el disparador', () => {
    openWith();

    const el = panel()!;
    expect(el.parentElement).toBe(document.body);
    expect(el.style.position).toBe('fixed');
    expect(el.style.top).toBe('144px'); // bottom del trigger + gap
    expect(el.style.left).toBe('40px');
    expect(el.style.bottom).toBe('auto');
  });

  it('aplica la clase compartida .sol-floating-panel y registra su estilo global una sola vez', () => {
    openWith();

    expect(panel()!.classList.contains('sol-floating-panel')).toBe(true);
    expect(document.querySelectorAll('#sol-floating-panel-styles').length).toBe(1);
  });

  it('matchTriggerWidth iguala el ancho del disparador; en falso no escribe width', () => {
    openWith();
    expect(panel()!.style.width).toBe('240px');

    host.open.set(false);
    fixture.detectChanges();
    host.matchTriggerWidth.set(false);
    openWith();

    expect(panel()!.style.width).toBe('');
  });

  it('gap configurable desplaza el panel respecto del disparador', () => {
    host.gap.set(12);
    openWith();

    expect(panel()!.style.top).toBe('152px'); // 140 + 12
  });

  it('voltea hacia arriba cuando abajo no cabe y arriba sí, anclando por bottom', () => {
    const nearBottom = {
      ...TRIGGER_RECT,
      top: window.innerHeight - 60,
      bottom: window.innerHeight - 20,
      toJSON: () => ({}),
    } as DOMRect;
    openWith(nearBottom);

    const el = panel()!;
    expect(host.panel()!.dropUp()).toBe(true);
    expect(el.style.top).toBe('auto');
    expect(el.style.bottom).toBe(`${window.innerHeight - nearBottom.top + 4}px`);
    expect(host.dropUpEvents).toEqual([true]);
  });

  it('no voltea si arriba tampoco hay espacio suficiente', () => {
    // Viewport muy bajo: ni arriba ni abajo alcanza el umbral.
    const squeezed = {
      ...TRIGGER_RECT,
      top: 50, bottom: 90,
      toJSON: () => ({}),
    } as DOMRect;
    host.flipThreshold.set(window.innerHeight); // fuerza "no cabe abajo"
    openWith(squeezed);

    expect(host.panel()!.dropUp()).toBe(false);
    expect(panel()!.style.top).toBe('94px');
  });

  it('align="end" ancla el panel por el borde derecho del disparador', () => {
    host.align.set('end');
    host.matchTriggerWidth.set(false);
    openWith();

    // Sin layout real (offsetWidth 0 en jsdom) el borde derecho manda.
    expect(panel()!.style.left).toBe(`${TRIGGER_RECT.right}px`);
  });

  it('reposiciona en scroll con captura (scroll de contenedores internos)', () => {
    openWith();
    expect(panel()!.style.top).toBe('144px');

    trigger().getBoundingClientRect = () =>
      ({ ...TRIGGER_RECT, top: 60, bottom: 100, toJSON: () => ({}) }) as DOMRect;
    window.dispatchEvent(new Event('scroll'));

    expect(panel()!.style.top).toBe('104px');
  });

  it('reposiciona en resize', () => {
    openWith();

    trigger().getBoundingClientRect = () =>
      ({ ...TRIGGER_RECT, top: 200, bottom: 240, toJSON: () => ({}) }) as DOMRect;
    window.dispatchEvent(new Event('resize'));

    expect(panel()!.style.top).toBe('244px');
  });

  it('reposition() público fuerza el recálculo', () => {
    openWith();
    const directive = host.panel()!;

    trigger().getBoundingClientRect = () =>
      ({ ...TRIGGER_RECT, top: 300, bottom: 340, toJSON: () => ({}) }) as DOMRect;
    directive.reposition();

    expect(panel()!.style.top).toBe('344px');
  });

  it('al cerrar retira el nodo portaleado y deja de reposicionar', () => {
    openWith();
    host.open.set(false);
    fixture.detectChanges();

    expect(panel()).toBeNull();
    expect(document.body.querySelectorAll('.test-panel').length).toBe(0);
    // Sin listeners vivos: un scroll posterior no debe lanzar.
    expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow();
  });

  it('al destruir el host con el panel abierto no queda nodo huérfano', () => {
    openWith();
    fixture.destroy();

    expect(document.body.querySelectorAll('.test-panel').length).toBe(0);
  });
});

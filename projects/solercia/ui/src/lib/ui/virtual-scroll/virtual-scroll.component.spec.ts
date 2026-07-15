import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolVirtualScrollComponent } from './virtual-scroll.component';

/**
 * Spec del COMPONENTE `sol-virtual-scroll` (E5). La matemática vive en
 * `virtual-window.spec.ts`; aquí se prueba el comportamiento observable:
 * renderizado parcial (solo ventana + buffer), anclaje al fondo tipo chat,
 * chip "mensajes nuevos" cuando llegan mensajes estando arriba, y el
 * output `nearTop` para paginación hacia atrás.
 *
 * jsdom no hace layout: el alto del viewport se fija con defineProperty y
 * las alturas de ítems quedan en la ESTIMADA (offsetHeight 0 se ignora).
 */

interface Msg {
  id: string;
  text: string;
}

const msg = (i: number): Msg => ({ id: `m${i}`, text: `Mensaje ${i}` });
const range = (n: number, from = 0): Msg[] => Array.from({ length: n }, (_, i) => msg(from + i));

@Component({
  standalone: true,
  imports: [SolVirtualScrollComponent],
  template: `
    <div style="height: 400px">
      <sol-virtual-scroll
        [items]="items()"
        [itemKey]="key"
        [estimatedItemHeight]="50"
        [bufferPx]="100"
      >
        <ng-template let-item let-index="index">
          <p class="msg">{{ item.text }}</p>
        </ng-template>
      </sol-virtual-scroll>
    </div>
  `,
})
class HostComponent {
  readonly items = signal<Msg[]>(range(100));
  readonly key = (item: Msg): string => item.id;
}

describe('SolVirtualScrollComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let viewport: HTMLElement;
  let component: SolVirtualScrollComponent<Msg>;

  const setScrollMetrics = (el: HTMLElement, clientHeight: number): void => {
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  };

  /**
   * Doble pasada de CD: las escrituras de señales hechas en
   * `ngAfterViewChecked` (alto del viewport, mediciones, compensaciones)
   * se reflejan en el render del ciclo siguiente.
   */
  const settle = (): void => {
    fixture.detectChanges();
    fixture.detectChanges();
  };

  const scrollTo = (top: number): void => {
    viewport.scrollTop = top;
    viewport.dispatchEvent(new Event('scroll'));
    settle();
  };

  const renderedTexts = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.msg')).map(el =>
      (el as HTMLElement).textContent!.trim(),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: SOL_I18N,
          useValue: {
            activeLang: signal('es-CO'),
            translate: (key: string) => `t(${key})`,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();

    viewport = fixture.nativeElement.querySelector('.sol-virtual-scroll__viewport');
    component = fixture.debugElement.children[0].children[0].componentInstance;
    setScrollMetrics(viewport, 400);
    scrollTo(0);
  });

  it('renderiza SOLO los ítems de la ventana visible + buffer, no los 100', () => {
    // Viewport 400 px, estimada 50 px, buffer 100 px → [0, 500] → 10 ítems.
    const texts = renderedTexts();
    expect(texts.length).toBe(10);
    expect(texts[0]).toBe('Mensaje 0');
    expect(texts[9]).toBe('Mensaje 9');
  });

  it('al scrollear, la ventana se desplaza y los espaciadores preservan el alto total', () => {
    scrollTo(2000);
    const texts = renderedTexts();
    // Rango con buffer [1900, 2500] → ítems 38..49.
    expect(texts[0]).toBe('Mensaje 38');
    expect(texts[texts.length - 1]).toBe('Mensaje 49');

    const spacers = fixture.nativeElement.querySelectorAll('.sol-virtual-scroll__spacer');
    const padTop = parseFloat((spacers[0] as HTMLElement).style.height);
    const padBottom = parseFloat((spacers[1] as HTMLElement).style.height);
    expect(padTop).toBe(38 * 50);
    expect(padTop + texts.length * 50 + padBottom).toBe(100 * 50);
  });

  it('estando al fondo, un mensaje nuevo mantiene el ancla (sin chip)', () => {
    scrollTo(4600); // fondo exacto: 5000 - 400
    expect(component.atBottom()).toBe(true);

    host.items.set([...host.items(), msg(100)]);
    settle();

    expect(component.newItemsCount()).toBe(0);
    expect(
      fixture.nativeElement.querySelector('[data-testid="chip-mensajes-nuevos"]'),
    ).toBeNull();
  });

  it('scrolleado hacia ARRIBA, los mensajes nuevos NO arrastran y aparece el chip con el conteo', () => {
    scrollTo(1000);
    expect(component.atBottom()).toBe(false);

    host.items.set([...host.items(), msg(100), msg(101)]);
    settle();

    expect(component.newItemsCount()).toBe(2);
    const chip = fixture.nativeElement.querySelector('[data-testid="chip-mensajes-nuevos"]');
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('2');
    // El scroll no fue arrastrado al fondo.
    expect(viewport.scrollTop).toBe(1000);
  });

  it('el click en el chip salta al fondo y limpia el conteo', () => {
    scrollTo(1000);
    host.items.set([...host.items(), msg(100)]);
    settle();
    expect(component.newItemsCount()).toBe(1);

    const chip = fixture.nativeElement.querySelector('[data-testid="chip-mensajes-nuevos"]');
    (chip as HTMLElement).click();
    settle();

    expect(component.newItemsCount()).toBe(0);
    expect(component.atBottom()).toBe(true);
  });

  it('volver al fondo scrolleando limpia el chip', () => {
    scrollTo(1000);
    host.items.set([...host.items(), msg(100)]);
    settle();
    expect(component.newItemsCount()).toBe(1);

    scrollTo(101 * 50 - 400); // fondo del contenido nuevo
    expect(component.newItemsCount()).toBe(0);
  });

  it('emite nearTop UNA vez al acercarse arriba (paginación hacia atrás) y se rearma al alejarse', () => {
    let emissions = 0;
    component.nearTop.subscribe(() => emissions++);

    scrollTo(2000);
    expect(emissions).toBe(0);

    scrollTo(80); // bajo el umbral por defecto (120 px)
    expect(emissions).toBe(1);
    scrollTo(60); // sigue en zona: NO re-emite
    expect(emissions).toBe(1);

    scrollTo(2000); // se aleja: re-arma
    scrollTo(90);
    expect(emissions).toBe(2);
  });

  it('el prepend (mensajes antiguos) compensa el scroll para no saltar visualmente', () => {
    scrollTo(500);
    host.items.set([...range(20, 900), ...host.items()]);
    settle();

    // 20 ítems de 50 px prepended → el scroll se corre 1000 px hacia abajo.
    expect(viewport.scrollTop).toBe(1500);
    expect(component.newItemsCount()).toBe(0);
  });

  it('reemplazar la lista (cambio de conversación) resetea el chip', () => {
    scrollTo(1000);
    host.items.set([...host.items(), msg(100)]);
    settle();
    expect(component.newItemsCount()).toBe(1);

    host.items.set(range(5, 500));
    settle();
    expect(component.newItemsCount()).toBe(0);
  });

  it('con lista vacía no renderiza filas ni chip', () => {
    host.items.set([]);
    settle();
    expect(renderedTexts()).toEqual([]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="chip-mensajes-nuevos"]'),
    ).toBeNull();
  });
});

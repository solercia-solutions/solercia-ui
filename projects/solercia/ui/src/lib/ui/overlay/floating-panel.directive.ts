/**
 * `solFloatingPanel` — portal manual de paneles flotantes (CP-2).
 *
 * Extraído del código inline de `sol-select` para compartirlo con cualquier
 * componente cuyo panel deba flotar POR ENCIMA de un `sol-modal` o un
 * `sol-drawer`. El panel se mueve a `document.body` y se posiciona con
 * `position: fixed` sobre coordenadas del viewport, de modo que ningún
 * ancestro con `overflow` o `backdrop-filter` (típicamente `.sol-modal-body`)
 * lo recorte.
 *
 * Cálculo de posición 100% manual: el proyecto prohíbe librerías de
 * posicionamiento externas (`@floating-ui/dom`, `popper.js`).
 *
 * NO aplica a popovers deliberadamente clampados dentro de su host
 * (p. ej. `sol-rich-editor`), que no desbordan y no deben portalearse.
 */
import {
  Directive,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/** Borde del disparador con el que se alinea el panel. */
export type SolFloatingPanelAlign = 'start' | 'end';

/** Id del `<style>` compartido inyectado una sola vez en `document.head`. */
const FLOATING_PANEL_STYLE_ID = 'sol-floating-panel-styles';

/**
 * Clase compartida de todo panel portaleado: el `z-index` supera al del modal
 * para que el panel nunca quede debajo del overlay. Vive en un `<style>`
 * global porque el panel deja de heredar del host al portalearse, y los
 * estilos encapsulados por componente no deben competir por especificidad.
 */
export function ensureFloatingPanelStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FLOATING_PANEL_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = FLOATING_PANEL_STYLE_ID;
  style.textContent =
    '.sol-floating-panel { z-index: calc(var(--sol-z-modal, 1050) + 10); }';
  document.head.appendChild(style);
}

@Directive({
  selector: '[solFloatingPanel]',
  standalone: true,
  exportAs: 'solFloatingPanel',
  host: { class: 'sol-floating-panel' },
})
export class SolFloatingPanelDirective {
  /** Elemento disparador cuyo rectángulo ancla el panel (requerido). */
  readonly trigger = input.required<HTMLElement>({ alias: 'solFloatingPanel' });

  /** Separación en px entre el disparador y el panel. */
  readonly gap = input<number>(4);

  /**
   * Espacio mínimo (px) que debe quedar bajo el disparador para abrir hacia
   * abajo. Si no alcanza —y sí hay espacio arriba— el panel voltea (`dropUp`).
   */
  readonly flipThreshold = input<number>(300);

  /** Iguala el ancho del panel al del disparador (falso = ancho propio). */
  readonly matchTriggerWidth = input<boolean>(true);

  /** Alineación horizontal contra el borde `start` o `end` del disparador. */
  readonly align = input<SolFloatingPanelAlign>('start');

  private readonly _dropUp = signal(false);

  /** Verdadero cuando el panel abrió hacia arriba (el host aplica su clase). */
  readonly dropUp = this._dropUp.asReadonly();

  /** Emite solo cuando la orientación cambia, para enlazarlo desde el template. */
  readonly dropUpChange = output<boolean>();

  private readonly panel = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Disparador vigente mientras el panel está portaleado. */
  private activeTrigger: HTMLElement | null = null;

  /** Última orientación emitida (`null` = todavía no se emitió ninguna). */
  private lastEmittedDropUp: boolean | null = null;

  /** Misma referencia para `addEventListener` / `removeEventListener`. */
  private readonly repositionHandler = (): void => this.reposition();

  constructor() {
    ensureFloatingPanelStyles();

    // El ciclo de vida del portal se ata al de la directiva: Angular la crea
    // cuando el `@if` del host materializa el panel y la destruye al cerrarlo,
    // así que el `onCleanup` retira listeners y nodo sin fugas.
    effect(onCleanup => {
      this.attach(this.trigger());
      onCleanup(() => this.detach());
    });
  }

  /** Adhiere el panel a `document.body` y lo posiciona siguiendo al disparador. */
  private attach(trigger: HTMLElement): void {
    this.activeTrigger = trigger;
    // Fuera del host el panel ya no hereda: si un ancestro del disparador sube
    // `--sol-z-modal` (una hoja por encima del encabezado), el panel debe seguirlo.
    const zModal = getComputedStyle(trigger).getPropertyValue('--sol-z-modal').trim();
    if (zModal) this.panel.style.setProperty('--sol-z-modal', zModal);
    document.body.appendChild(this.panel);
    this.reposition();

    // `capture: true` es OBLIGATORIO: sin él, el listener no se entera del
    // scroll de contenedores internos como `.sol-modal-body` (los eventos de
    // scroll no burbujean), que es justo el caso que motiva este portal.
    window.addEventListener('scroll', this.repositionHandler, { capture: true, passive: true });
    window.addEventListener('resize', this.repositionHandler, { passive: true });
  }

  /** Retira listeners y el nodo portaleado. */
  private detach(): void {
    window.removeEventListener('scroll', this.repositionHandler, { capture: true });
    window.removeEventListener('resize', this.repositionHandler);

    // Guarda necesaria: Angular puede haber destruido el nodo por su cuenta
    // (el `removeChild` sobre un nodo ya desprendido lanzaría).
    if (this.panel.parentNode === document.body) {
      document.body.removeChild(this.panel);
    }

    this.activeTrigger = null;
    this.lastEmittedDropUp = null;
  }

  /**
   * Recalcula la posición del panel en coordenadas fijas del viewport.
   * Público para que el host pueda forzar el recálculo tras cambios de
   * contenido que alteren el tamaño del panel.
   */
  reposition(): void {
    const trigger = this.activeTrigger;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = this.gap();
    const threshold = this.flipThreshold();

    // Voltea solo si abajo no cabe Y arriba sí: sin la segunda condición, en
    // viewports muy bajos el panel se iría hacia arriba a un espacio igual de
    // insuficiente.
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < threshold && rect.top > threshold;
    this.setDropUp(dropUp);

    const panel = this.panel;
    panel.style.position = 'fixed';
    panel.style.right = 'auto';

    if (this.matchTriggerWidth()) {
      panel.style.width = `${rect.width}px`;
    }

    panel.style.left = `${this.resolveLeft(rect, gap)}px`;

    if (dropUp) {
      panel.style.top = 'auto';
      panel.style.bottom = `${window.innerHeight - rect.top + gap}px`;
    } else {
      panel.style.top = `${rect.bottom + gap}px`;
      panel.style.bottom = 'auto';
    }
  }

  /** Coordenada X según la alineación, acotada al viewport cuando hay margen. */
  private resolveLeft(rect: DOMRect, gap: number): number {
    const width = this.matchTriggerWidth() ? rect.width : this.panel.offsetWidth;
    let left = this.align() === 'end' ? rect.right - width : rect.left;

    const maxLeft = window.innerWidth - width - gap;
    if (maxLeft > gap) left = Math.min(left, maxLeft);
    return Math.max(gap, left);
  }

  /** Publica la orientación evitando emisiones repetidas en cada scroll. */
  private setDropUp(dropUp: boolean): void {
    this._dropUp.set(dropUp);
    if (this.lastEmittedDropUp === dropUp) return;
    this.lastEmittedDropUp = dropUp;
    this.dropUpChange.emit(dropUp);
  }
}

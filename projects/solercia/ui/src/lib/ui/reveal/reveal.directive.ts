import { CSP_NONCE, DestroyRef, Directive, ElementRef, type OnInit, effect, inject, input } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** Atributo del `<style>` global que la directiva inyecta una sola vez por documento. */
const REVEAL_STYLE_ATTR = 'data-sol-reveal-styles';

/**
 * Keyframes y clases globales del reveal. Son los mismos que muchos hosts ya declaran en su
 * `styles.css` (contrato `--sol-reveal-*` del tema): repetirlos no cambia nada y garantiza el
 * efecto en hosts que no los declaran. Los keyframes no llevan duración ni easing: los aportan los
 * tokens del tema (`--sol-dur-*`, `--sol-ease-*`); con intensidad "none" o `prefers-reduced-motion`
 * las duraciones emitidas son ~1 ms y `--sol-reveal-dist` es 0, así que no hay movimiento.
 * Cada keyframe tiene un duplicado "B": alternar base ↔ B reinicia la animación (replay).
 */
const REVEAL_STYLES = `
@keyframes solRevealRise { from { opacity: 0; transform: translateY(var(--sol-reveal-dist, 12px)); } to { opacity: 1; transform: translateY(0); } }
@keyframes solRevealRiseB { from { opacity: 0; transform: translateY(var(--sol-reveal-dist, 12px)); } to { opacity: 1; transform: translateY(0); } }
@keyframes solRevealFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes solRevealFadeB { from { opacity: 0; } to { opacity: 1; } }
@keyframes solRevealPop { from { opacity: 0; transform: translateY(var(--sol-reveal-dist, 12px)) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes solRevealPopB { from { opacity: 0; transform: translateY(var(--sol-reveal-dist, 12px)) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes solRevealSlide { from { opacity: 0; transform: translateX(calc(-1 * var(--sol-reveal-dist, 12px))); } to { opacity: 1; transform: translateX(0); } }
@keyframes solRevealSlideB { from { opacity: 0; transform: translateX(calc(-1 * var(--sol-reveal-dist, 12px))); } to { opacity: 1; transform: translateX(0); } }
@keyframes solRevealZoom { from { opacity: 0; transform: scale(0.94) translateY(calc(var(--sol-reveal-dist, 12px) * 0.4)); } to { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes solRevealZoomB { from { opacity: 0; transform: scale(0.94) translateY(calc(var(--sol-reveal-dist, 12px) * 0.4)); } to { opacity: 1; transform: scale(1) translateY(0); } }
.sol-reveal-in {
  animation: var(--sol-reveal-name, solRevealFade) var(--sol-dur-slow, 480ms) var(--sol-ease-entrance, ease-out) backwards;
  animation-delay: calc(var(--sol-reveal-index, 0) * var(--sol-dur-fast, 120ms) / 2);
}
.sol-reveal-in--replay {
  animation-name: var(--sol-reveal-name-b, solRevealFadeB);
}
`;

/**
 * `[solReveal]`: animación de entrada al hacer scroll, dirigida por el tema.
 *
 * Un `IntersectionObserver` (umbral bajo, una sola vez por elemento) agrega la clase global
 * `.sol-reveal-in`, que dispara el keyframe elegido por el tema vía `--sol-reveal-name`
 * (`solRevealRise | solRevealFade | solRevealPop | solRevealSlide | solRevealZoom`) con la
 * duración y el easing de `--sol-dur-slow` y `--sol-ease-entrance`.
 *
 * - Stagger: `solRevealIndex` viaja como `--sol-reveal-index` y retrasa la entrada ~60 ms por
 *   índice (sale de los tokens, así que escala con la intensidad del tema).
 * - Replay: cada cambio de `solRevealReplay` (búsqueda, filtro) alterna el keyframe base y su
 *   duplicado "B" para reiniciar la animación sin clonar nodos.
 * - SSR o jsdom: sin `IntersectionObserver` el elemento queda visible y sin animación.
 * - Las clases y los keyframes globales se inyectan una sola vez por documento (con el nonce de
 *   `CSP_NONCE` si el host lo provee), así el efecto no depende del `styles.css` del host.
 *
 * ```html
 * <section solReveal [solRevealIndex]="$index" [solRevealReplay]="filtro()">…</section>
 * ```
 */
@Directive({
  selector: '[solReveal]',
  standalone: true,
})
export class SolRevealDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly nonce = inject(CSP_NONCE, { optional: true });

  /** Índice del stagger: retrasa la entrada índice × ~60 ms (vía tokens). */
  readonly solRevealIndex = input<number>(0);

  /** Valor arbitrario: cada cambio re-dispara la animación (replay al filtrar). */
  readonly solRevealReplay = input<unknown>(undefined);

  private observer: IntersectionObserver | null = null;
  private revealed = false;
  private altKeyframe = false;

  constructor() {
    effect(() => {
      this.host.nativeElement.style.setProperty('--sol-reveal-index', String(this.solRevealIndex()));
    });

    // Replay: se ignora el valor inicial; solo re-anima elementos ya revelados.
    let initial = true;
    effect(() => {
      this.solRevealReplay();
      if (initial) {
        initial = false;
        return;
      }
      if (this.revealed) this.replay();
    });
  }

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.ensureGlobalStyles();

    // Oculto solo cuando el observer va a correr; el fill "backwards" retoma desde el "from".
    this.host.nativeElement.style.opacity = '0';
    this.observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) this.reveal();
      },
      { threshold: 0.05 },
    );
    this.observer.observe(this.host.nativeElement);
    this.destroyRef.onDestroy(() => this.disconnect());
  }

  private ensureGlobalStyles(): void {
    const head = this.document?.head;
    if (!head || head.querySelector(`style[${REVEAL_STYLE_ATTR}]`)) return;
    const style = this.document.createElement('style');
    style.setAttribute(REVEAL_STYLE_ATTR, '');
    if (this.nonce) style.setAttribute('nonce', this.nonce);
    style.textContent = REVEAL_STYLES;
    head.appendChild(style);
  }

  /** Primera entrada al viewport: una sola vez por elemento. */
  private reveal(): void {
    this.disconnect();
    const element = this.host.nativeElement;
    element.style.removeProperty('opacity');
    element.classList.add('sol-reveal-in');
    this.revealed = true;
  }

  /** Alterna el keyframe base y su duplicado "B" para reiniciar la animación. */
  private replay(): void {
    const element = this.host.nativeElement;
    this.altKeyframe = !this.altKeyframe;
    if (this.altKeyframe) {
      const name = getComputedStyle(element).getPropertyValue('--sol-reveal-name').trim() || 'solRevealFade';
      element.style.setProperty('--sol-reveal-name-b', `${name}B`);
      element.classList.add('sol-reveal-in--replay');
    } else {
      element.classList.remove('sol-reveal-in--replay');
    }
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}

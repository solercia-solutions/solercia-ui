/**
 * Bloqueo de scroll con contador de referencias: varios overlays a la vez
 * (un drawer sobre un modal, o dos drawers anidados) pueden pedir el
 * bloqueo sin pisarse — el `overflow` original solo se restaura cuando el
 * último overlay libera el candado (11-h-sol-drawer, T01).
 */
export interface BodyScrollLock {
  /** Bloquea el scroll del elemento objetivo (no-op si ya hay otro titular del candado). */
  lock(): void;
  /** Libera una referencia; solo restaura el `overflow` original cuando el contador llega a 0. */
  unlock(): void;
}

/**
 * El objetivo (por defecto `document.body`) se resuelve al bloquear, no al
 * importar el módulo: así la librería se puede importar en un prerender
 * (Node, sin `document`) y el candado no hace nada fuera del navegador.
 */
export function createBodyScrollLock(target?: HTMLElement): BodyScrollLock {
  let count = 0;
  let previousOverflow = '';
  const element = (): HTMLElement | null => target ?? (typeof document === 'undefined' ? null : document.body);

  return {
    lock(): void {
      const el = element();
      if (!el) return;
      if (count === 0) {
        previousOverflow = el.style.overflow;
        el.style.overflow = 'hidden';
      }
      count++;
    },
    unlock(): void {
      const el = element();
      if (!el || count === 0) return;
      count--;
      if (count === 0) {
        el.style.overflow = previousOverflow;
      }
    },
  };
}

/** Instancia compartida sobre `document.body` — un único contador para toda la app. */
export const bodyScrollLock: BodyScrollLock = createBodyScrollLock();

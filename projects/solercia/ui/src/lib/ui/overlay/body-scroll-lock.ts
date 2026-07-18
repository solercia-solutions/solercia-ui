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

export function createBodyScrollLock(target: HTMLElement = document.body): BodyScrollLock {
  let count = 0;
  let previousOverflow = '';

  return {
    lock(): void {
      if (count === 0) {
        previousOverflow = target.style.overflow;
        target.style.overflow = 'hidden';
      }
      count++;
    },
    unlock(): void {
      if (count === 0) return;
      count--;
      if (count === 0) {
        target.style.overflow = previousOverflow;
      }
    },
  };
}

/** Instancia compartida sobre `document.body` — un único contador para toda la app. */
export const bodyScrollLock: BodyScrollLock = createBodyScrollLock();

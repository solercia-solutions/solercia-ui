/**
 * Focus trap propio, sin `@angular/cdk/a11y` ni `@angular/cdk/overlay`
 * (filosofía in-house del proyecto — el CDK solo está permitido en el
 * drag-drop de `sol-kanban`, gateado por ESLint). Cicla el `Tab` dentro del
 * contenedor del overlay y devuelve el foco al disparador al desactivarse
 * (11-h-sol-drawer, T01/T03).
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface FocusTrapHandle {
  /** Enfoca el primer control del contenedor y empieza a interceptar `Tab`. */
  activate(returnFocusTo?: HTMLElement | null): void;
  /** Deja de interceptar `Tab` y devuelve el foco al disparador registrado en `activate`. */
  deactivate(): void;
}

export function createFocusTrap(container: HTMLElement): FocusTrapHandle {
  let triggerEl: HTMLElement | null = null;

  function focusableElements(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const elements = focusableElements();
    if (elements.length === 0) {
      // Sin controles focuseables: el propio contenedor absorbe el foco.
      event.preventDefault();
      container.focus();
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  return {
    activate(returnFocusTo = document.activeElement as HTMLElement | null): void {
      triggerEl = returnFocusTo;
      document.addEventListener('keydown', onKeydown);
      const [first] = focusableElements();
      (first ?? container).focus();
    },
    deactivate(): void {
      document.removeEventListener('keydown', onKeydown);
      triggerEl?.focus?.();
      triggerEl = null;
    },
  };
}

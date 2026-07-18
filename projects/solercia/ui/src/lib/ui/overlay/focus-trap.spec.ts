import { createFocusTrap } from './focus-trap';

function buildPanel(): { container: HTMLElement; first: HTMLButtonElement; last: HTMLButtonElement } {
  const container = document.createElement('div');
  container.tabIndex = -1;
  const first = document.createElement('button');
  first.textContent = 'Primero';
  const middle = document.createElement('input');
  const last = document.createElement('button');
  last.textContent = 'Último';
  container.append(first, middle, last);
  document.body.appendChild(container);
  return { container, first, last };
}

function pressTab(shiftKey = false): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
  );
}

describe('focus-trap — ciclo de foco in-house', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('activate() enfoca el primer control focuseable del contenedor', () => {
    const { container, first } = buildPanel();
    createFocusTrap(container).activate();
    expect(document.activeElement).toBe(first);
  });

  it('Tab en el último control cicla al primero', () => {
    const { container, first, last } = buildPanel();
    const trap = createFocusTrap(container);
    trap.activate();
    last.focus();
    pressTab();
    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab en el primer control cicla al último', () => {
    const { container, first, last } = buildPanel();
    const trap = createFocusTrap(container);
    trap.activate();
    first.focus();
    pressTab(true);
    expect(document.activeElement).toBe(last);
  });

  it('deactivate() devuelve el foco al disparador provisto', () => {
    const { container } = buildPanel();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const trap = createFocusTrap(container);
    trap.activate(trigger);
    trap.deactivate();

    expect(document.activeElement).toBe(trigger);
  });

  it('deactivate() deja de interceptar Tab (el foco puede salir del contenedor)', () => {
    const { container } = buildPanel();
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    const trap = createFocusTrap(container);
    trap.activate();
    trap.deactivate();
    outside.focus();

    expect(document.activeElement).toBe(outside);
  });

  it('sin controles focuseables, el propio contenedor absorbe el foco', () => {
    const container = document.createElement('div');
    container.tabIndex = -1;
    document.body.appendChild(container);

    createFocusTrap(container).activate();
    expect(document.activeElement).toBe(container);
  });
});

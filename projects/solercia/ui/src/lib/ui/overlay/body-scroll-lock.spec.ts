import { createBodyScrollLock } from './body-scroll-lock';

describe('body-scroll-lock — candado de scroll con contador de referencias', () => {
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement('div');
    target.style.overflow = 'auto';
  });

  it('bloquea overflow:hidden al primer lock y lo restaura al último unlock', () => {
    const lock = createBodyScrollLock(target);

    lock.lock();
    expect(target.style.overflow).toBe('hidden');

    lock.unlock();
    expect(target.style.overflow).toBe('auto');
  });

  it('no restaura mientras otro overlay siga sosteniendo el candado', () => {
    const lock = createBodyScrollLock(target);

    lock.lock();
    lock.lock();
    lock.unlock();
    expect(target.style.overflow).toBe('hidden');

    lock.unlock();
    expect(target.style.overflow).toBe('auto');
  });

  it('un unlock de más no revienta el contador (queda estable en 0)', () => {
    const lock = createBodyScrollLock(target);

    lock.unlock();
    lock.lock();
    expect(target.style.overflow).toBe('hidden');

    lock.unlock();
    expect(target.style.overflow).toBe('auto');
  });

  it('cada instancia creada por createBodyScrollLock lleva su propio contador', () => {
    const lockA = createBodyScrollLock(target);
    const otherTarget = document.createElement('div');
    otherTarget.style.overflow = 'scroll';
    const lockB = createBodyScrollLock(otherTarget);

    lockA.lock();
    expect(target.style.overflow).toBe('hidden');
    expect(otherTarget.style.overflow).toBe('scroll');

    lockB.lock();
    expect(otherTarget.style.overflow).toBe('hidden');
  });
});

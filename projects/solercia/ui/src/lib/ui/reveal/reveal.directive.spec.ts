import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SolRevealDirective } from './reveal.directive';

@Component({
  standalone: true,
  imports: [SolRevealDirective],
  template: `<section solReveal [solRevealIndex]="index()" [solRevealReplay]="replay()">x</section>`,
})
class HostComponent {
  readonly index = signal(3);
  readonly replay = signal(0);
}

describe('SolRevealDirective', () => {
  let callback: IntersectionObserverCallback | null;
  const original = globalThis.IntersectionObserver;

  beforeEach(() => {
    callback = null;
    class FakeObserver {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  afterEach(() => {
    globalThis.IntersectionObserver = original;
    document.head.querySelectorAll('style[data-sol-reveal-styles]').forEach(style => style.remove());
  });

  function create() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const section = (fixture.nativeElement as HTMLElement).querySelector('section') as HTMLElement;
    return { fixture, section };
  }

  it('oculta hasta entrar al viewport y luego agrega .sol-reveal-in con el índice del stagger', () => {
    const { section } = create();
    expect(section.style.opacity).toBe('0');
    expect(section.style.getPropertyValue('--sol-reveal-index')).toBe('3');

    callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(section.style.opacity).toBe('');
    expect(section.classList.contains('sol-reveal-in')).toBe(true);
  });

  it('inyecta una sola vez los keyframes globales', () => {
    create();
    create();
    expect(document.head.querySelectorAll('style[data-sol-reveal-styles]')).toHaveLength(1);
    expect(document.head.querySelector('style[data-sol-reveal-styles]')?.textContent).toContain('solRevealRise');
  });

  it('el replay alterna la clase de keyframe duplicado', () => {
    const { fixture, section } = create();
    callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    fixture.componentInstance.replay.set(1);
    fixture.detectChanges();
    expect(section.classList.contains('sol-reveal-in--replay')).toBe(true);
  });

  it('sin IntersectionObserver deja el elemento visible', () => {
    globalThis.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;
    const { section } = create();
    expect(section.style.opacity).toBe('');
  });
});

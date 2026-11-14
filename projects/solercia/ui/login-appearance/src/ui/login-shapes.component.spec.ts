import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginBackground, LoginPosition } from '../model/login-appearance.model';
import { SolLoginShapesComponent } from './login-shapes.component';

let measure: () => void = () => undefined;

class ResizeObserverDouble {
  constructor(cb: () => void) {
    measure = cb;
  }
  observe(): void {}
  disconnect(): void {}
}

@Component({
  standalone: true,
  imports: [SolLoginShapesComponent],
  template: `<div class="card"><sol-login-shapes [background]="background()" [position]="position()" [fixedScale]="fixedScale()" /></div>`,
})
class HostComponent {
  readonly background = signal<LoginBackground>('circles');
  readonly position = signal<LoginPosition>('center');
  readonly fixedScale = signal<number | null>(null);
}

function mount(background: LoginBackground, position: LoginPosition, fixedScale: number | null = null) {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.background.set(background);
  fixture.componentInstance.position.set(position);
  fixture.componentInstance.fixedScale.set(fixedScale);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const shapes = () => Array.from(root.querySelectorAll<HTMLElement>('sol-login-shapes > .s'));
  return { fixture, root, shapes, host: root.querySelector('sol-login-shapes') as HTMLElement };
}

const leftOf = (s: HTMLElement) => parseFloat(s.style.left);

describe('SolLoginShapesComponent', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', ResizeObserverDouble));
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('draws the 250 mosaic pieces on either side, plus the extra columns', () => {
    expect(mount('triangles', 'right').shapes().length).toBeGreaterThanOrEqual(250);
    TestBed.resetTestingModule();
    expect(mount('triangles', 'left').shapes().length).toBeGreaterThanOrEqual(250);
  });

  it('on the left it mirrors the mosaic around the form', () => {
    const right = leftOf(mount('triangles', 'right').shapes()[0]);
    TestBed.resetTestingModule();
    const mirrored = mount('triangles', 'left').shapes()[0];

    expect(leftOf(mirrored)).toBeCloseTo(-right - 64, 5);
  });

  it('centered, it anchors the main circle around the form', () => {
    const main = mount('circles', 'center').shapes()[4];

    expect(leftOf(main)).toBe(330 - 650);
    expect(parseFloat(main.style.width)).toBe(640);
  });

  it('scales with the real form box', () => {
    const { fixture, root, host } = mount('circles', 'center');
    const card = root.querySelector('.card') as HTMLElement;
    Object.defineProperty(card, 'offsetWidth', { configurable: true, value: 420 });
    Object.defineProperty(card, 'offsetHeight', { configurable: true, value: 672 });

    measure();
    fixture.detectChanges();

    expect(host.style.fontSize).toBe('1.5px');
  });

  it('a fixed scale wins and marks the host so it also shows on mobile', () => {
    const { host } = mount('facets', 'right', 0.09);

    expect(host.style.fontSize).toBe('0.09px');
    expect(host.classList.contains('fixed-scale')).toBe(true);
  });

  it('paints tones only with theme tokens', () => {
    const backgrounds = mount('facets', 'left')
      .shapes()
      .map(s => s.style.background)
      .filter(Boolean);

    expect(backgrounds.length).toBeGreaterThan(0);
    expect(backgrounds.every(bg => bg.includes('var(--sol-'))).toBe(true);
  });

  it('draws no shapes on backgrounds without shapes', () => {
    expect(mount('solid', 'left').shapes()).toHaveLength(0);
  });
});

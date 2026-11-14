import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SolLoginPhotosComponent } from './login-photos.component';

function mount(photos: string[], intervalMs = 3000): { fixture: ComponentFixture<SolLoginPhotosComponent>; emitted: number[] } {
  const fixture = TestBed.createComponent(SolLoginPhotosComponent);
  const emitted: number[] = [];
  fixture.componentInstance.activePhoto.subscribe(i => emitted.push(i));
  fixture.componentRef.setInput('photos', photos);
  fixture.componentRef.setInput('intervalMs', intervalMs);
  fixture.detectChanges();
  return { fixture, emitted };
}

const activeIndex = (fixture: ComponentFixture<SolLoginPhotosComponent>) =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('img')).findIndex(img => img.classList.contains('photo--active'));

function reducedMotion(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: matches && query.includes('reduce'), media: query }));
}

describe('SolLoginPhotosComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('paints every photo as decorative, the first one in front', () => {
    reducedMotion(false);
    const { fixture } = mount(['/a.jpg', '/b.jpg']);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(Array.from(host.querySelectorAll('img')).map(img => img.getAttribute('alt'))).toEqual(['', '']);
    expect(activeIndex(fixture)).toBe(0);
  });

  it('advances one photo per interval, wraps around and reports it', () => {
    vi.useFakeTimers();
    reducedMotion(false);
    const { fixture, emitted } = mount(['/a.jpg', '/b.jpg'], 3000);

    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(activeIndex(fixture)).toBe(1);

    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(activeIndex(fixture)).toBe(0);
    expect(emitted).toEqual([1, 0]);
  });

  it('with reduced motion keeps the first photo still', () => {
    vi.useFakeTimers();
    reducedMotion(true);
    const { fixture, emitted } = mount(['/a.jpg', '/b.jpg'], 3000);

    vi.advanceTimersByTime(9000);
    fixture.detectChanges();

    expect(activeIndex(fixture)).toBe(0);
    expect(emitted).toEqual([]);
  });

  it('a single photo does not rotate', () => {
    vi.useFakeTimers();
    reducedMotion(false);
    const { emitted } = mount(['/a.jpg'], 3000);

    vi.advanceTimersByTime(9000);

    expect(emitted).toEqual([]);
  });

  it('the animation lasts the interval plus the exit tail', () => {
    reducedMotion(false);
    const { fixture } = mount(['/a.jpg', '/b.jpg'], 5000);

    expect((fixture.nativeElement as HTMLElement).style.getPropertyValue('--sol-login-photo-duration')).toBe('7000ms');
  });
});

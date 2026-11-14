import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLoginView, normalizeLogin } from '../lib/normalize-login';
import type { LoginView } from '../model/login-appearance.model';
import type { LoginBrandLogo } from './login-brand.component';
import { SolLoginFrameComponent } from './login-frame.component';

class ResizeObserverDouble {
  observe(): void {}
  disconnect(): void {}
}

@Component({
  standalone: true,
  imports: [SolLoginFrameComponent],
  template: `
    <sol-login-frame [view]="view()" [tagline]="tagline()" [logo]="logo()">
      <form data-testid="host-form"><input name="user" /></form>
    </sol-login-frame>
  `,
})
class HostComponent {
  readonly view = signal<LoginView | null>(null);
  readonly tagline = signal('Agenda sin complicaciones');
  readonly logo = signal<LoginBrandLogo | null>(null);
}

function mount(view: LoginView | null, logo: LoginBrandLogo | null = null) {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.view.set(view);
  fixture.componentInstance.logo.set(logo);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { root, frame: root.querySelector('[data-testid="login-frame"]') as HTMLElement };
}

const view = (login: unknown, dark = false) => buildLoginView(normalizeLogin(login), ['/uploads/a.jpg', '/uploads/b.jpg'], dark);

describe('SolLoginFrameComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverDouble);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('projects the host form inside the themed card', () => {
    const { root } = mount(view({}));

    expect(root.querySelector('[data-testid="login-frame-card"] [data-testid="host-form"]')).not.toBeNull();
  });

  it('without a view keeps the classic card: no photos, no scene, form still projected', () => {
    const { root, frame } = mount(null);

    expect(root.querySelector('sol-login-scene')).toBeNull();
    expect(root.querySelector('sol-login-panel-background')).toBeNull();
    expect(frame.classList.contains('frame--immersive')).toBe(false);
    expect(root.querySelector('[data-testid="host-form"]')).not.toBeNull();
  });

  it('with a view paints the scene with the theme photos and the caption text', () => {
    const { root, frame } = mount(view({ caption: { label: 'Mi marca' } }));

    expect(frame.classList.contains('frame--immersive')).toBe(true);
    expect(Array.from(root.querySelectorAll('[data-testid="login-photo"]')).map(i => i.getAttribute('src'))).toEqual([
      '/uploads/a.jpg',
      '/uploads/b.jpg',
    ]);
    expect(root.querySelector('[data-testid="login-caption-text"]')?.textContent).toBe('Agenda sin complicaciones');
    expect(root.querySelector('[data-testid="login-caption-label"]')?.textContent).toBe('Mi marca');
  });

  it('applies the mode variables and the form side to the frame', () => {
    const { frame } = mount(view({ modes: { light: { position: 'left', background: 'glass' } } }));

    expect(frame.getAttribute('data-pos')).toBe('left');
    expect(frame.style.getPropertyValue('--sol-auth-veil-rgb')).not.toBe('');
  });

  it('with a shape background the shapes are the container and the veil goes away', () => {
    const { root, frame } = mount(view({ modes: { light: { background: 'facets' } } }));

    expect(frame.classList.contains('frame--shapes')).toBe(true);
    expect(root.querySelector('sol-login-shapes')).not.toBeNull();
    expect(root.querySelector('[data-testid="login-veil"]')).toBeNull();
    expect(root.querySelector('sol-login-panel-background')?.classList.contains('with-shapes')).toBe(true);
  });

  it('shows the brand block only when a logo is given', () => {
    expect(mount(view({})).root.querySelector('sol-login-brand')).toBeNull();
    TestBed.resetTestingModule();
    const { root } = mount(view({}), { url: '/uploads/logo.png', altText: 'Mi marca' });
    expect(root.querySelector('[data-testid="login-brand-logo"]')?.getAttribute('src')).toBe('/uploads/logo.png');
  });
});

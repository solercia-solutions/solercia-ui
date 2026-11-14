import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { SolLoginBrandComponent, type LoginBrandLogo } from './login-brand.component';

function mount(logo: LoginBrandLogo | null, dark = false, tagline: string | null = null): HTMLElement {
  const fixture = TestBed.createComponent(SolLoginBrandComponent);
  fixture.componentRef.setInput('logo', logo);
  fixture.componentRef.setInput('dark', dark);
  fixture.componentRef.setInput('tagline', tagline);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const img = (host: HTMLElement) => host.querySelector('[data-testid="login-brand-logo"]') as HTMLImageElement | null;

describe('SolLoginBrandComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows the theme logo with its alternative text', () => {
    const host = mount({ url: '/uploads/logo.png', altText: 'Mi marca' });

    expect(img(host)?.getAttribute('src')).toBe('/uploads/logo.png');
    expect(img(host)?.getAttribute('alt')).toBe('Mi marca');
  });

  it('uses the dark variant only in dark mode and falls back to the main logo', () => {
    const logo = { url: '/uploads/logo.png', urlDark: '/uploads/logo-dark.png', altText: 'Mi marca' };

    expect(img(mount(logo, true))?.getAttribute('src')).toBe('/uploads/logo-dark.png');
    TestBed.resetTestingModule();
    expect(img(mount(logo, false))?.getAttribute('src')).toBe('/uploads/logo.png');
    TestBed.resetTestingModule();
    expect(img(mount({ url: '/uploads/logo.png', urlDark: null }, true))?.getAttribute('src')).toBe('/uploads/logo.png');
  });

  it('never paints an unsafe URL: it writes the alternative text instead', () => {
    const host = mount({ url: 'javascript:alert(1)', urlDark: 'data:image/svg+xml,x', altText: 'Mi marca' }, true);

    expect(img(host)).toBeNull();
    expect(host.querySelector('[data-testid="login-brand-wordmark"]')?.textContent?.trim()).toBe('Mi marca');
  });

  it('renders nothing without a logo and shows the tagline when given', () => {
    expect(mount(null).textContent?.trim()).toBe('');
    TestBed.resetTestingModule();
    expect(mount({ url: '/l.png' }, false, 'Agenda tus citas').querySelector('[data-testid="login-brand-tagline"]')?.textContent).toBe(
      'Agenda tus citas',
    );
  });
});

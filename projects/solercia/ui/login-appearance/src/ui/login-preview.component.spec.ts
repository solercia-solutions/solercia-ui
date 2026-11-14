import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { SOL_BUNDLED_DEFAULT_THEME, type ThemeFile } from '@solercia/ui';
import { buildLoginView, normalizeLogin } from '../lib/normalize-login';
import { SolLoginPreviewComponent } from './login-preview.component';

function theme(extra: Partial<ThemeFile['meta']> = {}): ThemeFile {
  const base = structuredClone(SOL_BUNDLED_DEFAULT_THEME) as ThemeFile;
  return { ...base, meta: { ...base.meta, logo: { url: '/uploads/logo.png', altText: 'Mi marca', width: 120 }, ...extra } };
}

function mount(login: unknown, dark: boolean, file: ThemeFile | null = theme(), tagline: string | null = null): HTMLElement {
  const fixture = TestBed.createComponent(SolLoginPreviewComponent);
  fixture.componentRef.setInput('view', buildLoginView(normalizeLogin(login), ['/uploads/a.jpg'], dark));
  fixture.componentRef.setInput('dark', dark);
  fixture.componentRef.setInput('theme', file);
  fixture.componentRef.setInput('tagline', tagline);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const canvas = (host: HTMLElement) => host.querySelector('[data-testid="login-preview"]') as HTMLElement;

describe('SolLoginPreviewComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows the theme logo over the title and the mock fields with their labels in Spanish', () => {
    const host = mount({ modes: { dark: { background: 'facets' } } }, true);

    expect(host.querySelector('[data-testid="login-brand-logo"]')?.getAttribute('src')).toBe('/uploads/logo.png');
    expect(host.textContent).toContain('Correo electrónico');
    expect(host.textContent).toContain('Ingresa tu contraseña');
    expect(host.querySelector('sol-login-shapes')).not.toBeNull();
  });

  it('is inert: the preview never signs in', () => {
    expect(canvas(mount({}, false)).hasAttribute('inert')).toBe(true);
  });

  it('uses the theme tagline as caption, then the library fallback, unless one is given', () => {
    expect(mount({}, false, theme({ tagline: 'Agenda sin filas' })).textContent).toContain('Agenda sin filas');
    TestBed.resetTestingModule();
    expect(mount({}, false, theme({ tagline: '  ' })).textContent).toContain('Todo tu trabajo, en un solo lugar.');
    TestBed.resetTestingModule();
    expect(mount({}, false, theme({ tagline: 'Agenda sin filas' }), 'Otra frase').textContent).toContain('Otra frase');
  });

  it('applies the tokens of the shown mode on the frame, independent of the app mode', () => {
    const dark = canvas(mount({}, true));
    TestBed.resetTestingModule();
    const light = canvas(mount({}, false));

    expect(dark.style.getPropertyValue('--sol-bg-surface')).not.toBe('');
    expect(dark.style.getPropertyValue('--sol-bg-surface')).not.toBe(light.style.getPropertyValue('--sol-bg-surface'));
  });

  it('an unresolvable theme keeps the app tokens instead of breaking', () => {
    const broken = { meta: { tenant: 'x', logo: { url: '', altText: '', width: 1 } }, primitives: {}, modes: {} } as unknown as ThemeFile;
    const host = mount({}, false, broken);

    expect(canvas(host).style.getPropertyValue('--sol-bg-surface')).toBe('');
    expect(canvas(host).style.getPropertyValue('--sol-auth-veil-rgb')).not.toBe('');
  });

  it('with a gradient it keeps the rectangular panel', () => {
    const host = mount({ modes: { light: { background: 'glass-fade' } } }, false);

    expect(host.querySelector('sol-login-panel-background')?.classList.contains('with-shapes')).toBe(false);
    expect(host.querySelector('sol-login-shapes')).toBeNull();
  });
});

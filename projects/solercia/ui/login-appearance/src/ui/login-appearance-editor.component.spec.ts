import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from '@solercia/ui';
import type { ThemeLogin } from '../model/login-appearance.model';
import { SolLoginAppearanceEditorComponent, type LoginPhotoUploader } from './login-appearance-editor.component';

const VEIL = { rgb: '16,25,24', from: 0.12, to: 0.94, bottom: 0.7 };
const PANEL = { bg: 'rgba(21,32,31,0.42)', blur: '34px', saturate: 1.3, border: '1px solid rgba(227,236,234,0.10)', radius: '12px' };
const BASE: ThemeLogin = {
  images: ['assets/login/a.jpg', 'assets/login/b.jpg'],
  intervalMs: 7000,
  effect: 'zoom',
  transition: 'fade',
  caption: { label: 'Etiqueta', indicators: true },
  modes: {
    dark: { position: 'right', background: 'glass-fade', veil: VEIL, panel: PANEL },
    light: { position: 'left', background: 'glass-fade' },
  },
};

class ResizeObserverDouble {
  observe(): void {}
  disconnect(): void {}
}

interface Mounted {
  fixture: ComponentFixture<SolLoginAppearanceEditorComponent>;
  host: HTMLElement;
  emitted: ThemeLogin[];
  press: (testId: string) => void;
}

function mount(
  base: ThemeLogin = BASE,
  inputs: { uploader?: LoginPhotoUploader | null; fallbackImages?: string[]; describeError?: (e: unknown) => string | null } = {},
): Mounted {
  TestBed.configureTestingModule({
    providers: [{ provide: ThemeService, useValue: { activeTheme: signal(null), isDark: signal(true) } }],
  });
  const fixture = TestBed.createComponent(SolLoginAppearanceEditorComponent);
  const emitted: ThemeLogin[] = [];
  fixture.componentInstance.loginChange.subscribe(v => emitted.push(v));
  fixture.componentRef.setInput('base', base);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const press = (testId: string) => {
    (host.querySelector(`[data-testid="${testId}"]`) as HTMLElement).click();
    fixture.detectChanges();
  };
  return { fixture, host, emitted, press };
}

async function upload(m: Mounted, names: string[]): Promise<void> {
  const field = m.host.querySelector('[data-testid="login-photos-file"]') as HTMLInputElement;
  Object.defineProperty(field, 'files', { configurable: true, value: names.map(n => new File(['x'], n, { type: 'image/jpeg' })) });
  field.dispatchEvent(new Event('change'));
  await new Promise(resolve => setTimeout(resolve, 0));
  m.fixture.detectChanges();
}

const uploaderReturning = (url: string) => vi.fn<(file: File) => Observable<string>>(() => of(url));

describe('SolLoginAppearanceEditorComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverDouble);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('emits nothing until the person changes something', () => {
    expect(mount().emitted).toHaveLength(0);
  });

  it('starts on the active app mode and changing the position keeps veil and panel', () => {
    const { emitted, press } = mount();

    press('login-position-left');

    expect(emitted.at(-1)?.modes?.dark?.position).toBe('left');
    expect(emitted.at(-1)?.modes?.dark?.veil).toEqual(VEIL);
    expect(emitted.at(-1)?.modes?.dark?.panel).toEqual(PANEL);
  });

  it('effect and transition change separately', () => {
    const { emitted, press } = mount();

    press('login-transition-focus');

    expect(emitted.at(-1)?.effect).toBe('zoom');
    expect(emitted.at(-1)?.transition).toBe('focus');
  });

  it('the duration moves in steps and stops at the bounds', () => {
    const { emitted, press, host } = mount({ ...BASE, intervalMs: 19000 });

    press('login-duration-more');
    expect(emitted.at(-1)?.intervalMs).toBe(20000);
    expect((host.querySelector('[data-testid="login-duration-more"]') as HTMLButtonElement).disabled).toBe(true);
    expect(host.querySelector('[data-testid="login-duration-value"]')?.textContent).toBe('20 s');
    expect(emitted).toHaveLength(1);

    TestBed.resetTestingModule();
    const low = mount({ ...BASE, intervalMs: 3000 });
    expect((low.host.querySelector('[data-testid="login-duration-less"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('the background type is chosen per mode', () => {
    const { emitted, press } = mount();

    press('login-background-circles');
    expect(emitted.at(-1)?.modes?.dark?.background).toBe('circles');
    expect(emitted.at(-1)?.modes?.light?.background).toBe('glass-fade');

    press('login-mode-light');
    press('login-background-solid');
    expect(emitted.at(-1)?.modes?.light?.background).toBe('solid');
    expect(emitted.at(-1)?.modes?.dark?.background).toBe('circles');
  });

  it('edits the caption label and the indicators', () => {
    const { emitted, host, fixture } = mount();
    const label = host.querySelector('[data-testid="login-caption-label-input"]') as HTMLInputElement;
    label.value = 'Mi marca';
    label.dispatchEvent(new Event('input'));
    const indicators = host.querySelector('[data-testid="login-caption-indicators-input"]') as HTMLInputElement;
    indicators.checked = false;
    indicators.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted.at(-1)?.caption).toEqual({ label: 'Mi marca', indicators: false });
  });

  it('uploads a photo and appends its URL', async () => {
    const uploader = uploaderReturning('/uploads/new.jpg');
    const m = mount(BASE, { uploader });

    await upload(m, ['new.jpg']);

    expect(uploader).toHaveBeenCalledTimes(1);
    expect(m.emitted.at(-1)?.images).toEqual(['assets/login/a.jpg', 'assets/login/b.jpg', '/uploads/new.jpg']);
  });

  it('rejects an uploaded URL the login cannot paint', async () => {
    const m = mount(BASE, { uploader: uploaderReturning('http://plain.test/a.jpg') });

    await upload(m, ['a.jpg']);

    expect(m.emitted).toHaveLength(0);
    expect(m.host.querySelector('[data-testid="login-photos-error"]')?.textContent).toContain('a.jpg');
  });

  it('when the upload fails it shows the error with the host detail and keeps the list', async () => {
    const m = mount(BASE, {
      uploader: vi.fn(() => throwError(() => ({ status: 422 }))),
      describeError: () => 'La imagen pesa demasiado.',
    });

    await upload(m, ['bad.jpg']);

    const error = m.host.querySelector('[data-testid="login-photos-error"]');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('bad.jpg');
    expect(error?.textContent).toContain('La imagen pesa demasiado.');
    expect(m.emitted).toHaveLength(0);
  });

  it('only uploads what fits up to 12 photos and says so', async () => {
    const images = Array.from({ length: 11 }, (_, i) => `/uploads/f${i}.jpg`);
    const uploader = vi.fn((file: File) => of(`/uploads/${file.name}`));
    const m = mount({ ...BASE, images }, { uploader });

    await upload(m, ['x1.jpg', 'x2.jpg']);

    expect(uploader).toHaveBeenCalledTimes(1);
    expect(m.emitted.at(-1)?.images).toHaveLength(12);
    expect(m.host.querySelector('[data-testid="login-photos-error"]')?.textContent).toContain('12');
  });

  it('without an uploader it says upload is unavailable', () => {
    const { host } = mount();

    expect(host.querySelector('[data-testid="login-photos-file"]')).toBeNull();
    expect(host.querySelector('[data-testid="login-photos-unavailable"]')).not.toBeNull();
  });

  it('removes and reorders photos', () => {
    const { emitted, press } = mount();

    press('login-photo-down-0');
    expect(emitted.at(-1)?.images).toEqual(['assets/login/b.jpg', 'assets/login/a.jpg']);

    press('login-photo-remove-0');
    expect(emitted.at(-1)?.images).toEqual(['assets/login/a.jpg']);
  });

  it('with 12 photos it does not let you add more and says why', () => {
    const images = Array.from({ length: 12 }, (_, i) => `/uploads/f${i}.jpg`);
    const { host } = mount({ ...BASE, images }, { uploader: uploaderReturning('/uploads/x.jpg') });

    expect((host.querySelector('[data-testid="login-photos-add"]') as HTMLButtonElement).disabled).toBe(true);
    expect(host.querySelector('[data-testid="login-photos-limit"]')?.textContent).toContain('12');
  });

  it('reset restores defaults with the fallback photos, keeps veil and panel, and can be undone', () => {
    const { emitted, press, host } = mount({ ...BASE, effect: 'none', intervalMs: 15000 }, { fallbackImages: ['assets/login/app.jpg', 'javascript:x'] });

    press('login-reset');

    expect(emitted.at(-1)?.effect).toBe('zoom');
    expect(emitted.at(-1)?.intervalMs).toBe(7000);
    expect(emitted.at(-1)?.images).toEqual(['assets/login/app.jpg']);
    expect(emitted.at(-1)?.caption).toEqual({ indicators: true });
    expect(emitted.at(-1)?.modes?.dark?.veil).toEqual(VEIL);

    press('login-undo');
    expect(emitted.at(-1)?.effect).toBe('none');
    expect(host.querySelector('[data-testid="login-undo"]')).toBeNull();
  });

  it('previews the fallback photos when the block has none, and an empty state without any', () => {
    const withFallback = mount({ ...BASE, images: [] }, { fallbackImages: ['assets/login/app.jpg'] });
    expect(withFallback.host.querySelector('[data-testid="login-preview"]')).not.toBeNull();

    TestBed.resetTestingModule();
    const empty = mount({ ...BASE, images: [] });
    expect(empty.host.querySelector('[data-testid="login-preview"]')).toBeNull();
    expect(empty.host.querySelector('[data-testid="login-preview-empty"]')).not.toBeNull();
    expect(empty.host.querySelector('[data-testid="login-photos-empty"]')).not.toBeNull();
  });

  it('a new base discards the draft', () => {
    const { fixture, press, host } = mount();
    press('login-effect-none');
    expect(host.querySelector('[data-testid="login-effect-none"]')?.getAttribute('aria-pressed')).toBe('true');

    fixture.componentRef.setInput('base', { ...BASE, effect: 'focus' });
    fixture.detectChanges();

    expect(host.querySelector('[data-testid="login-effect-focus"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('the apply shortcut only shows on request and emits', () => {
    const { host, fixture } = mount();
    expect(host.querySelector('[data-testid="login-go-to-apply"]')).toBeNull();

    let clicks = 0;
    fixture.componentInstance.goToApply.subscribe(() => clicks++);
    fixture.componentRef.setInput('showApplyShortcut', true);
    fixture.detectChanges();
    (host.querySelector('[data-testid="login-go-to-apply"]') as HTMLElement).click();

    expect(clicks).toBe(1);
  });

  it('texts are Colombian Spanish by default', () => {
    const text = mount().host.textContent ?? '';

    expect(text).toContain('Restablecer valores predeterminados');
    expect(text).toContain('Duración de cada foto');
  });
});

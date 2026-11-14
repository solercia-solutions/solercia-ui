import { describe, expect, it } from 'vitest';
import {
  buildLoginView,
  isAllowedLoginImage,
  normalizeLogin,
  normalizeLoginAppearance,
  resolveLoginView,
} from './normalize-login';

describe('normalizeLogin: panel values', () => {
  const panel = (values: Record<string, unknown>) => normalizeLogin({ modes: { light: { panel: values } } })?.modes?.light?.panel;

  it.each(['\\75 rl(data:x)', 'expression(alert(1))', 'image-set("x")', 'var(--x)', 'hsl(0 0% 0%)', 'red', 'rgba(300,0,0,1)'])(
    'drops %s as panel background',
    bg => expect(panel({ bg, radius: '12px' })).toEqual({ radius: '12px' }),
  );

  it('accepts hex and in-range rgba', () => {
    expect(panel({ bg: '#112233' })).toEqual({ bg: '#112233' });
    expect(panel({ bg: 'rgba(21,32,31,0.42)' })).toEqual({ bg: 'rgba(21,32,31,0.42)' });
  });

  it('blur and radius only accept pixels within the cap', () => {
    expect(panel({ blur: '60px', radius: '32px' })).toEqual({ blur: '60px', radius: '32px' });
    expect(panel({ blur: '0) \\75 rl(https://evil.test/x)', radius: '1rem' })).toBeUndefined();
    expect(panel({ blur: '61px', radius: '33px' })).toBeUndefined();
  });

  it('the border needs up to 4 px and a valid color', () => {
    expect(panel({ border: '1px solid rgba(255,255,255,0.8)' })).toEqual({ border: '1px solid rgba(255,255,255,0.8)' });
    expect(panel({ border: '5px solid #fff' })).toBeUndefined();
    expect(panel({ border: '1px solid var(--x)' })).toBeUndefined();
  });
});

describe('normalizeLogin', () => {
  it('returns null when the input is not an object', () => {
    expect(normalizeLogin(null)).toBeNull();
    expect(normalizeLogin('zoom')).toBeNull();
    expect(normalizeLogin([])).toBeNull();
  });

  it('a value outside the closed list takes its default', () => {
    const login = normalizeLogin({
      effect: 'spin',
      transition: 'curtain',
      modes: { dark: { position: 'top', background: 'hexagons', captionPosition: 'middle' } },
    });

    expect(login?.effect).toBe('zoom');
    expect(login?.transition).toBe('fade');
    expect(login?.modes?.dark?.position).toBe('right');
    expect(login?.modes?.dark?.background).toBe('glass-fade');
    expect(login?.modes?.dark?.captionPosition).toBeUndefined();
  });

  it.each([
    [1000, 3000],
    [7500, 7500],
    [90000, 20000],
    ['5000', 7000],
    [Number.NaN, 7000],
  ])('intervalMs %s becomes %s', (received, expected) => {
    expect(normalizeLogin({ intervalMs: received })?.intervalMs).toBe(expected);
  });

  it('drops disallowed, repeated and over-12 images, keeping order', () => {
    const valid = Array.from({ length: 14 }, (_, i) => `/uploads/photo-${i}.jpg`);
    const login = normalizeLogin({
      images: ['http://plain.test/a.jpg', 'assets/login/a.jpg', 'assets/login/a.jpg', '/uploads/../x.jpg', 'javascript:alert(1)', 7, ...valid],
    });

    expect(login?.images?.[0]).toBe('assets/login/a.jpg');
    expect(login?.images).toHaveLength(12);
    expect(login?.images).not.toContain('http://plain.test/a.jpg');
    expect(new Set(login?.images).size).toBe(12);
  });

  it.each(['url(https://x.test/a.png)', 'rgba(0,0,0,.4); color: red', '<b>red</b>', 'URL(x)'])('rejects the CSS string %s', bad => {
    const login = normalizeLogin({ modes: { dark: { panel: { bg: bad, border: bad, radius: bad, blur: bad } } } });

    expect(login?.modes?.dark?.panel).toBeUndefined();
  });

  it('keeps a valid veil and panel and bounds their numbers', () => {
    const login = normalizeLogin({
      modes: {
        light: {
          veil: { rgb: '244,248,247', from: -1, to: 3, bottom: 0.55 },
          panel: { bg: 'rgba(255,255,255,0.48)', blur: '42px', saturate: 9, border: '1px solid rgba(255,255,255,0.8)', radius: '12px' },
        },
      },
    });

    expect(login?.modes?.light?.veil).toEqual({ rgb: '244,248,247', from: 0, to: 1, bottom: 0.55 });
    expect(login?.modes?.light?.panel).toEqual({
      bg: 'rgba(255,255,255,0.48)',
      blur: '42px',
      saturate: 3,
      border: '1px solid rgba(255,255,255,0.8)',
      radius: '12px',
    });
  });

  it('drops a veil color that is not r,g,b', () => {
    expect(normalizeLogin({ modes: { dark: { veil: { rgb: '300,0,0' } } } })?.modes?.dark?.veil).toBeUndefined();
    expect(normalizeLogin({ modes: { dark: { veil: { rgb: 'red' } } } })?.modes?.dark?.veil).toBeUndefined();
  });

  it('trims the caption label to 80 characters and keeps the indicators flag', () => {
    const login = normalizeLogin({ caption: { label: `  ${'x'.repeat(100)}  `, indicators: false } });

    expect(login?.caption?.label).toHaveLength(80);
    expect(login?.caption?.indicators).toBe(false);
    expect(normalizeLogin({ caption: { label: '   ', indicators: 'yes' } })?.caption).toBeUndefined();
  });
});

describe('isAllowedLoginImage', () => {
  it.each(['assets/login/a.jpg', '/assets/login/a.jpg', '/uploads/abc-123.png', 'https://cdn.test/photos/a.webp', 'https://cdn.test/a.avif?v=2'])(
    'accepts %s',
    url => expect(isAllowedLoginImage(url)).toBe(true),
  );

  it.each([
    'http://cdn.test/a.jpg',
    '//cdn.test/a.jpg',
    'assets/login/../../secret.jpg',
    'assets/login/a.gif',
    'assets/login/a.svg',
    'data:image/png;base64,xx',
    'javascript:alert(1).png',
    'images/a.jpg',
    '/a b.jpg',
    '/a").jpg',
    'https:///a.jpg',
  ])('rejects %s', url => expect(isAllowedLoginImage(url)).toBe(false));

  it('rejects non-strings and overlong URLs', () => {
    expect(isAllowedLoginImage(7)).toBe(false);
    expect(isAllowedLoginImage(`/${'a'.repeat(2050)}.jpg`)).toBe(false);
  });
});

describe('normalizeLoginAppearance', () => {
  it('returns null without usable data', () => {
    expect(normalizeLoginAppearance(undefined)).toBeNull();
    expect(normalizeLoginAppearance({ login: null, logo: null })).toBeNull();
  });

  it('keeps the tenant default mode and drops unknown values', () => {
    expect(normalizeLoginAppearance({ login: null, logo: null, mode: 'dark' })).toEqual({ login: null, logo: null, mode: 'dark' });
    expect(normalizeLoginAppearance({ login: { images: ['assets/login/a.jpg'] }, logo: null, mode: 'sepia' })?.mode).toBeNull();
  });

  it('drops a logo with a disallowed scheme', () => {
    expect(normalizeLoginAppearance({ logo: { url: 'javascript:alert(1)', altText: 'x' } })).toBeNull();
  });

  it('keeps the logo with its dark variant and drops an unsafe dark variant', () => {
    expect(normalizeLoginAppearance({ logo: { url: '/uploads/l.png', urlDark: '/uploads/d.png', altText: ' Brand ' } })?.logo).toEqual({
      url: '/uploads/l.png',
      urlDark: '/uploads/d.png',
      altText: 'Brand',
    });
    expect(normalizeLoginAppearance({ logo: { url: '/uploads/l.png', urlDark: '//evil.test/x.png' } })?.logo?.urlDark).toBeNull();
  });
});

describe('resolveLoginView', () => {
  const withPhoto = (photo: string, effect: string) => ({ images: [photo], effect });

  it('the published appearance wins over the theme and the fallback', () => {
    const view = resolveLoginView(
      {
        published: normalizeLogin(withPhoto('/uploads/p.jpg', 'focus')),
        theme: withPhoto('assets/login/t.jpg', 'zoom'),
        fallbackImages: ['assets/login/f.jpg'],
      },
      false,
    );

    expect(view?.images).toEqual(['/uploads/p.jpg']);
    expect(view?.effect).toBe('focus');
  });

  it('without a published appearance it uses the theme meta.login', () => {
    const view = resolveLoginView({ published: null, theme: withPhoto('assets/login/t.jpg', 'none'), fallbackImages: ['assets/login/f.jpg'] }, false);

    expect(view?.images).toEqual(['assets/login/t.jpg']);
    expect(view?.effect).toBe('none');
  });

  it('without meta.login it uses the fallback photos with the defaults', () => {
    const view = resolveLoginView({ published: null, theme: undefined, fallbackImages: ['assets/login/f.jpg'] }, false);

    expect(view?.images).toEqual(['assets/login/f.jpg']);
    expect(view?.effect).toBe('zoom');
    expect(view?.intervalMs).toBe(7000);
  });

  it('keeps the motion of a configuration without photos but takes the next source photos', () => {
    const view = resolveLoginView({ published: null, theme: { effect: 'none', images: [] }, fallbackImages: ['assets/login/f.jpg'] }, false);

    expect(view?.images).toEqual(['assets/login/f.jpg']);
    expect(view?.effect).toBe('none');
  });

  it('drops unsafe fallback photos', () => {
    expect(resolveLoginView({ published: null, theme: undefined, fallbackImages: ['javascript:x', '//x.test/a.jpg'] }, false)).toBeNull();
  });

  it('without photos in any source there is no view: the classic layout stays', () => {
    expect(resolveLoginView({ published: normalizeLogin({ effect: 'focus' }), theme: undefined }, false)).toBeNull();
  });
});

describe('buildLoginView', () => {
  it('paints the caption light over the photo in light mode and with theme tokens in dark mode', () => {
    const light = buildLoginView(null, ['a.jpg'], false).variables;
    const dark = buildLoginView(null, ['a.jpg'], true).variables;

    expect(light['--sol-auth-caption-color']).toBe('#FFFFFF');
    expect(light['--sol-auth-caption-reach']).toBe('30%');
    expect(dark['--sol-auth-caption-color']).toBe('var(--sol-color-text-primary)');
    expect(dark['--sol-auth-caption-label']).toBe('var(--sol-color-secondary)');
    expect(dark['--sol-auth-caption-reach']).toBe('38%');
  });

  it('default panel colors come from theme tokens in both modes', () => {
    expect(buildLoginView(null, ['a.jpg'], false).variables['--sol-auth-panel-bg']).toContain('var(--sol-bg-surface)');
    expect(buildLoginView(null, ['a.jpg'], true).variables['--sol-auth-panel-bg']).toContain('var(--sol-bg-surface)');
  });

  it('takes the active mode and exposes veil and panel as CSS variables', () => {
    const login = normalizeLogin({
      modes: {
        dark: {
          position: 'center',
          background: 'circles',
          veil: { rgb: '1,2,3', from: 0.1, to: 0.9, bottom: 0.5 },
          panel: { bg: 'rgba(1,2,3,.5)', blur: '10px', saturate: 1.2 },
        },
        light: { position: 'left', background: 'solid' },
      },
    });

    const view = buildLoginView(login, ['a.jpg'], true);

    expect(view.position).toBe('center');
    expect(view.background).toBe('circles');
    expect(view.variables['--sol-auth-veil-rgb']).toBe('1,2,3');
    expect(view.variables['--sol-auth-panel-filter']).toBe('blur(10px) saturate(1.2)');
    expect(buildLoginView(login, ['a.jpg'], false).background).toBe('solid');
  });

  it('in dark mode the form fields are translucent; in light mode they keep the theme ones', () => {
    expect(buildLoginView(null, ['a.jpg'], true).variables['--sol-input-bg']).toContain('transparent');
    expect(buildLoginView(null, ['a.jpg'], false).variables['--sol-input-bg']).toBeUndefined();
  });

  it('the form margin depends on the shape', () => {
    const margin = (background: string, position: string) =>
      buildLoginView(normalizeLogin({ modes: { light: { background, position } } }), ['a.jpg'], false).variables['--sol-auth-shape-margin'];

    expect(margin('triangles', 'right')).toContain('11.7%');
    expect(margin('split-circle', 'left')).toContain('8.75%');
    expect(margin('glass-fade', 'left')).toBeUndefined();
  });

  it('never puts the caption on the same side as the form', () => {
    const login = normalizeLogin({ modes: { light: { position: 'left', captionPosition: 'bottom-left' } } });

    expect(buildLoginView(login, ['a.jpg'], false).captionPosition).toBe('bottom-right');
    expect(buildLoginView(normalizeLogin({ modes: { light: { position: 'right' } } }), ['a.jpg'], false).captionPosition).toBe('bottom-left');
  });

  it('carries the caption label and indicators', () => {
    const view = buildLoginView(normalizeLogin({ caption: { label: 'Brand', indicators: false } }), ['a.jpg'], false);

    expect(view.label).toBe('Brand');
    expect(view.indicators).toBe(false);
  });
});

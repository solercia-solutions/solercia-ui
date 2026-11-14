import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { SOL_TENANT_RESOLVER, THEME_SOURCE, SOL_DEFAULT_THEME } from './theme-host';
import type { ThemeSource } from './theme-host';
import { EMIT_TABLE, ThemeService, resolveCssVars } from './theme.service';
import type { ThemeFile } from './theme.model';
import defaultThemeJson from './theme.host-default.fixture.json';
import verticeThemeJson from './theme.vertice.fixture.json';

/**
 * Specs de ThemeService (white-label runtime, agnóstico del host):
 *
 * - El default vive EN la librería (SOL_DEFAULT_THEME). Aquí se provee el
 *   `default.json` de boki-front para fijar las aserciones; un test aparte
 *   verifica que, SIN override, el default de la lib es "Vértice".
 * - El tema del tenant se pide al PUERTO THEME_SOURCE (el host provee el
 *   adaptador). La lib no sabe de HTTP ni de endpoints: recibe un ThemeFile ya
 *   desenvuelto (o null). loadTheme que falla → degradación silenciosa al default.
 * - Anti-race `isStaleResponse`: una respuesta tardía de otra empresa jamás
 *   pisa el tema vigente.
 * - Branding: logo con URL SANITIZADA (http/https/relativa) y favicon del
 *   tenant con restauración al salir.
 */

const defaultTheme = defaultThemeJson as unknown as ThemeFile;

/**
 * Mock del puerto THEME_SOURCE. `loadTheme` devuelve una promesa diferida que
 * el test resuelve/rechaza cuando quiere (para ejercitar el anti-race). Entrega
 * el ThemeFile YA desenvuelto: el desenvoltorio de `{ data }` es responsabilidad
 * del adaptador del host (ver boki-api-theme.source.spec.ts en boki-front).
 */
class SourceMock implements ThemeSource {
  calls: (number | string)[] = [];
  private resolvers: ((v: ThemeFile | null) => void)[] = [];
  private rejecters: ((e: unknown) => void)[] = [];

  loadTheme(tenantId: number | string): Promise<ThemeFile | null> {
    this.calls.push(tenantId);
    return new Promise<ThemeFile | null>((resolve, reject) => {
      this.resolvers.push(resolve);
      this.rejecters.push(reject);
    });
  }

  respond(index: number, theme: ThemeFile | null): void {
    this.resolvers[index](theme);
  }

  fail(index: number): void {
    this.rejecters[index](new Error('load failed'));
  }
}

/** ThemeFile de tenant derivado del default: primary distinguible por modo. */
function buildTenantTheme(over: Partial<ThemeFile['meta']['logo']> = {}): ThemeFile {
  const clone = structuredClone(defaultThemeJson) as unknown as ThemeFile;
  clone.meta = {
    tenant: 'acme',
    logo: { url: 'https://cdn.acme.co/logo.svg', altText: 'ACME', width: 140, ...over },
  };
  clone.modes.light.semantic.color.primary = '#FF0000';
  clone.modes.dark.semantic.color.primary = '#00FF00';
  return clone;
}

/** Procesa los microtasks de `onTenantChange` (async) + aplica el effect. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  TestBed.tick();
}

describe('ThemeService — theming por tenant (THEME_SOURCE + default en la lib)', () => {
  let source: SourceMock;
  let tenantId: WritableSignal<number | null>;
  let service: ThemeService;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  const rootVar = (name: string): string =>
    document.documentElement.style.getPropertyValue(name);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sol-dark-mode', 'false');
    sessionStorage.clear();
    document.documentElement.style.cssText = '';
    document.querySelectorAll('link[rel="icon"]').forEach(l => l.remove());
    document.querySelectorAll('link[data-sol-tenant-fonts]').forEach(l => l.remove());

    // Favicon "empaquetado" (como el de index.html) para probar la restauración.
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute('href', 'assets/logos/bokibot_logo.png');
    document.head.appendChild(link);

    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    source = new SourceMock();
    tenantId = signal<number | null>(null);

    TestBed.configureTestingModule({
      providers: [
        { provide: THEME_SOURCE, useValue: source },
        { provide: SOL_TENANT_RESOLVER, useValue: { activeTenantId: tenantId.asReadonly() } },
        // Default fijado al `default.json` de boki-front para estas aserciones.
        { provide: SOL_DEFAULT_THEME, useValue: defaultTheme },
      ],
    });

    service = TestBed.inject(ThemeService);
    TestBed.tick();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function activateTenant(id: number): void {
    tenantId.set(id);
    TestBed.tick();
  }

  function faviconHref(): string | null {
    return document.querySelector('link[rel="icon"]')?.getAttribute('href') ?? null;
  }

  it('pre-login aplica el default empaquetado y NO pide tema al puerto', () => {
    expect(source.calls).toEqual([]);
    expect(rootVar('--sol-color-primary')).toBe('#2563EB');
    expect(service.logo()?.url).toBe('/assets/logos/boki-logo.svg');
    expect(faviconHref()).toBe('assets/logos/bokibot_logo.png');
  });

  it('con tenant activo pide loadTheme(id) al puerto y aplica sus tokens', async () => {
    activateTenant(7);

    expect(source.calls[0]).toBe(7);

    source.respond(0, buildTenantTheme());
    await flush();

    expect(rootVar('--sol-color-primary')).toBe('#FF0000');
    expect(service.logo()?.url).toBe('https://cdn.acme.co/logo.svg');
    expect(service.brandName()).toBe('ACME');
    expect(service.activeTheme()?.meta.tenant).toBe('acme');
  });

  it('el puerto falla (404/403/red) → fallback silencioso al default con log', async () => {
    activateTenant(9);

    source.fail(0);
    await flush();

    expect(rootVar('--sol-color-primary')).toBe('#2563EB');
    expect(service.activeTheme()?.meta.tenant).toBe('default');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('el puerto devuelve null (sin tema) → queda el default sin ruido', async () => {
    activateTenant(9);

    source.respond(0, null);
    await flush();

    expect(rootVar('--sol-color-primary')).toBe('#2563EB');
    expect(service.activeTheme()?.meta.tenant).toBe('default');
  });

  it('setTenantTheme (push) aplica un tema válido y descarta uno inválido', () => {
    service.setTenantTheme(buildTenantTheme());
    TestBed.tick();
    expect(rootVar('--sol-color-primary')).toBe('#FF0000');
    expect(service.activeTheme()?.meta.tenant).toBe('acme');

    const broken = structuredClone(defaultThemeJson) as unknown as {
      modes: { light: { semantic: { color: Record<string, string> } } };
    };
    delete broken.modes.light.semantic.color['primary'];
    service.setTenantTheme(broken as unknown as ThemeFile);
    TestBed.tick();
    expect(rootVar('--sol-color-primary')).toBe('#2563EB'); // inválido → default
  });

  it('setDarkMode fija el modo y lo PERSISTE como preferencia EXPLÍCITA', () => {
    // El beforeEach ya deja 'sol-dark-mode' = 'false' (explícita) en localStorage.
    expect(service.hasExplicitModePreference()).toBe(true);

    service.setDarkMode(true);
    TestBed.tick();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('sol-dark-mode')).toBe('true');
    expect(service.hasExplicitModePreference()).toBe(true);
  });

  it('setTenantTheme aplica meta.defaultMode sin preferencia explícita y lo sincroniza en localStorage', () => {
    localStorage.removeItem('sol-dark-mode');
    // Reinstancia el servicio para que `loadDarkPreference()` lea el storage ya limpio
    // (mismo patrón que el spec de prefers-reduced-motion, más abajo).
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: THEME_SOURCE, useValue: source },
        { provide: SOL_TENANT_RESOLVER, useValue: { activeTenantId: tenantId.asReadonly() } },
        { provide: SOL_DEFAULT_THEME, useValue: defaultTheme },
      ],
    });
    const svc = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(svc.hasExplicitModePreference()).toBe(false);

    const theme = buildTenantTheme();
    theme.meta.defaultMode = 'dark';
    svc.setTenantTheme(theme);
    TestBed.tick();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(rootVar('--sol-color-primary')).toBe('#00FF00'); // primary DARK del tema
    // BD gobierna y el storage queda sincronizado con su valor (nunca un modo obsoleto).
    expect(localStorage.getItem('sol-dark-mode')).toBe('true');
  });

  it('setTenantTheme impone meta.defaultMode aunque el navegador tenga una preferencia guardada', () => {
    // El beforeEach deja 'sol-dark-mode' = 'false': el modo de BD gana igual en cada carga, para
    // que ningún navegador quede pegado en un modo viejo (el toggle sigue siendo override en vivo).
    const theme = buildTenantTheme();
    theme.meta.defaultMode = 'dark';
    service.setTenantTheme(theme);
    TestBed.tick();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(rootVar('--sol-color-primary')).toBe('#00FF00'); // primary DARK del tema
    expect(localStorage.getItem('sol-dark-mode')).toBe('true');
  });

  it('refresh() vuelve a pedir el tema del tenant activo por el puerto', async () => {
    activateTenant(7);
    source.respond(0, buildTenantTheme());
    await flush();
    expect(source.calls).toEqual([7]);

    service.refresh();
    TestBed.tick();
    expect(source.calls).toEqual([7, 7]); // relanza la carga del mismo tenant

    source.respond(1, buildTenantTheme());
    await flush();
    expect(rootVar('--sol-color-primary')).toBe('#FF0000');
  });

  it('ThemeFile inválido (referencia de token rota) → fallback al default con log', async () => {
    activateTenant(3);

    const broken = buildTenantTheme() as unknown as {
      modes: { light: { semantic: { color: Record<string, string> } } };
    };
    delete broken.modes.light.semantic.color['primary'];
    source.respond(0, broken as unknown as ThemeFile);
    await flush();

    expect(rootVar('--sol-color-primary')).toBe('#2563EB');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('anti-race: la respuesta tardía de otra empresa jamás pisa el tema vigente', async () => {
    activateTenant(1);
    activateTenant(2);

    expect(source.calls).toEqual([1, 2]);

    const themeB = buildTenantTheme();
    themeB.modes.light.semantic.color.primary = '#0000AA';

    // Responde primero la empresa 2 (vigente, índice 1) y DESPUÉS la 1 (tardía, índice 0).
    source.respond(1, themeB);
    await flush();
    source.respond(0, buildTenantTheme());
    await flush();

    expect(rootVar('--sol-color-primary')).toBe('#0000AA');
  });

  it('anti-race: un error tardío de otra empresa no borra el tema vigente', async () => {
    activateTenant(1);
    activateTenant(2);

    source.respond(1, buildTenantTheme());
    await flush();
    source.fail(0);
    await flush();

    expect(rootVar('--sol-color-primary')).toBe('#FF0000');
  });

  it('al salir de la sesión (tenant null) vuelve al default y restaura el favicon', async () => {
    activateTenant(7);
    source.respond(0, buildTenantTheme());
    await flush();
    expect(faviconHref()).toBe('https://cdn.acme.co/logo.svg');

    tenantId.set(null);
    TestBed.tick();

    expect(rootVar('--sol-color-primary')).toBe('#2563EB');
    expect(service.brandName()).toBe('Boki');
    expect(faviconHref()).toBe('assets/logos/bokibot_logo.png');
  });

  it('conserva light/dark POR TEMA: toggleMode con tema de tenant aplica su modo dark', async () => {
    activateTenant(7);
    source.respond(0, buildTenantTheme());
    await flush();

    service.toggleMode();
    TestBed.tick();

    expect(rootVar('--sol-color-primary')).toBe('#00FF00');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('sanitiza el logo: URL javascript: se descarta (logo() null y favicon empaquetado intacto)', async () => {
    activateTenant(7);

    source.respond(0, buildTenantTheme({ url: 'javascript:alert(1)' }));
    await flush();

    // El tema (tokens) SÍ aplica; el branding inseguro NO.
    expect(rootVar('--sol-color-primary')).toBe('#FF0000');
    expect(service.logo()).toBeNull();
    expect(faviconHref()).toBe('assets/logos/bokibot_logo.png');
  });

  it('meta.favicon (0.6.0) manda sobre el logo y no cambia con el modo', async () => {
    activateTenant(7);
    const theme = buildTenantTheme({ urlDark: 'https://cdn.acme.co/logo-dark.svg' });
    theme.meta.favicon = '/assets/acme/favicon.ico';
    source.respond(0, theme);
    await flush();

    expect(service.tenantFavicon()).toBe('/assets/acme/favicon.ico');
    expect(faviconHref()).toBe('/assets/acme/favicon.ico');

    service.toggleMode();
    TestBed.tick();
    expect(faviconHref()).toBe('/assets/acme/favicon.ico');
  });

  it('meta.favicon inseguro se descarta y el favicon vuelve a seguir al logo', async () => {
    activateTenant(7);
    const theme = buildTenantTheme();
    theme.meta.favicon = 'javascript:alert(1)';
    source.respond(0, theme);
    await flush();

    expect(faviconHref()).toBe('https://cdn.acme.co/logo.svg');
  });

  it('logo dual: en modo dark usa urlDark del tenant y el favicon sigue la variante efectiva', async () => {
    activateTenant(7);
    source.respond(0, buildTenantTheme({ urlDark: 'https://cdn.acme.co/logo-dark.svg' }));
    await flush();

    // Modo claro: variante light.
    expect(service.logo()?.url).toBe('https://cdn.acme.co/logo.svg');
    expect(faviconHref()).toBe('https://cdn.acme.co/logo.svg');

    // Toggle a dark EN RUNTIME: el logo efectivo y el favicon reaccionan.
    service.toggleMode();
    TestBed.tick();
    expect(service.logo()?.url).toBe('https://cdn.acme.co/logo-dark.svg');
    expect(faviconHref()).toBe('https://cdn.acme.co/logo-dark.svg');

    // Toggle de vuelta a light: regresa la variante clara.
    service.toggleMode();
    TestBed.tick();
    expect(service.logo()?.url).toBe('https://cdn.acme.co/logo.svg');
    expect(faviconHref()).toBe('https://cdn.acme.co/logo.svg');
  });

  it('logo dual: un tenant sin urlDark usa `url` en ambos modos', async () => {
    activateTenant(7);
    source.respond(0, buildTenantTheme());
    await flush();

    service.toggleMode();
    TestBed.tick();

    expect(service.logo()?.url).toBe('https://cdn.acme.co/logo.svg');
    expect(faviconHref()).toBe('https://cdn.acme.co/logo.svg');
  });

  it('logo dual: urlDark insegura (javascript:) se descarta y en dark cae a `url`', async () => {
    activateTenant(7);
    source.respond(0, buildTenantTheme({ urlDark: 'javascript:alert(1)' }));
    await flush();

    service.toggleMode();
    TestBed.tick();

    expect(service.logo()?.url).toBe('https://cdn.acme.co/logo.svg');
    expect(service.logo()?.urlDark).toBeUndefined();
    expect(faviconHref()).toBe('https://cdn.acme.co/logo.svg');
  });

  it('logo dual: el default empaquetado usa boki-logo-dark.svg en dark (favicon empaquetado intacto)', () => {
    service.toggleMode();
    TestBed.tick();

    expect(service.logo()?.url).toBe('/assets/logos/boki-logo-dark.svg');
    // El favicon SOLO rebrandea con tema de tenant: el default conserva el empaquetado.
    expect(faviconHref()).toBe('assets/logos/bokibot_logo.png');
  });

  // ——— ThemeFile v2 (E8): tokens nuevos, motion, fuentes y sanitización ———

  /** Tema v2 real del handoff (Vértice/Solercia) como tema de tenant. */
  function buildVerticeTheme(): ThemeFile {
    return structuredClone(verticeThemeJson) as unknown as ThemeFile;
  }

  function fontsLink(): HTMLLinkElement | null {
    return document.head.querySelector<HTMLLinkElement>('link[data-sol-tenant-fonts]');
  }

  it('tema v1 puro emite las 96 variables completas con los defaults v2', () => {
    // Muestra representativa de defaults v2 (el golden congela el resto).
    expect(rootVar('--sol-card-bg')).toBe('#FFFFFF');
    expect(rootVar('--sol-card-border')).toBe('1px solid #E2E8F0');
    expect(rootVar('--sol-card-radius')).toBe('12px');
    expect(rootVar('--sol-input-bg')).toBe('#FFFFFF');
    expect(rootVar('--sol-bg-page-texture')).toBe('none');
    expect(rootVar('--sol-auth-hero-bg')).toBe('none');
    expect(rootVar('--sol-dur-base')).toBe('240ms');
    expect(rootVar('--sol-ease')).toBe('cubic-bezier(0.2, 0, 0, 1)');
    expect(rootVar('--sol-reveal-dist')).toBe('12px');
    expect(rootVar('--sol-press-scale')).toBe('0.98');
    expect(rootVar('--sol-reveal-name')).toBe('solRevealFade');
    expect(rootVar('--sol-chart-1')).toBe('#2563EB');
    expect(rootVar('--sol-chart-6')).toBe('#7C3AED');

    // TODAS las filas de la tabla quedan emitidas (ninguna vacía).
    for (const [name] of EMIT_TABLE) {
      expect(rootVar(name), name).not.toBe('');
    }
  });

  it('tema v2 (Vértice) emite sus valores: refs embebidas, sidebar oscuro en light y paleta cíclica', async () => {
    activateTenant(4);
    source.respond(0, buildVerticeTheme());
    await flush();

    expect(rootVar('--sol-font-display')).toBe("'Space Grotesk', system-ui, sans-serif");
    expect(rootVar('--sol-font-numeric')).toBe("'JetBrains Mono', monospace");
    // Refs embebidas en shorthands ("1px solid {color.ink.200}").
    expect(rootVar('--sol-card-border')).toBe('1px solid #DCE1EA');
    expect(rootVar('--sol-input-shadow')).toBe('inset 0 -1px 0 #DCE1EA');
    // Sidebar oscuro AUNQUE el modo sea light.
    expect(rootVar('--sol-sidebar-bg')).toBe('#0B0F1A');
    expect(rootVar('--sol-bg-sunken')).toBe('#EBEEF3');
    // Gradients seguros pasan la sanitización tal cual.
    expect(rootVar('--sol-bg-page-texture')).toContain('repeating-linear-gradient');
    expect(rootVar('--sol-auth-hero-bg')).toContain('radial-gradient');
    // Paleta de 5 colores → 6 tokens rellenados cíclicamente.
    expect(rootVar('--sol-chart-3')).toBe('#93A0B8');
    expect(rootVar('--sol-chart-5')).toBe('#5B78FF');
    expect(rootVar('--sol-chart-6')).toBe('#2C4BFF');
  });

  it('multiplicador de motion por intensity: subtle 0.6x, expressive 1.4x, none 0.01x', async () => {
    activateTenant(4);
    // Vértice declara duration.base 160ms + intensity "subtle" → 0.6x.
    source.respond(0, buildVerticeTheme());
    await flush();
    expect(rootVar('--sol-dur-fast')).toBe('54ms');
    expect(rootVar('--sol-dur-base')).toBe('96ms');
    expect(rootVar('--sol-dur-slow')).toBe('156ms');
    expect(rootVar('--sol-reveal-dist')).toBe('6px');
    // pressScale y easing NO se escalan.
    expect(rootVar('--sol-press-scale')).toBe('0.99');
    expect(rootVar('--sol-ease')).toBe('cubic-bezier(0.2, 0, 0, 1)');

    const expressive = buildVerticeTheme();
    expressive.modes.light.component.motion!.intensity = 'expressive';
    activateTenant(5);
    source.respond(1, expressive);
    await flush();
    expect(rootVar('--sol-dur-base')).toBe('224ms');

    const none = buildVerticeTheme();
    none.modes.light.component.motion!.intensity = 'none';
    activateTenant(6);
    source.respond(2, none);
    await flush();
    expect(rootVar('--sol-dur-base')).toBe('1.6ms');
    expect(rootVar('--sol-reveal-dist')).toBe('0.1px');
  });

  it('prefers-reduced-motion: reduce fuerza el multiplicador "none" aun sin bloque motion', () => {
    const original = (window as { matchMedia?: unknown }).matchMedia;
    (window as { matchMedia?: unknown }).matchMedia = (query: string) =>
      ({ matches: query.includes('prefers-reduced-motion') }) as unknown as MediaQueryList;
    try {
      // Re-instancia el servicio para que lea el matchMedia mockeado al aplicar.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: THEME_SOURCE, useValue: source },
          { provide: SOL_TENANT_RESOLVER, useValue: { activeTenantId: tenantId.asReadonly() } },
          { provide: SOL_DEFAULT_THEME, useValue: defaultTheme },
        ],
      });
      const svc = TestBed.inject(ThemeService);
      TestBed.tick();
      // Defaults v1 (240ms/12px) escalados por 0.01x.
      expect(rootVar('--sol-dur-base')).toBe('2.4ms');
      expect(rootVar('--sol-reveal-dist')).toBe('0.12px');
    } finally {
      (window as { matchMedia?: unknown }).matchMedia = original;
    }
  });

  it('texture con url( se rechaza: emite el default y deja log', async () => {
    activateTenant(4);

    const evil = buildVerticeTheme();
    evil.modes.light.semantic.surface.texture = "url('https://evil.example/leak.png')";
    evil.modes.light.component.auth!.heroBg =
      'linear-gradient(red, blue), url(https://evil.example/x)';
    source.respond(0, evil);
    await flush();

    expect(rootVar('--sol-bg-page-texture')).toBe('none');
    expect(rootVar('--sol-auth-hero-bg')).toBe('none');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('meta.fonts inyecta UN SOLO <link> a Google Fonts construido con family+weights', async () => {
    expect(fontsLink()).toBeNull(); // el default no declara fuentes

    activateTenant(4);
    source.respond(0, buildVerticeTheme());
    await flush();

    const links = document.head.querySelectorAll('link[data-sol-tenant-fonts]');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('rel')).toBe('stylesheet');
    expect(links[0].getAttribute('href')).toBe(
      'https://fonts.googleapis.com/css2?family=Space%20Grotesk:wght@400;500;600;700&family=JetBrains%20Mono:wght@400;500&display=swap',
    );

    // Volver a un tema sin fonts (default) retira el link.
    tenantId.set(null);
    TestBed.tick();
    expect(fontsLink()).toBeNull();
  });

  it('meta.fonts ignora proveedores distintos de google (jamás URL cruda del tenant)', async () => {
    activateTenant(4);

    const theme = buildVerticeTheme();
    theme.meta.fonts = [
      { family: 'Evil Font', provider: 'cdn' as 'google', weights: [400] },
    ];
    source.respond(0, theme);
    await flush();

    expect(fontsLink()).toBeNull();
  });

  it('--sol-reveal-name deriva del revealStyle (rise/fade/pop) con default solRevealFade', async () => {
    activateTenant(4);
    // Vértice: revealStyle "fade".
    source.respond(0, buildVerticeTheme());
    await flush();
    expect(rootVar('--sol-reveal-name')).toBe('solRevealFade');

    const pop = buildVerticeTheme();
    pop.modes.light.component.motion!.revealStyle = 'pop';
    activateTenant(5);
    source.respond(1, pop);
    await flush();
    expect(rootVar('--sol-reveal-name')).toBe('solRevealPop');

    // Estilo desconocido (fuera de la unión) → cae al keyframe por defecto.
    const unknown = buildVerticeTheme();
    unknown.modes.light.component.motion!.revealStyle = 'wobble' as 'rise';
    activateTenant(6);
    source.respond(2, unknown);
    await flush();
    expect(rootVar('--sol-reveal-name')).toBe('solRevealFade');
  });
});

describe('ThemeService — agnóstico: default de la lib y degradación sin host', () => {
  const rootVar = (name: string): string =>
    document.documentElement.style.getPropertyValue(name);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sol-dark-mode', 'false');
    document.documentElement.style.cssText = '';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('SIN override, el default empaquetado de la librería es "Vértice" (primary #2C4BFF)', () => {
    // Sin proveer SOL_DEFAULT_THEME → se usa el factory de la lib (Vértice).
    TestBed.configureTestingModule({ providers: [] });
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(service.activeTheme()?.meta.tenant).toBe('solercia');
    expect(rootVar('--sol-color-primary')).toBe('#2C4BFF');
    expect(rootVar('--sol-sidebar-bg')).toBe('#0B0F1A');
  });

  it('sin THEME_SOURCE ni tenant resolver, funciona en single-theme (solo el default)', () => {
    // Un host que no cablea nada: la lib no revienta, aplica Vértice.
    TestBed.configureTestingModule({ providers: [] });
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(rootVar('--sol-color-primary')).toBe('#2C4BFF');
    expect(service.brandName()).toBe('Solercia Solutions');
  });

  it('con tenant resolver pero SIN THEME_SOURCE (null-object), un tenant activo cae al default', async () => {
    const tenantId = signal<number | null>(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: SOL_TENANT_RESOLVER, useValue: { activeTenantId: tenantId.asReadonly() } },
      ],
    });
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    tenantId.set(42);
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();

    // El null-object devolvió null → sigue el default Vértice, sin errores.
    expect(rootVar('--sol-color-primary')).toBe('#2C4BFF');
    expect(service.activeTheme()?.meta.tenant).toBe('solercia');
  });

  it('un SOL_DEFAULT_THEME malformado cae a la 3ª red (vars vacías) con warn, sin romper', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = structuredClone(verticeThemeJson) as unknown as {
      modes: { light: { semantic: { color: Record<string, string> } } };
    };
    delete broken.modes.light.semantic.color['primary'];

    TestBed.configureTestingModule({
      providers: [{ provide: SOL_DEFAULT_THEME, useValue: broken }],
    });
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    // Default inválido → activeTheme null → 3ª red (styles.css inline), vars limpias.
    expect(service.activeTheme()).toBeNull();
    expect(rootVar('--sol-color-primary')).toBe('');
    expect(warn).toHaveBeenCalled();
  });
});

describe('resolveCssVars — contraste del primario (v2)', () => {
  it('sin primaryContrast emite el blanco que los componentes ya usaban como fallback', () => {
    expect(resolveCssVars(defaultTheme, 'light').get('--sol-color-primary-contrast')).toBe('#FFFFFF');
    expect(resolveCssVars(defaultTheme, 'dark').get('--sol-color-primary-contrast')).toBe('#FFFFFF');
  });

  it('respeta el contraste por modo, incluidas las referencias a primitivos', () => {
    const theme = structuredClone(defaultTheme);
    theme.modes.light.semantic.color.primaryContrast = '#0F172A';
    theme.modes.dark.semantic.color.primaryContrast = '{color.blue.600}';

    expect(resolveCssVars(theme, 'light').get('--sol-color-primary-contrast')).toBe('#0F172A');
    expect(resolveCssVars(theme, 'dark').get('--sol-color-primary-contrast')).toBe(
      resolveCssVars(theme, 'light').get('--sol-color-primary'),
    );
  });
});

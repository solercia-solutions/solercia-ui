import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject, of, throwError, type Observable } from 'rxjs';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SOL_I18N, ThemeService, createSolI18n, type SolI18n, type ThemeFile } from '@solercia/ui';
import { buildThemeFile } from '../lib/theme-builder';
import { DEFAULT_STUDIO_FORM, cloneStudioForm } from '../model/theme-studio-form.model';
import { THEME_STUDIO_STORE, type ThemeStudioStore, type ThemeVersion, type ThemeVersionPage } from '../store/theme-studio-store';
import { SolThemeStudioComponent, type SolThemeStudioNotice } from './theme-studio.component';

/**
 * Tema construido por el estudio con un primario claro reconocible. Se clona: el builder comparte
 * referencias con el tema base (de solo lectura) y algunos tests mutan el resultado.
 */
function themeWithPrimary(primary: string): ThemeFile {
  const form = cloneStudioForm(DEFAULT_STUDIO_FORM);
  form.light.primary = primary;
  return structuredClone(buildThemeFile(form));
}

function version(id: number, extra: Partial<ThemeVersion> = {}): ThemeVersion {
  return {
    id,
    userName: `Persona ${id}`,
    userId: id,
    appliedAt: '2026-09-30T15:00:00Z',
    initialCapture: false,
    sourceVersionId: null,
    ...extra,
  };
}

/** Store falso: cada método es un `vi.fn` que el test programa. */
type FakeStore = {
  load: ReturnType<typeof vi.fn<() => Observable<ThemeFile | null>>>;
  apply: ReturnType<typeof vi.fn<(theme: ThemeFile, source?: ThemeVersion['id'] | null) => Observable<void>>>;
  listVersions?: ReturnType<typeof vi.fn<(before?: ThemeVersionPage['next']) => Observable<ThemeVersionPage>>>;
  getVersion?: ReturnType<typeof vi.fn<(id: ThemeVersion['id']) => Observable<ThemeFile>>>;
  uploadLogo?: ReturnType<typeof vi.fn<(file: File) => Observable<string>>>;
};

function fullStore(): FakeStore {
  return {
    load: vi.fn(() => of(themeWithPrimary('#17324F'))),
    apply: vi.fn(() => of(undefined)),
    listVersions: vi.fn(() => of({ versions: [], next: null })),
    getVersion: vi.fn(() => of(themeWithPrimary('#592132'))),
    uploadLogo: vi.fn(() => of('/uploads/logo.png')),
  };
}

describe('SolThemeStudioComponent', () => {
  let fixture: ComponentFixture<SolThemeStudioComponent>;
  let themeService: {
    isDark: ReturnType<typeof signal<boolean>>;
    activeTheme: ReturnType<typeof signal<null>>;
    refresh: ReturnType<typeof vi.fn>;
    setTenantTheme: ReturnType<typeof vi.fn>;
    setDarkMode: ReturnType<typeof vi.fn>;
  };
  let notices: SolThemeStudioNotice[];
  let appliedThemes: ThemeFile[];

  /**
   * These specs assert the Colombian Spanish texts, so by default they run under a Spanish host
   * (`createSolI18n({ lang: 'es-CO' })`); `null` mounts without any SOL_I18N provider (English).
   */
  function setup(store: FakeStore | null, i18n?: SolI18n | null, inputs: Record<string, unknown> = {}): void {
    themeService = {
      isDark: signal(false),
      activeTheme: signal(null),
      refresh: vi.fn(),
      setTenantTheme: vi.fn(),
      setDarkMode: vi.fn(),
    };
    const providers: unknown[] = [{ provide: ThemeService, useValue: themeService }];
    if (store) providers.push({ provide: THEME_STUDIO_STORE, useValue: store as unknown as ThemeStudioStore });
    if (i18n !== null) providers.push({ provide: SOL_I18N, useValue: i18n ?? createSolI18n({ lang: 'es-CO' }) });
    TestBed.configureTestingModule({ imports: [SolThemeStudioComponent], providers: providers as never[] });
    fixture = TestBed.createComponent(SolThemeStudioComponent);
    notices = [];
    appliedThemes = [];
    fixture.componentInstance.notify.subscribe(notice => notices.push(notice));
    fixture.componentInstance.applied.subscribe(theme => appliedThemes.push(theme));
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => el().querySelector(`[data-testid="${id}"]`);
  const docByTestId = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const hexValue = (key: string): string => (byTestId(`hex-${key}`) as HTMLInputElement).value;

  /** sol-button reenvía el click de su <button> interno como `clicked`. */
  function clickSolButton(host: HTMLElement | null): void {
    expect(host).not.toBeNull();
    (host!.querySelector('button') ?? host!).click();
    fixture.detectChanges();
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => document.querySelectorAll('link[data-sol-studio-fonts]').forEach(link => link.remove()));

  it('muestra el estado de carga y luego hidrata los controles con el tema guardado', () => {
    const load$ = new Subject<ThemeFile | null>();
    const store = fullStore();
    store.load.mockReturnValue(load$);
    setup(store);

    expect(byTestId('studio-loading')).not.toBeNull();
    expect(byTestId('hex-primary')).toBeNull();

    load$.next(themeWithPrimary('#17324F'));
    fixture.detectChanges();

    expect(byTestId('studio-loading')).toBeNull();
    expect(hexValue('primary')).toBe('#17324F');
    expect(byTestId('studio-base-notice')).toBeNull();
  });

  it('sin tema guardado parte del tema base y lo dice (vacío legítimo, no error)', () => {
    const store = fullStore();
    store.load.mockReturnValue(of(null));
    setup(store);

    expect(byTestId('studio-base-notice')?.textContent).toContain('tema base');
    expect(byTestId('studio-load-error')).toBeNull();
  });

  it('error de carga: muestra el estado de error y Reintentar recupera', () => {
    const store = fullStore();
    store.load.mockReturnValueOnce(throwError(() => new Error('500'))).mockReturnValueOnce(of(themeWithPrimary('#0C3733')));
    setup(store);

    expect(byTestId('studio-load-error')).not.toBeNull();
    clickSolButton(byTestId('studio-load-retry'));

    expect(store.load).toHaveBeenCalledTimes(2);
    expect(byTestId('studio-load-error')).toBeNull();
    expect(hexValue('primary')).toBe('#0C3733');
  });

  it('sin THEME_STUDIO_STORE muestra un error de configuración', () => {
    setup(null);
    expect(byTestId('studio-no-store')).not.toBeNull();
  });

  it('aplicar: confirma, llama a store.apply y refresca el tema de la aplicación', () => {
    const store = fullStore();
    setup(store);

    clickSolButton(byTestId('studio-apply'));
    expect(store.apply).not.toHaveBeenCalled();
    expect(docByTestId('sol-confirm-dialog')?.textContent).toContain('¿Aplicar este tema?');
    clickSolButton(docByTestId('sol-confirm-accept'));

    expect(store.apply).toHaveBeenCalledTimes(1);
    const [sent, source] = store.apply.mock.calls[0];
    expect(sent.modes.light.semantic.color.primary).toBe('#17324F');
    expect(source).toBeNull();
    expect(themeService.refresh).toHaveBeenCalledTimes(1);
    expect(appliedThemes).toHaveLength(1);
    expect(notices.at(-1)).toMatchObject({ kind: 'success', messageKey: 'sol.themeStudio.alerts.applied' });
    expect(themeService.setTenantTheme).not.toHaveBeenCalled();
    expect(docByTestId('sol-confirm-dialog')).toBeNull();
  });

  it('aplicar con error del store avisa sin perder el borrador', () => {
    const store = fullStore();
    store.apply.mockReturnValue(throwError(() => new Error('403')));
    setup(store);

    clickSolButton(byTestId('studio-apply'));
    clickSolButton(docByTestId('sol-confirm-accept'));

    expect(notices.at(-1)).toMatchObject({
      kind: 'error',
      messageKey: 'sol.themeStudio.alerts.applyError',
      message: 'No se pudo aplicar el tema. Intenta de nuevo.',
    });
    expect(themeService.refresh).not.toHaveBeenCalled();
    expect(hexValue('primary')).toBe('#17324F');
  });

  it('historial paginado: primera página, "ver más" con el cursor y fin de la lista', () => {
    const store = fullStore();
    store.listVersions!
      .mockReturnValueOnce(of({ versions: [version(3), version(2)], next: 'cursor-2' }))
      .mockReturnValueOnce(of({ versions: [version(1, { initialCapture: true, userName: null })], next: null }));
    setup(store);

    clickSolButton(byTestId('studio-history'));
    expect(store.listVersions).toHaveBeenLastCalledWith(null);
    expect(byTestId('history-list')?.querySelectorAll('li')).toHaveLength(2);

    clickSolButton(byTestId('history-more'));
    expect(store.listVersions).toHaveBeenLastCalledWith('cursor-2');
    expect(byTestId('history-list')?.querySelectorAll('li')).toHaveLength(3);
    expect(byTestId('history-more')).toBeNull();
    expect(byTestId('history-list')?.textContent).toContain('Captura del tema previo');
  });

  it('historial vacío muestra su mensaje y un fallo del historial permite reintentar', () => {
    const store = fullStore();
    store.listVersions!.mockReturnValueOnce(throwError(() => new Error('red'))).mockReturnValueOnce(of({ versions: [], next: null }));
    setup(store);

    clickSolButton(byTestId('studio-history'));
    expect(byTestId('history-error')).not.toBeNull();

    expect(byTestId('history-error')?.textContent).toContain('No fue posible cargar el historial. Reintente.');
    clickSolButton(byTestId('history-retry'));
    expect(byTestId('history-error')).toBeNull();
    expect(byTestId('history-empty')).not.toBeNull();
  });

  it('restaurar: previsualiza una versión y al aplicar envía su id como versión de origen', () => {
    const store = fullStore();
    store.listVersions!.mockReturnValue(of({ versions: [version(2)], next: null }));
    setup(store);

    clickSolButton(byTestId('studio-history'));
    clickSolButton(byTestId('history-preview-2'));

    expect(store.getVersion).toHaveBeenCalledWith(2);
    expect(hexValue('primary')).toBe('#592132');
    expect(byTestId('studio-json-status')?.textContent).toContain('Versión 2 precargada');

    clickSolButton(byTestId('studio-apply'));
    clickSolButton(docByTestId('sol-confirm-accept'));
    const [sent, source] = store.apply.mock.calls[0];
    expect(source).toBe(2);
    expect(sent.modes.light.semantic.color.primary).toBe('#592132');
  });

  it('importar un JSON inválido lo dice en la línea de estado y no toca el borrador', async () => {
    setup(fullStore());

    await fixture.componentInstance.importFile(new File(['{'], 'tema.json', { type: 'application/json' }));
    fixture.detectChanges();

    expect(byTestId('studio-json-status')?.textContent?.trim()).toBe(
      'El archivo no contiene JSON válido. Revise comas y comillas.',
    );
    expect(notices).toHaveLength(0);
    expect(hexValue('primary')).toBe('#17324F');
  });

  it('importar un JSON con valores inseguros lo rechaza', async () => {
    setup(fullStore());
    const malicious = themeWithPrimary('#17324F');
    malicious.meta.logo.url = 'javascript:alert(1)';

    await fixture.componentInstance.importFile(new File([JSON.stringify(malicious)], 'tema.json'));
    fixture.detectChanges();

    expect(byTestId('studio-json-status')?.textContent?.trim()).toBe(
      'El archivo no cumple el formato del tema. Exporte el JSON actual y conserve su estructura.',
    );
  });

  it('una clave no admitida se señala con su ruta', async () => {
    setup(fullStore());
    const theme = themeWithPrimary('#17324F') as ThemeFile & { meta: Record<string, unknown> };
    theme.meta['desconocida'] = 'x';

    await fixture.componentInstance.importFile(new File([JSON.stringify(theme)], 'tema.json'));
    fixture.detectChanges();

    expect(byTestId('studio-json-status')?.textContent?.trim()).toBe(
      'El archivo no cumple el formato del tema en theme.meta.desconocida. Exporte el JSON actual y conserve su estructura.',
    );
  });

  it('importar un JSON válido lo carga en el borrador sin guardarlo', async () => {
    const store = fullStore();
    setup(store);

    await fixture.componentInstance.importFile(new File([JSON.stringify(themeWithPrimary('#302858'))], 'tema.json'));
    fixture.detectChanges();

    expect(hexValue('primary')).toBe('#302858');
    expect(store.apply).not.toHaveBeenCalled();
  });

  it('sin métodos opcionales del store: sin historial ni carga de imágenes', () => {
    setup({ load: vi.fn(() => of(themeWithPrimary('#17324F'))), apply: vi.fn(() => of(undefined)) });

    expect(byTestId('studio-history-panel')).toBeNull();
    expect(byTestId('brand-logo-attach')).toBeNull();
    expect(byTestId('upload-unavailable')).not.toBeNull();
    expect(byTestId('studio-apply')).not.toBeNull();
  });

  it('subir el logo usa store.uploadLogo y pone la URL en la marca', () => {
    const store = fullStore();
    setup(store);

    fixture.componentInstance.uploadImage('logo', new File(['png'], 'logo.png', { type: 'image/png' }));
    fixture.detectChanges();

    expect(store.uploadLogo).toHaveBeenCalledTimes(1);
    expect(el().querySelector('.logo-thumb')?.getAttribute('src')).toBe('/uploads/logo.png');
    expect(notices.at(-1)).toMatchObject({ kind: 'success' });
  });

  it('un hex inválido no cambia el color y avisa', () => {
    setup(fullStore());
    const input = byTestId('hex-primary') as HTMLInputElement;
    input.value = 'azul';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(hexValue('primary')).toBe('#17324F');
    expect(notices.at(-1)).toMatchObject({ kind: 'warning', messageKey: 'sol.themeStudio.alerts.invalidHex' });
  });

  it('sin proveedor de SOL_I18N los textos salen en inglés', () => {
    setup(fullStore(), null);
    expect(el().querySelector('.studio-subtitle')?.textContent).toContain("Design the organization's theme");
  });

  it('los textos del host ganan; sin clave del host cae al diccionario del idioma activo', () => {
    const lang = signal('en');
    const hostI18n: SolI18n = {
      activeLang: lang.asReadonly(),
      translate: key => (key === 'sol.themeStudio.title' ? 'Host title' : key),
      t: key => signal(key),
      tMany: keys => signal(keys),
    };
    setup(fullStore(), hostI18n);

    expect(el().querySelector('.studio-title')?.textContent?.trim()).toBe('Host title');
    expect(el().querySelector('.studio-subtitle')?.textContent).toContain("Design the organization's theme");

    lang.set('es-CO');
    fixture.detectChanges();
    expect(el().querySelector('.studio-subtitle')?.textContent).toContain('Diseña el tema');
  });
  describe('paridad con el Theme Studio de origen', () => {
    it('con el tema persistido lo empuja con setTenantTheme (sin refresh) y fija el modo si se pide', () => {
      const store = fullStore();
      const persisted = themeWithPrimary('#123456');
      persisted.meta.defaultMode = 'dark';
      store.apply.mockReturnValue(of(persisted) as never);
      setup(store, undefined, { features: { persistDefaultModeOnApply: true } });
      clickSolButton(byTestId('seg-defaultMode-dark'));

      clickSolButton(byTestId('studio-apply'));
      clickSolButton(docByTestId('sol-confirm-accept'));

      expect(themeService.setTenantTheme).toHaveBeenCalledWith(persisted);
      expect(themeService.refresh).not.toHaveBeenCalled();
      expect(themeService.setDarkMode).toHaveBeenCalledWith(true);
      expect(appliedThemes).toEqual([persisted]);
    });

    it('tras aplicar una versión restaurada, sus tokens no editados siguen en el borrador', () => {
      const store = fullStore();
      const restored = themeWithPrimary('#592132') as ThemeFile & { primitives: { color: Record<string, unknown> } };
      (restored.primitives.color as Record<string, Record<string, string>>)['brand'] = { extra: '#ABCDEF' };
      store.getVersion!.mockReturnValue(of(restored));
      store.listVersions!.mockReturnValue(of({ versions: [version(2)], next: null }));
      setup(store);

      clickSolButton(byTestId('studio-history'));
      clickSolButton(byTestId('history-preview-2'));
      for (let i = 0; i < 2; i++) {
        clickSolButton(byTestId('studio-apply'));
        clickSolButton(docByTestId('sol-confirm-accept'));
      }
      const [, second] = store.apply.mock.calls;
      expect(second[1]).toBeNull();
      expect((second[0].primitives.color as Record<string, Record<string, string>>)['brand']['extra']).toBe('#ABCDEF');
    });

    it('un tema persistido irresoluble se reporta como error y no se empuja', () => {
      const store = fullStore();
      store.apply.mockReturnValue(of({ meta: {}, modes: {}, primitives: {} }) as never);
      setup(store);

      clickSolButton(byTestId('studio-apply'));
      clickSolButton(docByTestId('sol-confirm-accept'));

      expect(themeService.setTenantTheme).not.toHaveBeenCalled();
      expect(notices.at(-1)).toMatchObject({ kind: 'error', messageKey: 'sol.themeStudio.alerts.applyError' });
    });

    it('muestra el mensaje del backend que trae el error del store', () => {
      const store = fullStore();
      store.apply.mockReturnValue(throwError(() => ({ error: { message: 'Sin permiso para editar el tema.' } })));
      store.listVersions!.mockReturnValue(throwError(() => ({ error: { errors: [{ message: 'Historial no disponible.' }] } })));
      setup(store);

      clickSolButton(byTestId('studio-apply'));
      clickSolButton(docByTestId('sol-confirm-accept'));
      expect(notices.at(-1)).toMatchObject({ kind: 'error', message: 'Sin permiso para editar el tema.' });

      clickSolButton(byTestId('studio-history'));
      expect(byTestId('history-error')?.textContent?.trim()).toBe('Historial no disponible.');
    });

    it('historial: fecha con zona horaria y etiqueta, captura inicial y versión de origen', () => {
      const store = fullStore();
      store.listVersions!.mockReturnValue(
        of({
          versions: [
            version(5, { sourceVersionId: 3, appliedAt: '2026-09-30T15:00:00Z' }),
            version(1, { initialCapture: true, userName: null }),
          ],
          next: null,
        }),
      );
      setup(store, undefined, { versionTimeZone: 'America/Bogota', versionTimeZoneLabel: '(Bogotá)' });

      clickSolButton(byTestId('studio-history'));
      const items = byTestId('history-list')!.querySelectorAll('li');
      expect(items[0].textContent).toContain('Versión 5');
      expect(items[0].textContent).toContain('10:00:00');
      expect(items[0].textContent).toContain('(Bogotá)');
      expect(items[0].textContent).toContain('Persona 5');
      expect(items[0].textContent).toContain('Basada en versión 3');
      expect(items[1].textContent).toContain('Captura del tema previo');
    });

    it('sección opcional del loader: se muestra, viaja en meta.loader y se valida al importar', async () => {
      const store = fullStore();
      setup(store, undefined, { features: { loader: true } });

      expect(byTestId('studio-loader-section')).not.toBeNull();
      expect(el().querySelector('[data-testid="preview-loader"]')).not.toBeNull();

      clickSolButton(byTestId('studio-apply'));
      clickSolButton(docByTestId('sol-confirm-accept'));
      const [sent] = store.apply.mock.calls[0];
      expect((sent.meta as unknown as Record<string, unknown>)['loader']).toEqual({
        image: '',
        presentation: 'current',
        animation: 'spin',
      });

      const bad = themeWithPrimary('#17324F') as ThemeFile & { meta: Record<string, unknown> };
      bad.meta['loader'] = { image: '', presentation: 'current', animation: 'girar' };
      await fixture.componentInstance.importFile(new File([JSON.stringify(bad)], 'tema.json'));
      fixture.detectChanges();
      expect(byTestId('studio-json-status')?.textContent).toContain('no cumple el formato del tema');
    });

    it('sin la sección del loader no hay sección ni muestra', () => {
      setup(fullStore());
      expect(byTestId('studio-loader-section')).toBeNull();
      expect(el().querySelector('[data-testid="preview-loader"]')).toBeNull();
    });

    it('la variante de tabla se lee y escribe además en la clave de meta configurada', () => {
      const store = fullStore();
      const saved = themeWithPrimary('#17324F') as ThemeFile & { meta: Record<string, unknown> };
      saved.meta['tableStyle'] = 'banded';
      store.load.mockReturnValue(of(saved));
      setup(store, undefined, { features: { tableVariantMetaKey: 'tableStyle' } });

      expect(byTestId('seg-tableVariant-banded')?.classList.contains('active')).toBe(true);
      clickSolButton(byTestId('seg-tableVariant-bordered'));
      clickSolButton(byTestId('studio-apply'));
      clickSolButton(docByTestId('sol-confirm-accept'));
      const [sent] = store.apply.mock.calls[0];
      expect((sent.meta as unknown as Record<string, unknown>)['tableStyle']).toBe('bordered');
    });

    it('features.themeName=false oculta el nombre del tema; el pie usa el placeholder del host', () => {
      setup(fullStore(), undefined, { features: { themeName: false }, footerPlaceholder: '2026 © Hecho con ❤ en X' });
      expect(byTestId('brand-name')).toBeNull();
      expect((byTestId('footer-text') as HTMLInputElement).placeholder).toBe('2026 © Hecho con ❤ en X');
      expect((byTestId('footer-text') as HTMLInputElement).maxLength).toBe(200);
    });

    it('metaExtrasSchema permite importar campos de meta que el host preserva', async () => {
      setup(fullStore(), undefined, { metaExtrasSchema: { sidebar: { autoCloseOnNavigate: true } } });
      const theme = themeWithPrimary('#302858') as ThemeFile & { meta: Record<string, unknown> };
      theme.meta['sidebar'] = { autoCloseOnNavigate: false };

      await fixture.componentInstance.importFile(new File([JSON.stringify(theme)], 'tema.json'));
      fixture.detectChanges();
      expect(hexValue('primary')).toBe('#302858');
    });

    it('importar abre el panel lateral de la vista previa y Escape lo cierra', async () => {
      setup(fullStore());
      await fixture.componentInstance.importFile(new File([JSON.stringify(themeWithPrimary('#302858'))], 'tema.json'));
      fixture.detectChanges();
      expect(byTestId('studio-preview-mobile')).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(byTestId('studio-preview-mobile')).toBeNull();
    });

    it('un archivo de imagen de más de 2 MB se rechaza con una advertencia', () => {
      const store = fullStore();
      setup(store);
      const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' });
      fixture.componentInstance.uploadImage('logo', big);
      expect(store.uploadLogo).not.toHaveBeenCalled();
      expect(notices.at(-1)).toMatchObject({ kind: 'warning', messageKey: 'sol.themeStudio.brand.sizeError' });
    });
  });

  describe('pestaña Inicio de sesión (features.loginAppearance)', () => {
    const LOGIN = {
      images: ['/uploads/a.jpg', '/uploads/b.jpg'],
      intervalMs: 7000,
      effect: 'zoom',
      transition: 'fade',
      modes: { dark: { position: 'right', background: 'glass-fade' }, light: { position: 'left', background: 'glass-fade' } },
    };

    function themeWithLogin(): ThemeFile {
      const theme = themeWithPrimary('#17324F') as ThemeFile & { meta: Record<string, unknown> };
      theme.meta['login'] = structuredClone(LOGIN);
      return theme;
    }

    function press(testId: string): void {
      (byTestId(testId) as HTMLElement).click();
      fixture.detectChanges();
    }

    function applyNow(): ThemeFile {
      clickSolButton(byTestId('studio-apply'));
      clickSolButton(docByTestId('sol-confirm-accept'));
      return store.apply.mock.calls.at(-1)![0];
    }

    let store: FakeStore;

    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      store = fullStore();
      store.load.mockReturnValue(of(themeWithLogin()));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('sin la opción, la pantalla es la de siempre: sin pestañas ni editor', () => {
      setup(store);

      expect(byTestId('studio-section-tabs')).toBeNull();
      expect(el().querySelector('sol-login-appearance-editor')).toBeNull();
    });

    it('abrir la pestaña oculta la apariencia general sin desmontarla', () => {
      setup(store, undefined, { features: { loginAppearance: true } });
      expect(byTestId('studio-tab-login')?.textContent).toContain('Inicio de sesión');

      press('studio-tab-login');

      expect(byTestId('studio-section-general')?.hasAttribute('hidden')).toBe(true);
      expect(byTestId('hex-primary')).not.toBeNull();
      expect(byTestId('studio-section-login')?.hasAttribute('hidden')).toBe(false);
      expect(el().querySelector('[data-testid="login-preview"]')).not.toBeNull();
    });

    it('sin cambios en la pestaña, aplicar conserva el meta.login guardado tal cual', () => {
      setup(store, undefined, { features: { loginAppearance: true } });

      const sent = applyNow() as ThemeFile & { meta: { login?: unknown } };

      expect(sent.meta.login).toEqual(LOGIN);
    });

    it('un cambio en la pestaña viaja en meta.login al aplicar y la marca «sin aplicar» se va', () => {
      setup(store, undefined, { features: { loginAppearance: true } });
      press('studio-tab-login');
      press('login-effect-none');
      expect(byTestId('studio-login-unsaved')).not.toBeNull();

      press('login-go-to-apply');
      expect(byTestId('studio-section-general')?.hasAttribute('hidden')).toBe(false);
      const sent = applyNow() as ThemeFile & { meta: { login: { effect: string; images: string[] } } };

      expect(sent.meta.login.effect).toBe('none');
      expect(sent.meta.login.images).toEqual(LOGIN.images);
      expect(byTestId('studio-login-unsaved')).toBeNull();
    });

    it('sube las fotos con store.uploadLogo', async () => {
      store.uploadLogo!.mockReturnValue(of('/uploads/nueva.jpg'));
      setup(store, undefined, { features: { loginAppearance: true } });
      press('studio-tab-login');
      const field = byTestId('login-photos-file') as HTMLInputElement;
      Object.defineProperty(field, 'files', { configurable: true, value: [new File(['x'], 'nueva.jpg', { type: 'image/jpeg' })] });
      field.dispatchEvent(new Event('change'));
      await new Promise(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();

      expect(store.uploadLogo).toHaveBeenCalledTimes(1);
      const sent = applyNow() as ThemeFile & { meta: { login: { images: string[] } } };
      expect(sent.meta.login.images.at(-1)).toBe('/uploads/nueva.jpg');
    });

    it('el importador acepta meta.login solo con la opción activa', async () => {
      const file = () => new File([JSON.stringify(themeWithLogin())], 'tema.json');
      setup(fullStore(), undefined, { features: { loginAppearance: true } });
      await fixture.componentInstance.importFile(file());
      fixture.detectChanges();
      expect(byTestId('studio-json-status')?.textContent).not.toContain('theme.meta.login');

      TestBed.resetTestingModule();
      setup(fullStore());
      await fixture.componentInstance.importFile(file());
      fixture.detectChanges();
      expect(byTestId('studio-json-status')?.textContent).toContain('theme.meta.login');
    });
  });
});

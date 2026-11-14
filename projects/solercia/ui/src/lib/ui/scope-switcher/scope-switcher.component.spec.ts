import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import { SolScopeSwitcherComponent, type SolScope } from './scope-switcher.component';

/**
 * Specs de `sol-scope-switcher`.
 *
 * Dos detalles del entorno mandan sobre la forma de estas pruebas:
 *
 * 1. El panel se portalea a `document.body` vía `solFloatingPanel`, así que se
 *    consulta con `document.querySelector`, NUNCA con `fixture.nativeElement`.
 * 2. El stub de i18n VERIFICA cada clave contra el catálogo real
 *    `src/assets/i18n/es-CO.json`: una clave olvidada revienta el test en vez
 *    de colarse a producción como texto crudo.
 */
describe('SolScopeSwitcherComponent', () => {
  let fixture: ComponentFixture<SolScopeSwitcherComponent<unknown>>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function trigger(): HTMLButtonElement | null {
    return host().querySelector<HTMLButtonElement>('.sol-scope-switcher__trigger');
  }

  function panel(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.sol-scope-switcher__panel');
  }

  function options(): HTMLButtonElement[] {
    return Array.from(
      document.querySelectorAll<HTMLButtonElement>('.sol-scope-switcher__option'),
    );
  }

  /**
   * Etiqueta + sublabel de cada opción. Se leen los `span` concretos y no el
   * `textContent` completo porque el avatar de respaldo también aporta texto
   * (las iniciales), que no es parte de lo que se está verificando aquí.
   */
  function optionTexts(): string[] {
    return options().map((el) =>
      [
        el.querySelector('.sol-scope-switcher__label')?.textContent?.trim(),
        el.querySelector('.sol-scope-switcher__sublabel')?.textContent?.trim(),
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  function setScopes(scopes: unknown, extra: Record<string, unknown> = {}): void {
    fixture.componentRef.setInput('scopes', scopes);
    for (const [key, value] of Object.entries(extra)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
  }

  function openPanel(): void {
    trigger()!.click();
    fixture.detectChanges();
  }

  const DOS_AMBITOS: SolScope[] = [
    { id: 'acme', label: 'Acme S.A.S.', sublabel: 'Administradora' },
    { id: 'globex', label: 'Globex Ltda.', sublabel: 'Colaboradora' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolScopeSwitcherComponent],
      providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
    });
    fixture = TestBed.createComponent<SolScopeSwitcherComponent<unknown>>(
      SolScopeSwitcherComponent,
    );
  });

  afterEach(() => {
    // El panel vive portaleado en document.body: sin destruir el fixture, un
    // spec podría ver el panel del anterior.
    fixture.destroy();
  });

  // ── Listado ───────────────────────────────────────────────────────────────

  it('lista cada ámbito con su etiqueta principal y su etiqueta secundaria', () => {
    setScopes(DOS_AMBITOS);
    openPanel();

    expect(optionTexts()).toEqual([
      'Acme S.A.S. Administradora',
      'Globex Ltda. Colaboradora',
    ]);
  });

  it('un ámbito sin sublabel se lista solo con su etiqueta principal', () => {
    setScopes([
      { id: 'acme', label: 'Acme S.A.S.' },
      { id: 'globex', label: 'Globex Ltda.', sublabel: 'Colaboradora' },
    ]);
    openPanel();

    expect(host().querySelector('.sol-scope-switcher__sublabel')).toBeNull();
    expect(
      document.querySelectorAll('.sol-scope-switcher__panel .sol-scope-switcher__sublabel').length,
    ).toBe(1);
  });

  // ── Ámbito activo ─────────────────────────────────────────────────────────

  it('marca el ámbito activo con aria-selected y lo refleja en el disparador', () => {
    setScopes(DOS_AMBITOS, { activeScopeId: 'globex' });

    expect(trigger()!.textContent).toContain('Globex Ltda.');

    openPanel();
    expect(options().map((el) => el.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(options()[1].classList.contains('sol-scope-switcher__option--active')).toBe(true);
  });

  it('sin activeScopeId cae al primer ámbito — el disparador nunca queda en blanco', () => {
    setScopes(DOS_AMBITOS, { activeScopeId: null });

    expect(trigger()!.textContent).toContain('Acme S.A.S.');
    openPanel();
    expect(options().map((el) => el.getAttribute('aria-selected'))).toEqual(['true', 'false']);
  });

  it('un activeScopeId que ya no está en la lista cae al primero en vez de mostrar vacío', () => {
    setScopes(DOS_AMBITOS, { activeScopeId: 'empresa-que-ya-no-existe' });

    expect(trigger()!.textContent).toContain('Acme S.A.S.');
    expect(fixture.componentInstance.effectiveActiveId()).toBe('acme');
  });

  // ── Un solo ámbito ────────────────────────────────────────────────────────

  it('[spec origen: "Usuario con una sola empresa"] un solo ámbito se muestra como activo sin obligar a elegir', () => {
    setScopes([{ id: 'acme', label: 'Acme S.A.S.', sublabel: 'Administradora' }]);

    // Ni disparador ni panel: no hay nada que elegir.
    expect(trigger()).toBeNull();
    expect(panel()).toBeNull();

    const estatico = host().querySelector('.sol-scope-switcher__static');
    expect(estatico).not.toBeNull();
    expect(estatico!.textContent).toContain('Acme S.A.S.');
    expect(estatico!.textContent).toContain('Administradora');
    expect(fixture.componentInstance.isSingle()).toBe(true);
  });

  it('con dos ámbitos SÍ aparece el disparador desplegable', () => {
    setScopes(DOS_AMBITOS);

    expect(host().querySelector('.sol-scope-switcher__static')).toBeNull();
    expect(trigger()).not.toBeNull();
    expect(trigger()!.getAttribute('aria-expanded')).toBe('false');
  });

  // ── Selección ─────────────────────────────────────────────────────────────

  it('emite scopeSelected con el ámbito elegido, incluida su carga libre data', () => {
    const scopes: SolScope<{ plan: string }>[] = [
      { id: 'acme', label: 'Acme S.A.S.', data: { plan: 'basico' } },
      { id: 'globex', label: 'Globex Ltda.', data: { plan: 'premium' } },
    ];
    setScopes(scopes, { activeScopeId: 'acme' });
    openPanel();

    const emitidos: SolScope[] = [];
    fixture.componentInstance.scopeSelected.subscribe((s) => emitidos.push(s));

    options()[1].click();
    fixture.detectChanges();

    expect(emitidos.length).toBe(1);
    expect(emitidos[0].id).toBe('globex');
    expect(emitidos[0].data).toEqual({ plan: 'premium' });
    // El componente NO persiste ni recarga: el activo sigue mandándolo la app.
    expect(fixture.componentInstance.effectiveActiveId()).toBe('acme');
  });

  it('elegir el ámbito ya activo cierra el panel sin emitir (no reinicia el contexto por nada)', () => {
    setScopes(DOS_AMBITOS, { activeScopeId: 'acme' });
    openPanel();

    const emitidos: SolScope[] = [];
    fixture.componentInstance.scopeSelected.subscribe((s) => emitidos.push(s));

    options()[0].click();
    fixture.detectChanges();

    expect(emitidos).toEqual([]);
    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(panel()).toBeNull();
  });

  it('seleccionar cierra el panel y devuelve el foco al disparador', () => {
    setScopes(DOS_AMBITOS, { activeScopeId: 'acme' });
    openPanel();

    options()[1].click();
    fixture.detectChanges();

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  it('abrir y cerrar refleja aria-expanded y emite openChange', () => {
    setScopes(DOS_AMBITOS);

    const eventos: boolean[] = [];
    fixture.componentInstance.openChange.subscribe((v) => eventos.push(v));

    openPanel();
    expect(trigger()!.getAttribute('aria-expanded')).toBe('true');
    expect(panel()!.getAttribute('role')).toBe('listbox');

    trigger()!.click();
    fixture.detectChanges();

    expect(trigger()!.getAttribute('aria-expanded')).toBe('false');
    expect(panel()).toBeNull();
    expect(eventos).toEqual([true, false]);
  });

  it('Escape cierra el panel y devuelve el foco al disparador', () => {
    setScopes(DOS_AMBITOS);
    openPanel();
    expect(panel()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(panel()).toBeNull();
    expect(trigger()!.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('Escape con el panel cerrado no hace nada (no emite un openChange fantasma)', () => {
    setScopes(DOS_AMBITOS);

    const eventos: boolean[] = [];
    fixture.componentInstance.openChange.subscribe((v) => eventos.push(v));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(eventos).toEqual([]);
  });

  it('un clic fuera del host y fuera del panel portaleado cierra el panel', () => {
    setScopes(DOS_AMBITOS);
    openPanel();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(panel()).toBeNull();
  });

  it('el panel se portalea a document.body y no queda nodo huérfano al cerrar', () => {
    setScopes(DOS_AMBITOS);
    openPanel();

    expect(panel()!.parentElement).toBe(document.body);
    expect(panel()!.classList.contains('sol-floating-panel')).toBe(true);
    expect(panel()!.style.position).toBe('fixed');

    trigger()!.click();
    fixture.detectChanges();

    expect(document.body.querySelectorAll('.sol-scope-switcher__panel').length).toBe(0);
  });

  // ── Teclado ───────────────────────────────────────────────────────────────

  it('ArrowDown desde el disparador abre el panel posicionado sobre el ámbito activo', () => {
    setScopes(DOS_AMBITOS, { activeScopeId: 'globex' });

    trigger()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(true);
    expect(fixture.componentInstance.highlightedIndex()).toBe(1);
    expect(document.activeElement).toBe(options()[1]);
  });

  it('las flechas mueven el foco de forma cíclica dentro del panel', () => {
    setScopes(DOS_AMBITOS, { activeScopeId: 'acme' });
    openPanel();
    expect(document.activeElement).toBe(options()[0]);

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(options()[1]);

    // Ciclo: del último vuelve al primero.
    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(options()[0]);

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(options()[1]);
  });

  it('Enter dentro del panel selecciona el ámbito resaltado', () => {
    setScopes(DOS_AMBITOS, { activeScopeId: 'acme' });
    openPanel();

    const emitidos: SolScope[] = [];
    fixture.componentInstance.scopeSelected.subscribe((s) => emitidos.push(s));

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(emitidos.map((s) => s.id)).toEqual(['globex']);
    expect(panel()).toBeNull();
  });

  it('Home y End saltan al primero y al último ámbito', () => {
    setScopes([...DOS_AMBITOS, { id: 'initech', label: 'Initech S.A.' }], {
      activeScopeId: 'globex',
    });
    openPanel();

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.highlightedIndex()).toBe(2);

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.highlightedIndex()).toBe(0);
  });

  it('Tab cierra el panel para no dejar el foco suelto en el nodo portaleado', () => {
    setScopes(DOS_AMBITOS);
    openPanel();

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('disabled impide abrir el panel', () => {
    setScopes(DOS_AMBITOS, { disabled: true });

    expect(trigger()!.disabled).toBe(true);
    trigger()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(panel()).toBeNull();
  });

  // ── Los tres estados, distinguibles entre sí ──────────────────────────────

  it('[cargando] muestra el spinner y su texto, y NADA de lista, vacío ni error', () => {
    setScopes(DOS_AMBITOS, { status: 'loading' });

    const cargando = host().querySelector('.sol-scope-switcher__loading');
    expect(cargando).not.toBeNull();
    expect(cargando!.getAttribute('role')).toBe('status');
    expect(cargando!.textContent).toContain('Cargando tus ámbitos');
    expect(host().querySelector('sol-spinner')).not.toBeNull();

    expect(trigger()).toBeNull();
    expect(host().querySelector('.sol-scope-switcher__empty')).toBeNull();
    expect(host().querySelector('.sol-scope-switcher__error')).toBeNull();
  });

  it('[vacío] lista vacía en idle es un estado legítimo, NO un error', () => {
    setScopes([], { status: 'idle' });

    const vacio = host().querySelector('.sol-scope-switcher__empty');
    expect(vacio).not.toBeNull();
    expect(vacio!.textContent).toContain('No tienes ámbitos disponibles');

    // Distinguible: no lleva role=alert, no hay bloque de error ni de carga.
    expect(vacio!.getAttribute('role')).toBeNull();
    expect(host().querySelector('.sol-scope-switcher__error')).toBeNull();
    expect(host().querySelector('.sol-scope-switcher__loading')).toBeNull();
    expect(trigger()).toBeNull();
  });

  it('[error de carga] lista vacía con status=error muestra la alerta y NUNCA el texto de vacío', () => {
    setScopes([], { status: 'error' });

    const error = host().querySelector('.sol-scope-switcher__error');
    expect(error).not.toBeNull();
    expect(error!.getAttribute('role')).toBe('alert');
    expect(error!.textContent).toContain('No pudimos completar el cambio');

    expect(host().querySelector('.sol-scope-switcher__empty')).toBeNull();
    expect(host().querySelector('.sol-scope-switcher__loading')).toBeNull();
  });

  it('[spec origen: "Falla al cambiar conserva el contexto anterior"] error con lista: la alerta convive con el selector', () => {
    setScopes(DOS_AMBITOS, { activeScopeId: 'acme', status: 'error' });

    // El contexto anterior SIGUE en pantalla.
    expect(trigger()).not.toBeNull();
    expect(trigger()!.textContent).toContain('Acme S.A.S.');

    // Y la alerta se suma debajo, sin reemplazarlo.
    const error = host().querySelector('.sol-scope-switcher__error');
    expect(error).not.toBeNull();
    expect(error!.getAttribute('role')).toBe('alert');
    expect(host().querySelector('.sol-scope-switcher__empty')).toBeNull();
  });

  it('errorMessage del consumidor gana sobre el texto por defecto del catálogo', () => {
    setScopes(DOS_AMBITOS, {
      status: 'error',
      errorMessage: 'Perdiste el acceso a esa empresa.',
    });

    expect(host().querySelector('.sol-scope-switcher__error')!.textContent).toContain(
      'Perdiste el acceso a esa empresa.',
    );
  });

  it('los tres estados son excluyentes: cargando manda incluso si status cambia después a error', () => {
    setScopes([], { status: 'loading' });
    expect(host().querySelector('.sol-scope-switcher__loading')).not.toBeNull();
    expect(host().querySelector('.sol-scope-switcher__error')).toBeNull();

    fixture.componentRef.setInput('status', 'error');
    fixture.detectChanges();

    expect(host().querySelector('.sol-scope-switcher__loading')).toBeNull();
    expect(host().querySelector('.sol-scope-switcher__error')).not.toBeNull();
  });

  // ── Robustez ──────────────────────────────────────────────────────────────

  it('scopes=null se comporta como lista vacía sin reventar', () => {
    expect(() => setScopes(null)).not.toThrow();
    expect(host().querySelector('.sol-scope-switcher__empty')).not.toBeNull();
  });

  it('scopes=undefined no revienta el render', () => {
    expect(() => setScopes(undefined)).not.toThrow();
  });

  // ── Accesibilidad y textos ────────────────────────────────────────────────

  it('el disparador declara aria-haspopup y enlaza el panel portaleado con aria-controls', () => {
    setScopes(DOS_AMBITOS);

    expect(trigger()!.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger()!.getAttribute('aria-controls')).toBeNull();

    openPanel();
    expect(trigger()!.getAttribute('aria-controls')).toBe(fixture.componentInstance.panelId);
    expect(panel()!.id).toBe(fixture.componentInstance.panelId);
  });

  it('las etiquetas accesibles salen del catálogo real (claves verificadas contra es-CO.json)', () => {
    setScopes(DOS_AMBITOS);
    expect(trigger()!.getAttribute('aria-label')).toBe('Selecciona el ámbito activo');

    openPanel();
    expect(panel()!.getAttribute('aria-label')).toBe('Ámbitos disponibles');
  });

  it('el consumidor puede sobrescribir las etiquetas accesibles', () => {
    setScopes(DOS_AMBITOS, {
      triggerAriaLabel: 'Selecciona la sede activa',
      panelAriaLabel: 'Sedes disponibles',
    });

    expect(trigger()!.getAttribute('aria-label')).toBe('Selecciona la sede activa');
    openPanel();
    expect(panel()!.getAttribute('aria-label')).toBe('Sedes disponibles');
  });
});

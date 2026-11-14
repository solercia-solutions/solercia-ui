import { describe, expect, it } from 'vitest';
import {
  SOL_BUNDLED_DEFAULT_THEME,
  isRenderableTheme,
  isSafeBackgroundImage,
  resolveCssVars,
  type ThemeFile,
} from '@solercia/ui';
import { buildThemeFile, mapThemeFileToForm } from './theme-builder';
import {
  DEFAULT_STUDIO_FORM,
  cloneStudioForm,
  type StudioShadowStyle,
  type StudioTexture,
  type ThemeStudioForm,
  type ThemeStudioModeForm,
} from '../model/theme-studio-form.model';

/** Formulario por defecto con overrides en los compartidos y en AMBOS modos. */
function formWith(
  shared: Partial<ThemeStudioForm> = {},
  mode: Partial<ThemeStudioModeForm> = {},
): ThemeStudioForm {
  const base = cloneStudioForm(DEFAULT_STUDIO_FORM);
  return { ...base, ...shared, light: { ...base.light, ...mode }, dark: { ...base.dark, ...mode } };
}

const vars = (theme: ThemeFile, mode: 'light' | 'dark' = 'light') => resolveCssVars(theme, mode);

describe('buildThemeFile', () => {
  it('produce un tema renderizable en ambos modos sobre el tema empaquetado', () => {
    expect(isRenderableTheme(buildThemeFile(DEFAULT_STUDIO_FORM))).toBe(true);
  });

  it('todas las combinaciones de textura y sombra son renderizables y solo emiten gradients', () => {
    const textures: StudioTexture[] = ['none', 'glow', 'grid', 'stripes', 'corners', 'dots', 'mesh', 'vignette', 'waves'];
    const shadows: StudioShadowStyle[] = ['none', 'soft', 'diffuse', 'hard'];
    for (const texture of textures) {
      for (const shadow of shadows) {
        const theme = buildThemeFile(formWith({}, { texture, shadow }));
        expect(isRenderableTheme(theme)).toBe(true);
        expect(isSafeBackgroundImage(vars(theme).get('--sol-bg-page-texture')!)).toBe(true);
      }
    }
  });

  it('mapea primario, acento, fondo y roles de estado a sus tokens (WYSIWYG)', () => {
    const theme = buildThemeFile(formWith({}, { primary: '#17324F', accent: '#C98A3E', pageBg: '#FBF9F5', danger: '#9C4A3C' }));
    const light = vars(theme);
    expect(light.get('--sol-color-primary')).toBe('#17324F');
    expect(light.get('--sol-color-accent')).toBe('#C98A3E');
    expect(light.get('--sol-bg-page')).toBe('#FBF9F5');
    expect(light.get('--sol-color-danger')).toBe('#9C4A3C');
  });

  it('claro y oscuro se emiten independientes: el oscuro no se deriva del claro', () => {
    const form = cloneStudioForm(DEFAULT_STUDIO_FORM);
    form.light.primary = '#123456';
    form.dark.primary = '#ABCDEF';
    const theme = buildThemeFile(form);
    expect(vars(theme, 'light').get('--sol-color-primary')).toBe('#123456');
    expect(vars(theme, 'dark').get('--sol-color-primary')).toBe('#ABCDEF');
  });

  it('los compartidos (densidad, radio, bordes) son idénticos en ambos modos', () => {
    const theme = buildThemeFile(formWith({ density: 'spacious', radius: 20, border: 'thick' }));
    for (const name of ['--sol-size-header-height', '--sol-card-radius', '--sol-border-width-default']) {
      expect(vars(theme, 'light').get(name)).toBe(vars(theme, 'dark').get(name));
    }
    expect(vars(theme).get('--sol-size-header-height')).toBe('62px');
    expect(vars(theme).get('--sol-card-radius')).toBe('20px');
    expect(vars(theme).get('--sol-border-width-default')).toBe('2px');
  });

  it('guarda de contraste: con fondo oscuro el overlay y el borde se derivan del propio fondo', () => {
    const dark = buildThemeFile(formWith({}, { pageBg: '#0B0F17' }));
    const light = buildThemeFile(formWith({}, { pageBg: '#F8FAFC' }));
    expect(dark.modes.light.semantic.surface.overlay).toBe('rgba(0,0,0,0.65)');
    expect(light.modes.light.semantic.surface.overlay).toBe('rgba(15,23,42,0.55)');
    // Borde: el fondo oscuro se aclara (mezcla con blanco), el claro se oscurece.
    expect(dark.modes.light.semantic.border.color).toBe('#32353C');
    expect(light.modes.light.semantic.border.color).not.toBe('#F8FAFC');
  });

  it('secondaryContrast se calcula: blanco sobre un secundario oscuro, tinta sobre uno claro', () => {
    const darkSecondary = buildThemeFile(formWith({}, { secondary: '#1F2937' }));
    const lightSecondary = buildThemeFile(formWith({}, { secondary: '#E2E8F0' }));
    expect(vars(darkSecondary).get('--sol-color-secondary-contrast')).toBe('#FFFFFF');
    expect(vars(lightSecondary).get('--sol-color-secondary-contrast')).toBe('#1E293B');
  });

  it('la sombra lleva el color y la orientación elegidos', () => {
    const theme = buildThemeFile(formWith({}, { shadow: 'hard', shadowColor: '#2563EB', shadowDirection: 'top-left' }));
    const card = vars(theme).get('--sol-card-shadow')!;
    expect(card.startsWith('-5px -5px 0px')).toBe(true);
    expect(card).toContain('rgba(37,99,235,');
  });

  it('emite la variante de tabla en ambos modos y conserva el resto del bloque del base', () => {
    const base = structuredClone(SOL_BUNDLED_DEFAULT_THEME);
    base.modes.light.component.table = { mobile: 'scroll' };
    base.modes.dark.component.table = { mobile: 'scroll' };
    const theme = buildThemeFile(formWith({ tableVariant: 'bordered' }), base);
    expect(theme.modes.light.component.table).toEqual({ mobile: 'scroll', variant: 'bordered' });
    expect(theme.modes.dark.component.table).toEqual({ mobile: 'scroll', variant: 'bordered' });
  });

  it('preserva el base: primitivos extra, alerts.duration, heroBg y meta del tenant', () => {
    const base = structuredClone(SOL_BUNDLED_DEFAULT_THEME);
    (base.primitives.size.control as Record<string, string>)['touch'] = '48px';
    base.modes.light.component.alerts.duration = 9000;
    base.modes.light.component.auth = { layout: 'centered', heroBg: 'linear-gradient(#000, #fff)' };
    base.meta = { ...base.meta, tenant: 'acme', tagline: 'Hola' };
    const theme = buildThemeFile(DEFAULT_STUDIO_FORM, base);
    expect((theme.primitives.size.control as Record<string, string>)['touch']).toBe('48px');
    expect(theme.modes.light.component.alerts.duration).toBe(9000);
    expect(theme.modes.light.component.auth?.heroBg).toBe('linear-gradient(#000, #fff)');
    expect(theme.meta.tenant).toBe('acme');
    expect(theme.meta.tagline).toBe('Hola');
  });

  it('nunca muta el tema base', () => {
    const base = structuredClone(SOL_BUNDLED_DEFAULT_THEME);
    const snapshot = JSON.stringify(base);
    buildThemeFile(formWith({ density: 'compact' }, { primary: '#000000' }), base);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('metaExtras viaja intacto a meta pero no pisa fonts ni defaultMode', () => {
    const extras = { loader: { image: '', animation: 'spin' }, defaultMode: 'dark', fonts: [] };
    const theme = buildThemeFile(formWith({ defaultMode: 'light' }), null, extras);
    const meta = theme.meta as unknown as Record<string, unknown>;
    expect(meta['loader']).toEqual({ image: '', animation: 'spin' });
    expect(theme.meta.defaultMode).toBe('light');
    expect(theme.meta.fonts?.length).toBeGreaterThan(0);
  });

  it('sin base (null) usa el tema empaquetado de la librería', () => {
    const theme = buildThemeFile(DEFAULT_STUDIO_FORM, null);
    expect(theme.meta.tenant).toBe(SOL_BUNDLED_DEFAULT_THEME.meta.tenant);
    expect(isRenderableTheme(theme)).toBe(true);
  });
});

describe('mapThemeFileToForm (round-trip)', () => {
  it('recupera los compartidos y los por modo desde un tema construido por el estudio', () => {
    const form = cloneStudioForm(DEFAULT_STUDIO_FORM);
    Object.assign(form, {
      displayFont: 'Fraunces',
      bodyFont: 'Lato',
      displayWeight: 800,
      baseSize: 13.5,
      lineHeight: 1.7,
      radius: 18,
      button: 'pill',
      input: 'filled',
      density: 'compact',
      border: 'normal',
      intensity: 'smooth',
      reveal: 'zoom',
      motionDuration: 'slow',
      overlayBlur: 'strong',
      authLayout: 'centered',
      defaultMode: 'dark',
      tableVariant: 'emphasis-header',
    } satisfies Partial<ThemeStudioForm>);
    Object.assign(form.light, { primary: '#17324F', texture: 'glow', textureColor1: '#EC4899', sidebar: 'accent', header: 'translucent' });
    Object.assign(form.dark, { primary: '#8FB8E8', surfaceBg: '#1A202D', textColor: '#E5E7EB', shadow: 'diffuse' });

    const back = mapThemeFileToForm(buildThemeFile(form));

    expect(back.displayFont).toBe('Fraunces');
    expect(back.bodyFont).toBe('Lato');
    expect(back.displayWeight).toBe(800);
    expect(back.baseSize).toBe(13.5);
    expect(back.lineHeight).toBe(1.7);
    expect(back.radius).toBe(18);
    expect(back.button).toBe('pill');
    expect(back.input).toBe('filled');
    expect(back.density).toBe('compact');
    expect(back.border).toBe('normal');
    expect(back.intensity).toBe('smooth');
    expect(back.reveal).toBe('zoom');
    expect(back.motionDuration).toBe('slow');
    expect(back.overlayBlur).toBe('strong');
    expect(back.authLayout).toBe('centered');
    expect(back.defaultMode).toBe('dark');
    expect(back.tableVariant).toBe('emphasis-header');
    expect(back.light.primary).toBe('#17324F');
    expect(back.light.texture).toBe('glow');
    expect(back.light.textureColor1).toBe('#EC4899');
    expect(back.light.sidebar).toBe('accent');
    expect(back.light.header).toBe('translucent');
    expect(back.dark.primary).toBe('#8FB8E8');
    expect(back.dark.surfaceBg).toBe('#1A202D');
    expect(back.dark.textColor).toBe('#E5E7EB');
    expect(back.dark.shadow).toBe('diffuse');
  });

  it('una variante de tabla desconocida cae al fallback', () => {
    const theme = buildThemeFile(DEFAULT_STUDIO_FORM);
    (theme.modes.light.component.table as Record<string, unknown>)['variant'] = 'neon';
    expect(mapThemeFileToForm(theme).tableVariant).toBe(DEFAULT_STUDIO_FORM.tableVariant);
  });

  it('un tema irresoluble devuelve una copia del fallback', () => {
    const broken = structuredClone(SOL_BUNDLED_DEFAULT_THEME) as unknown as { modes: { light: { semantic: unknown } } };
    broken.modes.light.semantic = {};
    const result = mapThemeFileToForm(broken as unknown as ThemeFile);
    expect(result).toEqual(DEFAULT_STUDIO_FORM);
    expect(result).not.toBe(DEFAULT_STUDIO_FORM);
    expect(result.light).not.toBe(DEFAULT_STUDIO_FORM.light);
  });
});

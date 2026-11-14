import { describe, expect, it } from 'vitest';
import { buildThemeFile } from './theme-builder';
import { DEFAULT_STUDIO_FORM } from '../model/theme-studio-form.model';
import {
  MAX_THEME_JSON_BYTES,
  ThemeImportError,
  mergeThemeEditorChanges,
  parseThemeJson,
  type ThemeImportErrorCode,
} from './theme-json-file';

const theme = buildThemeFile(DEFAULT_STUDIO_FORM);

/** Ejecuta el parser y devuelve el código del error (o falla si no lanza). */
function codeOf(run: () => unknown): { code: ThemeImportErrorCode; path?: string } {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ThemeImportError);
    const typed = error as ThemeImportError;
    return { code: typed.code, path: typed.path };
  }
  throw new Error('se esperaba un ThemeImportError');
}

describe('parseThemeJson', () => {
  it('hace round-trip del tema exportado sin normalizar tokens', () => {
    expect(parseThemeJson(JSON.stringify(theme), theme)).toEqual(theme);
  });

  it('acepta los opcionales del contrato: name, favicon, variante de tabla y contraste del primario', () => {
    const changed = structuredClone(theme);
    changed.meta.name = 'Institucional';
    changed.meta.favicon = '/assets/favicon.ico';
    changed.modes.light.component.table = { variant: 'banded' };
    changed.modes.dark.semantic.color.primaryContrast = '#0B0F17';
    expect(parseThemeJson(JSON.stringify(changed), theme)).toEqual(changed);
  });

  it('acepta los campos opacos del host declarados en metaExtras', () => {
    const changed = structuredClone(theme);
    Object.assign(changed.meta, { loader: { image: '', presentation: 'centered' } });
    const parsed = parseThemeJson(JSON.stringify(changed), theme, {
      metaExtras: { loader: { image: '', presentation: 'current' } },
    });
    expect((parsed.meta as unknown as Record<string, unknown>)['loader']).toEqual({ image: '', presentation: 'centered' });
  });

  it.each([
    ['{', 'invalid-json'],
    ['null', 'invalid-structure'],
    ['[]', 'invalid-structure'],
    ['{}', 'invalid-structure'],
    ['{"meta":null}', 'invalid-structure'],
  ] as const)('rechaza sintaxis o estructura inválida %s → %s', (text, code) => {
    expect(codeOf(() => parseThemeJson(text, theme)).code).toBe(code);
  });

  it('rechaza el archivo demasiado grande antes de parsearlo', () => {
    expect(codeOf(() => parseThemeJson(' '.repeat(MAX_THEME_JSON_BYTES + 1), theme)).code).toBe('too-large');
  });

  it('reporta la ruta de una clave no soportada', () => {
    const changed = structuredClone(theme);
    Object.assign(changed.meta, { unsupportedName: 'x' });
    expect(codeOf(() => parseThemeJson(JSON.stringify(changed), theme))).toEqual({
      code: 'unsupported-key',
      path: 'theme.meta.unsupportedName',
    });
  });

  it.each(['__proto__', 'constructor', 'prototype'])('rechaza la clave peligrosa %s sin contaminar prototipos', key => {
    const text = JSON.stringify(theme).replace('"meta":{', `"meta":{"${key}":{"polluted":true},`);
    expect(codeOf(() => parseThemeJson(text, theme)).code).toBe('unsafe-key');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it.each([
    'javascript:alert(1)',
    'url(https://bad.example/x.png)',
    'expression(alert(1))',
    '@import "https://bad.example/x.css"',
    '<img src=x onerror=alert(1)>',
    'data:image/svg+xml,<svg/>',
    '//evil.example/logo.png',
  ])('rechaza el valor inseguro %s en meta.logo.url', value => {
    const changed = structuredClone(theme);
    changed.meta.logo.url = value;
    expect(codeOf(() => parseThemeJson(JSON.stringify(changed), theme)).code).toBe('unsafe-value');
  });

  it('rechaza url( dentro de un token de color', () => {
    const changed = structuredClone(theme);
    changed.modes.light.semantic.color.primary = 'url(https://bad.example/x)';
    expect(codeOf(() => parseThemeJson(JSON.stringify(changed), theme)).code).toBe('unsafe-value');
  });

  it.each(['url(https://invalid.test)', 'javascript:alert(1)', { nested: '#ffffff' }, 'red'])(
    'los colores de marca extra solo aceptan hex: rechaza %s',
    value => {
      const changed = structuredClone(theme);
      const colors = changed.primitives.color as Record<string, unknown>;
      colors['brand'] = { ...(colors['brand'] as object), custom: value };
      expect(codeOf(() => parseThemeJson(JSON.stringify(changed), theme)).path).toBe('theme.primitives.color.brand.custom');
    },
  );

  it('acepta un color de marca extra en hex', () => {
    const changed = structuredClone(theme);
    const colors = changed.primitives.color as Record<string, unknown>;
    colors['brand'] = { ...(colors['brand'] as object), custom: '#AABBCC' };
    expect(parseThemeJson(JSON.stringify(changed), theme)).toEqual(changed);
  });

  it('rechaza una variante de tabla o un modo por defecto fuera de su dominio', () => {
    const badVariant = structuredClone(theme);
    (badVariant.modes.light.component as unknown as Record<string, unknown>)['table'] = { variant: 'neon' };
    expect(codeOf(() => parseThemeJson(JSON.stringify(badVariant), theme)).code).toBe('invalid-value');

    const badMode = structuredClone(theme);
    (badMode.meta as unknown as Record<string, unknown>)['defaultMode'] = 'sepia';
    expect(codeOf(() => parseThemeJson(JSON.stringify(badMode), theme)).code).toBe('invalid-value');
  });

  it('rechaza un contraste del primario que no es hex', () => {
    const changed = structuredClone(theme);
    changed.modes.light.semantic.color.primaryContrast = 'white';
    expect(codeOf(() => parseThemeJson(JSON.stringify(changed), theme)).code).toBe('invalid-value');
  });

  it('rechaza un anidamiento más profundo que el límite', () => {
    let nested: Record<string, unknown> = {};
    const root = nested;
    for (let i = 0; i < 30; i++) {
      nested['tenant'] = {};
      nested = nested['tenant'] as Record<string, unknown>;
    }
    const changed = { ...structuredClone(theme), meta: root };
    expect(codeOf(() => parseThemeJson(JSON.stringify(changed), theme)).code).toBe('invalid-structure');
  });

  it('rechaza un tema que no resuelve sus variables', () => {
    const changed = structuredClone(theme);
    changed.modes.dark.semantic.color.primary = '{color.noexiste.500}';
    expect(codeOf(() => parseThemeJson(JSON.stringify(changed), theme)).code).toBe('not-renderable');
  });

  it('no muta el tema actual ante un import inválido', () => {
    const before = JSON.stringify(theme);
    codeOf(() => parseThemeJson('{"meta":{"tenant":null},"primitives":{},"modes":{}}', theme));
    expect(JSON.stringify(theme)).toBe(before);
  });
});

describe('mergeThemeEditorChanges', () => {
  it('conserva los tokens importados cuando cambia un control no relacionado', () => {
    const original = { tokens: { primary: '#123456', secondary: '#abcdef' }, radius: 12 };
    const before = { tokens: { primary: '#999999', secondary: '#000000' }, radius: 12 };
    const after = { ...before, radius: 16 };
    expect(mergeThemeEditorChanges(original, before, after)).toEqual({ ...original, radius: 16 });
  });

  it('sin cambios devuelve el original tal cual', () => {
    const original = { a: 1 };
    expect(mergeThemeEditorChanges(original, { a: 2 }, { a: 2 })).toBe(original);
  });
});

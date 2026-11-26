import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import {
  SOL_I18N,
  SOL_I18N_EN,
  SOL_I18N_ES_CO,
  createIdentitySolI18n,
  createSolI18n,
  type SolI18nCatalog,
} from './sol-i18n';

function readCatalog(file: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), 'projects', 'solercia', 'ui', 'i18n', file), 'utf-8'));
}

function flatKeys(catalog: SolI18nCatalog, prefix = ''): string[] {
  return Object.entries(catalog).flatMap(([key, value]) =>
    typeof value === 'string' ? [prefix + key] : flatKeys(value, `${prefix}${key}.`),
  );
}

describe('SOL_I18N — English by default', () => {
  it('the default engine (no provider) is English and resolves shared.* keys', () => {
    const i18n = TestBed.inject(SOL_I18N);
    expect(i18n.activeLang()).toBe('en');
    expect(i18n.translate('shared.modal.close')).toBe('Close');
    expect(i18n.translate('shared.starRating.label', { rating: 4, max: 5 })).toBe('4 of 5');
    expect(i18n.t('shared.drawer.close')()).toBe('Close');
    expect(i18n.tMany(['shared.form.yes', 'shared.form.no'])()).toEqual(['Yes', 'No']);
  });

  it('keeps returning the key for unknown keys', () => {
    expect(TestBed.inject(SOL_I18N).translate('host.unknown')).toBe('host.unknown');
  });

  it('identity engine is English too', () => {
    expect(createIdentitySolI18n().activeLang()).toBe('en');
  });
});

describe('createSolI18n', () => {
  it('opts into Colombian Spanish with the bundled catalog', () => {
    const i18n = createSolI18n({ lang: 'es-CO' });
    expect(i18n.translate('shared.modal.close')).toBe('Cerrar');
    expect(i18n.translate('shared.starRating.label', { rating: 4, max: 5 })).toBe('4 de 5');
  });

  it('matches the base language (es → es-CO) and switches reactively with setLang', () => {
    const i18n = createSolI18n({ lang: 'es' });
    const close = i18n.t('shared.modal.close');
    expect(close()).toBe('Cerrar');
    i18n.setLang('en-US');
    expect(close()).toBe('Close');
    expect(i18n.activeLang()).toBe('en-US');
  });

  it('falls back to English for a key missing in the active catalog', () => {
    const i18n = createSolI18n({ lang: 'fr', catalogs: { en: SOL_I18N_EN, fr: { shared: { modal: { close: 'Fermer' } } } } });
    expect(i18n.translate('shared.modal.close')).toBe('Fermer');
    expect(i18n.translate('shared.drawer.close')).toBe('Close');
  });
});

describe('bundled catalogs', () => {
  it('the exported constants match the JSON files shipped in the package', () => {
    expect(SOL_I18N_EN).toEqual(readCatalog('en.json'));
    expect(SOL_I18N_ES_CO).toEqual(readCatalog('es-CO.json'));
  });

  it('English and Spanish have exactly the same keys', () => {
    expect(flatKeys(SOL_I18N_EN).sort()).toEqual(flatKeys(SOL_I18N_ES_CO).sort());
  });
});

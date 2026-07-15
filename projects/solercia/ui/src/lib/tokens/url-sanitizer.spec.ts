import { sanitizeAssetUrl } from './url-sanitizer';

/**
 * Sanitización de URLs de assets de branding por tenant (E6): el logo del
 * ThemeFile llega del API en runtime y se inyecta en `<img [src]>` y en el
 * favicon (`setAttribute`, fuera del sanitizer de Angular). Solo se aceptan
 * http/https/relativas — jamás `javascript:`, `data:` ni otros esquemas.
 */
describe('sanitizeAssetUrl', () => {
  it('acepta URLs https absolutas', () => {
    expect(sanitizeAssetUrl('https://cdn.acme.co/logo.svg')).toBe('https://cdn.acme.co/logo.svg');
  });

  it('acepta URLs http absolutas', () => {
    expect(sanitizeAssetUrl('http://cdn.acme.co/logo.png')).toBe('http://cdn.acme.co/logo.png');
  });

  it('acepta rutas relativas al origen', () => {
    expect(sanitizeAssetUrl('/assets/logos/boki-logo.svg')).toBe('/assets/logos/boki-logo.svg');
    expect(sanitizeAssetUrl('assets/logos/boki-logo.svg')).toBe('assets/logos/boki-logo.svg');
  });

  it('rechaza javascript: (incluso con mayúsculas)', () => {
    expect(sanitizeAssetUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeAssetUrl('JavaScript:alert(1)')).toBeNull();
  });

  it('rechaza data: y cualquier otro esquema no http/https', () => {
    expect(sanitizeAssetUrl('data:image/svg+xml,<svg/>')).toBeNull();
    expect(sanitizeAssetUrl('vbscript:msgbox(1)')).toBeNull();
    expect(sanitizeAssetUrl('file:///etc/passwd')).toBeNull();
  });

  it('rechaza esquemas ofuscados con caracteres de control o espacios embebidos', () => {
    expect(sanitizeAssetUrl('java\tscript:alert(1)')).toBeNull();
    expect(sanitizeAssetUrl('java\nscript:alert(1)')).toBeNull();
    expect(sanitizeAssetUrl('java script:alert(1)')).toBeNull();
  });

  it('devuelve null para vacío, null o solo espacios', () => {
    expect(sanitizeAssetUrl('')).toBeNull();
    expect(sanitizeAssetUrl('   ')).toBeNull();
    expect(sanitizeAssetUrl(null)).toBeNull();
    expect(sanitizeAssetUrl(undefined)).toBeNull();
  });

  it('recorta espacios en los extremos de una URL válida', () => {
    expect(sanitizeAssetUrl('  https://cdn.acme.co/logo.svg  ')).toBe(
      'https://cdn.acme.co/logo.svg',
    );
  });
});

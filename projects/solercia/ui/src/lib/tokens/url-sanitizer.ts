/**
 * Sanitización de URLs de assets de branding por tenant (E6).
 *
 * El logo del ThemeFile llega del API en RUNTIME (dato no confiable) y se
 * aplica en `<img [src]>` y en el favicon vía `setAttribute` — esta última
 * ruta queda FUERA del sanitizer de plantillas de Angular, por eso la
 * validación explícita: solo http/https/relativas; `javascript:`, `data:` y
 * cualquier otro esquema se descartan (mejor sin logo que con un vector XSS).
 */

/** Esquema explícito al inicio de la URL (RFC 3986: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) ":"). */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/** Caracteres de control (U+0000–U+001F, U+007F) o espacios embebidos: ofuscan esquemas ("java\tscript:"). */
const UNSAFE_CHARS = new RegExp('[\\u0000-\\u001F\\u007F\\s]');

/**
 * Devuelve la URL si es segura para un asset (http:, https: o relativa al
 * origen); `null` en cualquier otro caso. Nunca lanza.
 */
export function sanitizeAssetUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? '').trim();
  if (trimmed === '' || UNSAFE_CHARS.test(trimmed)) return null;

  const scheme = SCHEME_PATTERN.exec(trimmed)?.[0].toLowerCase();
  if (scheme && scheme !== 'http:' && scheme !== 'https:') return null;

  return trimmed;
}

import { describe, it, expect } from 'vitest';
import { ICON_REGISTRY } from './icon.registry';

/**
 * Gate automatizado del registry de íconos (spec: solercia-ui-icon-registry
 * #gate automatizado contra SVG inline). Corre en `ng test @solercia/ui`
 * como parte de la suite normal — no requiere setup adicional.
 *
 * Reglas exigidas a TODA entrada de `ICON_REGISTRY`, presente o futura:
 *   1. La clave es kebab-case (`/^[a-z0-9]+(-[a-z0-9]+)*$/`).
 *   2. `outline` NUNCA está vacío. `fill` puede ser `''` (outline-only,
 *      convención documentada en `IconDef.fill` — ver `icon.registry.ts`) o
 *      un `<path>` sólido no vacío; lo que el gate PROHÍBE es un `fill`
 *      "casi vacío" por error (solo espacios en blanco, distinto de `''`
 *      exacta) — eso sí sería un olvido, no una declaración intencional.
 *   3. `outline`, y `fill` cuando no es `''`, son SVG inline válido: solo
 *      `<path>` (nunca un `<svg>` anidado ni otro elemento), y balanceado
 *      (mismo número de aperturas que cierres).
 */

const KEBAB_CASE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('ICON_REGISTRY gate', () => {
  const entries = Object.entries(ICON_REGISTRY);

  it('no está vacío (regresión de suite completa)', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('"%s" — clave en kebab-case', (name) => {
    expect(name).toMatch(KEBAB_CASE_RE);
  });

  it.each(entries)('"%s" — outline no vacío', (name, def) => {
    expect(def.outline.trim().length).toBeGreaterThan(0);
  });

  it.each(entries)('"%s" — fill es \'\' (outline-only) o un <path> sólido no vacío — nunca solo espacios', (name, def) => {
    if (def.fill === '') {
      return; // outline-only, declarado a propósito — ver IconDef.fill
    }
    expect(def.fill.trim().length, `${name}.fill es solo espacios en blanco — usa '' para outline-only`).toBeGreaterThan(0);
  });

  it.each(entries)('"%s" — outline/fill son solo <path> (sin <svg> anidado ni otros tags)', (name, def) => {
    const variants: Array<readonly [string, string]> = [['outline', def.outline]];
    if (def.fill !== '') {
      variants.push(['fill', def.fill]);
    }

    for (const [variant, markup] of variants) {
      expect(markup, `${name}.${variant} no debe contener un <svg> anidado`).not.toMatch(/<svg/i);

      const tags = markup.match(/<[a-zA-Z][a-zA-Z0-9-]*/g) ?? [];
      const nonPathTags = tags.filter((tag) => tag.toLowerCase() !== '<path');
      expect(nonPathTags, `${name}.${variant} solo debe usar <path> — encontrado: ${nonPathTags.join(', ')}`).toEqual([]);

      const opens = (markup.match(/<path/g) ?? []).length;
      const closes = (markup.match(/\/>/g) ?? []).length;
      expect(opens, `${name}.${variant} tiene <path> sin cerrar correctamente`).toBe(closes);
    }
  });
});

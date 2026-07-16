import { describe, it, expect } from 'vitest';
import { ICON_REGISTRY } from './icon.registry';

/**
 * Gate automatizado del registry de íconos (spec: solercia-ui-icon-registry
 * #gate automatizado contra SVG inline). Corre en `ng test @solercia/ui`
 * como parte de la suite normal — no requiere setup adicional.
 *
 * Reglas exigidas a TODA entrada de `ICON_REGISTRY`, presente o futura:
 *   1. La clave es kebab-case (`/^[a-z0-9]+(-[a-z0-9]+)*$/`).
 *   2. `outline` y `fill` no están vacíos.
 *   3. `outline`/`fill` son SVG inline válido: solo `<path>` (nunca un
 *      `<svg>` anidado ni otro elemento), y balanceado (mismo número de
 *      aperturas que cierres).
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

  it.each(entries)('"%s" — outline y fill no vacíos', (name, def) => {
    expect(def.outline.trim().length).toBeGreaterThan(0);
    expect(def.fill.trim().length).toBeGreaterThan(0);
  });

  it.each(entries)('"%s" — outline/fill son solo <path> (sin <svg> anidado ni otros tags)', (name, def) => {
    for (const [variant, markup] of [['outline', def.outline], ['fill', def.fill]] as const) {
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

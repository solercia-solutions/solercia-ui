import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * Gate automatizado contra `<svg>`/`<path>` inline dentro de la librería
 * (spec: solercia-ui-icon-registry#gate automatizado contra SVG inline).
 * Todo componente de `@solercia/ui` renderiza íconos vía `<sol-icon>`
 * (`ICON_REGISTRY`) — nunca pegando marcado SVG a mano en su propio template.
 *
 * Alcance: recorre `projects/solercia/ui/src/lib/**\/*.ts`, EXCLUYENDO:
 *   - `*.spec.ts` — son tests, no componentes; pueden contener strings con
 *     "<svg" a propósito (p. ej. `tokens/url-sanitizer.spec.ts` prueba que se
 *     RECHACEN URLs `data:image/svg+xml,...` maliciosas).
 *   - `ui/icon/icon.registry.ts` — es la fuente de verdad del registry.
 *   - `ui/icon/icon.component.ts` — el renderer; construye el wrapper
 *     `<svg>` real que interpreta `ICON_REGISTRY`.
 *
 * Excepciones documentadas (NO son "iconos derivados" — no aplica el
 * requisito de migración, ver spec.md nota "iconos derivados usados por
 * componentes de la librería"):
 *   - `ui/spinner/spinner.component.ts` y el spinner de carga embebido en
 *     `ui/button/button.component.ts`: son indicadores de carga ANIMADOS
 *     (arco con `stroke-dasharray` + `@keyframes` de rotación), no glifos
 *     estáticos — el registry no modela animación.
 *   - `ui/checkbox/checkbox.component.ts`: alterna 4 variantes de ícono
 *     (`check`/`minus`/`heart`/`star`) con `stroke-width` y una escala de
 *     tamaños (10/13/16px) propias, incompatibles con la escala fija de
 *     `<sol-icon>` (16/20/24px); `minus`/`star` no tienen entrada en el
 *     registry (fuera del alcance de iconos aprobado para este cambio).
 *
 * Si se agrega un ícono NUEVO a cualquier otro componente de la lib con
 * `<svg`/`<path>` inline, este test falla señalando archivo y línea.
 */

const here = dirname(fileURLToPath(import.meta.url));
const libRoot = here; // projects/solercia/ui/src/lib

const EXCLUDED_RELATIVE_PATHS = new Set([
  'ui/icon/icon.registry.ts',
  'ui/icon/icon.component.ts',
  'ui/spinner/spinner.component.ts',
  'ui/button/button.component.ts',
  'ui/checkbox/checkbox.component.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('gate: sin <svg>/<path> inline en projects/solercia/ui/src/lib', () => {
  const files = walk(libRoot);

  it('recorrió al menos un archivo (regresión de suite completa)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('ningún componente fuera de las excepciones documentadas contiene <svg>/<path> inline', () => {
    const violations: string[] = [];

    for (const file of files) {
      const relPath = relative(libRoot, file).replace(/\\/g, '/');
      if (EXCLUDED_RELATIVE_PATHS.has(relPath)) continue;

      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (/<svg[\s>]/i.test(line) || /<path[\s/>]/i.test(line)) {
          violations.push(`${relPath}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations, `SVG/path inline encontrado fuera de las excepciones documentadas:\n${violations.join('\n')}`).toEqual([]);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal } from '@angular/core';
import type { SolI18n } from '../i18n/sol-i18n';

/**
 * Stub de `SOL_I18N` para specs que VERIFICA la clave pedida contra el
 * catálogo de la librería `projects/solercia/ui/i18n/es-CO.json`, en vez de devolver
 * ciegamente `t(${key})` para cualquier clave.
 *
 * Motivación (hallazgo de review): un stub que siempre "traduce" con éxito
 * hace pasar el test aunque la clave NUNCA se haya agregado al catálogo real
 * — el componente terminaría mostrando la clave cruda en producción
 * (`SolI18n` identity fallback) sin que ningún test lo detectara. Este stub
 * lanza si la clave no existe en el catálogo, convirtiendo un "olvido de
 * traducción" en un fallo de test inmediato.
 *
 * Vive en `src/lib/testing/` (NO se exporta desde `public-api.ts`): es
 * infraestructura de test, nunca se empaqueta en el build de la librería.
 */
export function createCatalogCheckedI18nStub(): SolI18n {
  const resolve = (key: string): string => {
    const value = resolveKeyInCatalog(key);
    if (value === undefined) {
      throw new Error(
        `[test i18n] la clave "${key}" no existe en projects/solercia/ui/i18n/es-CO.json — ` +
          'agrégala al catálogo de la librería antes de usarla en el componente.',
      );
    }
    return value;
  };

  return {
    activeLang: signal('es-CO'),
    translate: (key: string) => resolve(key),
    t: (key: string) => signal(resolve(key)),
    tMany: (keys: string[]) => signal(keys.map(resolve)),
  };
}

let cachedCatalog: Record<string, unknown> | null = null;

function loadCatalog(): Record<string, unknown> {
  if (cachedCatalog) return cachedCatalog;
  // `import.meta.url` no es fiable aquí: el builder de Vitest sirve los
  // archivos bajo `src/lib/**` a través de un módulo virtual cuya URL NO
  // refleja la ruta real en disco (a diferencia de `schematics/**/*.spec.ts`,
  // fuera de `src/`, que sí preserva la ruta real). `process.cwd()` SÍ es
  // estable: `ng test @solercia/ui` siempre se invoca con cwd = raíz del repo
  // `solercia-ui` (workspace de Angular CLI).
  const path = join(process.cwd(), 'projects', 'solercia', 'ui', 'i18n', 'es-CO.json');
  const raw = readFileSync(path, 'utf-8');
  cachedCatalog = JSON.parse(raw) as Record<string, unknown>;
  return cachedCatalog;
}

function resolveKeyInCatalog(key: string): string | undefined {
  const catalog = loadCatalog();
  let node: unknown = catalog;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(segment in (node as Record<string, unknown>))) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

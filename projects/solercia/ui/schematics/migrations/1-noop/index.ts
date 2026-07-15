import { Rule, Tree } from '@angular-devkit/schematics';

/**
 * Migración no-op de ejemplo (`ng update @solercia/ui` a 0.1.0). Sienta el
 * andamiaje/convención para futuras migraciones reales — p. ej. cuando un
 * `ng update` mayor renombre un token `--sol-*` o un `input()` de un
 * componente `sol-*`, esta carpeta es el molde: cada versión con migración
 * agrega su propia entrada a `migrations.json` con un factory dedicado.
 *
 * Ver diseño (Decisión B): lo que evoluciona en la librería se propaga por
 * `ng update`, no por re-clonado (anti-patrón `modbase`).
 */
export function migrate(): Rule {
  return (tree: Tree) => {
    // Intencionalmente no-op: no hay cambios que migrar en 0.1.0.
    return tree;
  };
}

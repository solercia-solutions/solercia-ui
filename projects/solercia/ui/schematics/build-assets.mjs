#!/usr/bin/env node
/**
 * Copia los assets NO-TypeScript de la colección de schematics de
 * @solercia/ui (collection.json, migrations.json, cada schema.json y las
 * plantillas `files/`) al `dist/solercia/ui/schematics/` ya poblado por
 * `tsc -p projects/solercia/ui/tsconfig.schematics.json` (que solo emite los
 * `.js` compilados). Sin este paso, la colección publicada quedaría sin
 * schema.json ni plantillas — `ng g @solercia/ui:page` fallaría en un
 * consumidor real.
 *
 * Sin dependencias externas (filosofía "in-house por defecto", CLAUDE.md raíz):
 * usa únicamente `node:fs`/`node:path`.
 */
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMATICS_SRC = dirname(fileURLToPath(import.meta.url));
const UI_PROJECT_ROOT = join(SCHEMATICS_SRC, '..');
const DIST_SCHEMATICS = join(UI_PROJECT_ROOT, '..', '..', '..', 'dist', 'solercia', 'ui', 'schematics');

if (!existsSync(DIST_SCHEMATICS)) {
  console.error(
    `[build-schematics] No existe "${DIST_SCHEMATICS}" — corre primero ` +
      '`tsc -p projects/solercia/ui/tsconfig.schematics.json`.',
  );
  process.exit(1);
}

/** Copia solo assets (nunca .ts fuente/specs —ya compilados/excluidos— ni este propio script). */
function assetFilter(src) {
  if (src === join(SCHEMATICS_SRC, 'build-assets.mjs')) return false;
  if (src.endsWith('.spec.ts')) return false;
  if (src.endsWith('.ts') && !src.endsWith('.d.ts')) return false;
  return true;
}

cpSync(SCHEMATICS_SRC, DIST_SCHEMATICS, { recursive: true, filter: assetFilter });

console.log(`[build-schematics] Assets copiados a ${DIST_SCHEMATICS}`);

import { SchematicContext, SchematicsException, Tree } from '@angular-devkit/schematics';
import { readWorkspace } from '@schematics/angular/utility';
import { strings } from '@angular-devkit/schematics';

/**
 * Utilidades compartidas por los generadores `page`/`feature`/`entity`/`widget`
 * y por el schematic `ng-add` de `@solercia/ui`.
 *
 * Viven en `schematics/` (NO en `src/`) porque corren en Node al momento de
 * generar código — nunca se empaquetan en el runtime del navegador. Se
 * compilan aparte (`tsconfig.schematics.json`) y se copian al `dist` junto
 * con `collection.json`, cada `schema.json` y las plantillas `files/`.
 */

/** Nombre de la carpeta raíz de código fuente FSD (convención fija del ecosistema). */
export const DEFAULT_SOURCE_ROOT = 'src';

/** Alias `Sol*` reservado a `shared/ui` (CONVENCIONES-FRONT-SOLERCIA §5): los
 * generadores de page/feature/entity/widget NUNCA anteponen `Sol` al nombre
 * de clase — solo el prefijo `sol-` del selector es universal en la app. */
export function toClassName(name: string): string {
  return strings.classify(name);
}

export function toDasherized(name: string): string {
  return strings.dasherize(name);
}

export function toCamelCase(name: string): string {
  return strings.camelize(name);
}

/** Pluralización naive para nombres de recursos REST (`tag` → `tags`, `faq` → `faqs`).
 * Suficiente para el andamiaje generado; el desarrollador ajusta si el plural es irregular. */
export function toPluralKebab(name: string): string {
  const dasherized = toDasherized(name);
  return dasherized.endsWith('s') ? dasherized : `${dasherized}s`;
}

/**
 * Resuelve el nombre del proyecto Angular objetivo: el explícito (`--project`),
 * o si no se dio ninguno, el primer proyecto de tipo `application` del
 * workspace (o el primero que exista). `null` cuando no hay `angular.json`
 * (p. ej. un `Tree` de test vacío).
 */
export async function resolveProjectName(tree: Tree, projectName?: string): Promise<string | null> {
  if (!tree.exists('/angular.json')) {
    return null;
  }

  const workspace = await readWorkspace(tree);
  return (
    projectName ??
    [...workspace.projects.keys()].find((candidate) => {
      return workspace.projects.get(candidate)?.extensions?.['projectType'] === 'application';
    }) ??
    [...workspace.projects.keys()][0] ??
    null
  );
}

/**
 * Resuelve el `sourceRoot` del proyecto Angular objetivo (por defecto `src`).
 * Usa `angular.json` cuando existe (workspace real); cae a {@link DEFAULT_SOURCE_ROOT}
 * cuando no hay workspace (p. ej. un `Tree` de test vacío), para que los
 * generadores sigan siendo utilizables de forma aislada en `SchematicTestRunner`.
 */
export async function resolveSourceRoot(tree: Tree, projectName?: string): Promise<string> {
  const name = await resolveProjectName(tree, projectName);
  if (!name) {
    return DEFAULT_SOURCE_ROOT;
  }

  const workspace = await readWorkspace(tree);
  const project = workspace.projects.get(name);
  if (!project) {
    throw new SchematicsException(`El proyecto "${name}" no existe en angular.json.`);
  }

  return project.sourceRoot ?? `${project.root}/${DEFAULT_SOURCE_ROOT}`.replace(/^\//, '');
}

/**
 * Inserta (idempotente) una clave i18n anidada en el JSON `es-CO` del host, bajo
 * `namespace.camelName.leafKey`. Si el archivo no existe (host sin i18n Transloco
 * cableado como boki-front), no falla: solo avisa por el logger — el andamiaje
 * FSD generado sigue siendo válido, solo falta la traducción manual.
 */
export function upsertI18nKey(
  tree: Tree,
  context: SchematicContext,
  namespace: string,
  camelName: string,
  leafKey: string,
  value: string,
  i18nPath = `${DEFAULT_SOURCE_ROOT}/assets/i18n/es-CO.json`,
): void {
  if (!tree.exists(i18nPath)) {
    context.logger.warn(
      `[@solercia/ui] No se encontró "${i18nPath}" — agrega manualmente la clave ` +
        `"${namespace}.${camelName}.${leafKey}" al catálogo i18n del proyecto.`,
    );
    return;
  }

  const raw = tree.read(i18nPath);
  if (!raw) {
    return;
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw.toString('utf-8'));
  } catch {
    context.logger.warn(`[@solercia/ui] "${i18nPath}" no es JSON válido — se omite la inserción de claves i18n.`);
    return;
  }

  const nsBucket = (json[namespace] ??= {}) as Record<string, unknown>;
  const entryBucket = (nsBucket[camelName] ??= {}) as Record<string, unknown>;
  if (entryBucket[leafKey] === undefined) {
    entryBucket[leafKey] = value;
    tree.overwrite(i18nPath, `${JSON.stringify(json, null, 2)}\n`);
  }
}

/**
 * Agrega (idempotente) una línea `export ... from './<name>';` al barrel agregador
 * de una capa (`widgets/index.ts`, `features/index.ts`, `entities/index.ts`). Las
 * `pages/` NO tienen agregador (lazy-loading por ruta, ver `pages/index.ts` real
 * de boki-front) — los generadores de `page` nunca llaman esta función.
 */
export function appendToLayerBarrel(tree: Tree, barrelPath: string, exportLine: string): void {
  if (!tree.exists(barrelPath)) {
    return;
  }

  const raw = tree.read(barrelPath)?.toString('utf-8') ?? '';
  if (raw.includes(exportLine)) {
    return;
  }

  const separator = raw.length > 0 && !raw.endsWith('\n') ? '\n' : '';
  tree.overwrite(barrelPath, `${raw}${separator}${exportLine}\n`);
}

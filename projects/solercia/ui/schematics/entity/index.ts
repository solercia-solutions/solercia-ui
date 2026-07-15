import {
  Rule,
  SchematicContext,
  Tree,
  apply,
  url,
  applyTemplates,
  move,
  mergeWith,
  chain,
} from '@angular-devkit/schematics';
import {
  appendToLayerBarrel,
  resolveSourceRoot,
  toClassName,
  toDasherized,
  toPluralKebab,
} from '../utils';

export interface EntityOptions {
  name: string;
  project?: string;
}

/**
 * `ng g @solercia/ui:entity <name>` — crea `<sourceRoot>/entities/<name>/`
 * con `model/<name>.model.ts` (interfaz de dominio) y `api/<name>-api.service.ts`
 * (CRUD REST sobre `APP_CONSTANTS.apiBaseUrl`), calcado del molde real
 * (`src/entities/tag/`). Las entities NO tienen componentes: la capa `entities`
 * solo modela dominio + acceso a datos (CONVENCIONES-FRONT-SOLERCIA §4).
 *
 * Actualiza (idempotente) el barrel agregador `<sourceRoot>/entities/index.ts`
 * además del `index.ts` propio de la carpeta nueva.
 */
export function entity(options: EntityOptions): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    if (!options.name?.trim()) {
      throw new Error('El schematic "entity" requiere un nombre, ej. `ng g @solercia/ui:entity tag`.');
    }

    const sourceRoot = await resolveSourceRoot(tree, options.project);
    const name = toDasherized(options.name);
    const className = toClassName(options.name);
    const pluralName = toPluralKebab(options.name);
    const targetDir = `${sourceRoot}/entities/${name}`;

    const templateSource = apply(url('./files'), [
      applyTemplates({ name, className, pluralName }),
      move(targetDir),
    ]);

    context.logger.info(
      `[@solercia/ui] Entity "${name}" creada en ${targetDir}/ (recurso REST /${pluralName}). ` +
        `Ajusta los campos del modelo al contrato real del backend.`,
    );

    return chain([
      mergeWith(templateSource),
      (host: Tree) => {
        appendToLayerBarrel(
          host,
          `${sourceRoot}/entities/index.ts`,
          `export type { ${className}, Create${className}Request } from './${name}';\nexport { ${className}ApiService } from './${name}';`,
        );
        return host;
      },
    ]);
  };
}

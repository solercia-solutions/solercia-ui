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
  toCamelCase,
  toClassName,
  toDasherized,
  upsertI18nKey,
} from '../utils';

export interface FeatureOptions {
  name: string;
  project?: string;
}

/**
 * `ng g @solercia/ui:feature <name>` — crea `<sourceRoot>/features/<name>/`
 * con un componente standalone `OnPush` con signals (`input()`/`output()`),
 * calcado del molde real (`src/features/auth/ui/login-form.component.ts`):
 * selector `sol-<name>`, clase `<Name>Component`, textos por
 * `I18nService.t('features.<camelName>.*')`.
 *
 * Actualiza (idempotente) el barrel agregador `<sourceRoot>/features/index.ts`
 * además del `index.ts` propio de la carpeta nueva.
 */
export function feature(options: FeatureOptions): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    if (!options.name?.trim()) {
      throw new Error('El schematic "feature" requiere un nombre, ej. `ng g @solercia/ui:feature manage-tags`.');
    }

    const sourceRoot = await resolveSourceRoot(tree, options.project);
    const name = toDasherized(options.name);
    const className = toClassName(options.name);
    const camelName = toCamelCase(options.name);
    const selector = `sol-${name}`;
    const targetDir = `${sourceRoot}/features/${name}`;

    upsertI18nKey(tree, context, 'features', camelName, 'title', className, `${sourceRoot}/assets/i18n/es-CO.json`);

    const templateSource = apply(url('./files'), [
      applyTemplates({ name, className, camelName, selector }),
      move(targetDir),
    ]);

    return chain([
      mergeWith(templateSource),
      (host: Tree) => {
        appendToLayerBarrel(
          host,
          `${sourceRoot}/features/index.ts`,
          `export { ${className}Component } from './${name}';`,
        );
        return host;
      },
    ]);
  };
}

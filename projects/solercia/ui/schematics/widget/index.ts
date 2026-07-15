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

export interface WidgetOptions {
  name: string;
  project?: string;
}

/**
 * `ng g @solercia/ui:widget <name>` — crea `<sourceRoot>/widgets/<name>/` con
 * un componente standalone `OnPush` con signals, calcado del molde real
 * (`src/widgets/stat-card/ui/stat-card.component.ts`): selector `sol-<name>`,
 * clase `<Name>Component` (SIN prefijo `Sol` — reservado a `shared/ui`),
 * textos por `I18nService.t('widgets.<camelName>.*')`.
 *
 * Actualiza (idempotente) el barrel agregador `<sourceRoot>/widgets/index.ts`
 * además del `index.ts` propio de la carpeta nueva.
 */
export function widget(options: WidgetOptions): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    if (!options.name?.trim()) {
      throw new Error('El schematic "widget" requiere un nombre, ej. `ng g @solercia/ui:widget stat-card`.');
    }

    const sourceRoot = await resolveSourceRoot(tree, options.project);
    const name = toDasherized(options.name);
    const className = toClassName(options.name);
    const camelName = toCamelCase(options.name);
    const selector = `sol-${name}`;
    const targetDir = `${sourceRoot}/widgets/${name}`;

    upsertI18nKey(tree, context, 'widgets', camelName, 'title', className, `${sourceRoot}/assets/i18n/es-CO.json`);

    const templateSource = apply(url('./files'), [
      applyTemplates({ name, className, camelName, selector }),
      move(targetDir),
    ]);

    return chain([
      mergeWith(templateSource),
      (host: Tree) => {
        appendToLayerBarrel(
          host,
          `${sourceRoot}/widgets/index.ts`,
          `export { ${className}Component } from './${name}';`,
        );
        return host;
      },
    ]);
  };
}

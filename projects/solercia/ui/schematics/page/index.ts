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
import { resolveSourceRoot, toClassName, toCamelCase, toDasherized, upsertI18nKey } from '../utils';

export interface PageOptions {
  name: string;
  project?: string;
}

/**
 * `ng g @solercia/ui:page <name>` — crea `<sourceRoot>/pages/<name>/` con la
 * page standalone `OnPush`, sus rutas locales (`<name>.routes.ts`) y su
 * `index.ts` (public API), calcados del molde real de `boki-front`
 * (`src/pages/login/`): selector `sol-<name>-page`, clase `<Name>PageComponent`
 * (SIN prefijo `Sol` — reservado a `shared/ui`), textos por `I18nService.t()`.
 *
 * `pages/` NO tiene barrel agregador (lazy-loading por ruta): a diferencia de
 * `feature`/`entity`/`widget`, este generador no toca ningún `index.ts` fuera
 * de la carpeta de la page. La página queda lista para cablearse a mano en
 * las rutas del host (el mensaje final imprime el snippet exacto).
 */
export function page(options: PageOptions): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    if (!options.name?.trim()) {
      throw new Error('El schematic "page" requiere un nombre, ej. `ng g @solercia/ui:page catalog`.');
    }

    const sourceRoot = await resolveSourceRoot(tree, options.project);
    const name = toDasherized(options.name);
    const className = toClassName(options.name);
    const camelName = toCamelCase(options.name);
    const selector = `sol-${name}-page`;
    const targetDir = `${sourceRoot}/pages/${name}`;

    upsertI18nKey(tree, context, 'pages', camelName, 'title', className, `${sourceRoot}/assets/i18n/es-CO.json`);

    const templateSource = apply(url('./files'), [
      applyTemplates({ name, className, camelName, selector }),
      move(targetDir),
    ]);

    context.logger.info(
      `[@solercia/ui] Page "${name}" creada en ${targetDir}/. Cablea la ruta lazy en tu router:\n` +
        `  { path: '${name}', loadChildren: () => import('@pages/${name}').then((m) => m.${camelName}Routes) }`,
    );

    return chain([mergeWith(templateSource)]);
  };
}

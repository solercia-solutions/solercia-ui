import {
  Rule,
  SchematicContext,
  Tree,
  chain,
} from '@angular-devkit/schematics';
import {
  addDependency,
  addRootProvider,
  DependencyType,
  InstallBehavior,
} from '@schematics/angular/utility';
import { JSONFile } from '@schematics/angular/utility/json-file';
import { resolveProjectName, resolveSourceRoot } from '../utils';

export interface NgAddOptions {
  project?: string;
  skipInstall?: boolean;
}

/** Alias FSD fijos del ecosistema Solercia (CONVENCIONES-FRONT-SOLERCIA.md). */
function fsdPathAliases(sourceRoot: string): Record<string, string[]> {
  return {
    '@app/*': [`${sourceRoot}/app/*`],
    '@pages/*': [`${sourceRoot}/pages/*`],
    '@widgets/*': [`${sourceRoot}/widgets/*`],
    '@features/*': [`${sourceRoot}/features/*`],
    '@entities/*': [`${sourceRoot}/entities/*`],
    '@shared/*': [`${sourceRoot}/shared/*`],
  };
}

/**
 * `ng add @solercia/ui` — scaffoldea el andamiaje FSD en un proyecto Angular
 * standalone recién creado (`ng new`): carpetas `pages/widgets/features/entities`
 * (con sus `index.ts` agregadores) + `shared/tokens` (adaptadores de los
 * puertos de `@solercia/ui`), path aliases en `tsconfig.json`, `provideTheme()`
 * cableado real en `app.config.ts`, `@solercia/eslint-config` referenciado y
 * Husky + lint-staged + commitlint.
 *
 * Alcance deliberado (ver `openspec/07-e9-extraccion-solercia-ui/design.md`,
 * Decisión A): `@solercia/ui` expone puertos (`THEME_SOURCE`, `SOL_TENANT_RESOLVER`,
 * `SOL_I18N`) con defaults null-object `providedIn: 'root'` — un proyecto recién
 * scaffoldeado YA renderiza con el tema por defecto de la librería sin wiring
 * adicional. `ng-add` deja los ADAPTADORES listos en `shared/tokens/` (con TODO)
 * para cuando el consumidor tenga backend/tenant real, en vez de inventar una
 * llamada HTTP falsa que rompería un `ng new` limpio.
 */
export function ngAdd(options: NgAddOptions): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    const projectName = await resolveProjectName(tree, options.project);
    const sourceRoot = await resolveSourceRoot(tree, options.project);

    const rules: Rule[] = [
      scaffoldFsdLayers(sourceRoot),
      scaffoldThemeAdapters(sourceRoot),
      wireTsconfigPaths(sourceRoot),
      appendGlobalStyles(sourceRoot, context),
      scaffoldEslintConfig(context),
      scaffoldHusky(context),
    ];

    // provideTheme() es la ÚNICA pieza que se puede cablear con seguridad vía
    // AST en CUALQUIER `ng new` estándar (import de paquete, sin rutas
    // relativas frágiles): activa el runtime de theming de @solercia/ui
    // (aplica SOL_DEFAULT_THEME de inmediato).
    if (projectName) {
      rules.push(
        addRootProvider(projectName, ({ code, external }) => {
          return code`${external('provideTheme', '@solercia/ui')}()`;
        }),
      );
    } else {
      context.logger.warn(
        '[@solercia/ui] No se encontró angular.json — se omite el cableado automático de ' +
          'provideTheme() en app.config.ts. Agrégalo a mano: providers: [provideTheme(), ...].',
      );
    }

    // Solo devDependencies que SÍ existen en un registry público — nunca
    // fuerces `npm install` contra un paquete inexistente (@solercia/eslint-config
    // no está publicado todavía, PR4). `addDependency` ya agenda su propia
    // NodePackageInstallTask (una sola, deduplicada) salvo `skipInstall`.
    const installBehavior = options.skipInstall ? InstallBehavior.None : InstallBehavior.Auto;
    return chain([
      ...rules,
      addDependency('husky', '^9.1.7', { type: DependencyType.Dev, install: installBehavior }),
      addDependency('lint-staged', '^17.0.8', { type: DependencyType.Dev, install: installBehavior }),
      addDependency('@commitlint/cli', '^21.2.1', { type: DependencyType.Dev, install: installBehavior }),
      addDependency('@commitlint/config-conventional', '^21.2.0', {
        type: DependencyType.Dev,
        install: installBehavior,
      }),
      // @solercia/eslint-config aún no está publicado (07-e9 PR4, bloqueado por
      // D1 del openspec madre): se documenta como pendiente en vez de forzar un
      // `npm install` que fallaría contra un paquete inexistente en el registry.
      (host: Tree, ctx: SchematicContext) => {
        ctx.logger.info(
          '[@solercia/ui] @solercia/eslint-config todavía no está publicado (PR4 pendiente). ' +
            'eslint.config.js quedó listo esperándolo — mientras tanto, referencia el preset por ' +
            'ruta relativa si tienes el monorepo clonado (ver packages/eslint-config/README.md).',
        );
        return host;
      },
    ]);
  };
}

/** Carpetas FSD con su `index.ts` agregador (vacío salvo el comentario de capa,
 * calcado de `src/{pages,widgets,features,entities}/index.ts` reales). `pages/`
 * NUNCA reexporta slices (lazy-loading por ruta) — las otras 3 capas sí. */
function scaffoldFsdLayers(sourceRoot: string): Rule {
  const layers: Array<{ name: string; comment: string }> = [
    { name: 'pages', comment: 'Pages layer — lazy-loaded route views' },
    { name: 'widgets', comment: 'Widgets layer — autonomous composed UI blocks' },
    { name: 'features', comment: 'Features layer — user actions with business value' },
    { name: 'entities', comment: 'Entities layer — domain models' },
  ];

  return (tree: Tree) => {
    for (const layer of layers) {
      const indexPath = `/${sourceRoot}/${layer.name}/index.ts`;
      if (!tree.exists(indexPath)) {
        tree.create(indexPath, `// ${layer.comment}\n`);
      }
    }
    return tree;
  };
}

/** Adaptadores mínimos de los puertos de `@solercia/ui` en `shared/tokens/`,
 * listos para activarse cuando exista backend/tenant real. */
function scaffoldThemeAdapters(sourceRoot: string): Rule {
  return (tree: Tree) => {
    const dir = `/${sourceRoot}/shared/tokens`;

    const themeSourcePath = `${dir}/app-theme-source.ts`;
    if (!tree.exists(themeSourcePath)) {
      tree.create(
        themeSourcePath,
        `import { Injectable } from '@angular/core';\n` +
          `import type { ThemeFile, ThemeSource } from '@solercia/ui';\n\n` +
          `/**\n` +
          ` * Adaptador de THEME_SOURCE (puerto de @solercia/ui). Por defecto no resuelve\n` +
          ` * tema por tenant (retorna null → se aplica SOL_DEFAULT_THEME). Reemplaza el\n` +
          ` * cuerpo de loadTheme() por tu llamada real (HTTP, storage, etc.) cuando exista\n` +
          ` * backend multi-tenant. Cablea en app.config.ts:\n` +
          ` *   { provide: THEME_SOURCE, useExisting: AppThemeSource }\n` +
          ` */\n` +
          `@Injectable({ providedIn: 'root' })\n` +
          `export class AppThemeSource implements ThemeSource {\n` +
          `  async loadTheme(_tenantId: number | string): Promise<ThemeFile | null> {\n` +
          `    return null;\n` +
          `  }\n` +
          `}\n`,
      );
    }

    const tenantResolverPath = `${dir}/app-tenant-resolver.ts`;
    if (!tree.exists(tenantResolverPath)) {
      tree.create(
        tenantResolverPath,
        `import { Injectable } from '@angular/core';\n` +
          `import type { SolTenantResolver } from '@solercia/ui';\n\n` +
          `/**\n` +
          ` * Adaptador de SOL_TENANT_RESOLVER (puerto de @solercia/ui). Por defecto no hay\n` +
          ` * tenant activo (tema único). Implementa tu resolución real (sesión, dominio,\n` +
          ` * slug) cuando exista multi-tenant. Cablea en app.config.ts:\n` +
          ` *   { provide: SOL_TENANT_RESOLVER, useExisting: AppTenantResolver }\n` +
          ` */\n` +
          `@Injectable({ providedIn: 'root' })\n` +
          `export class AppTenantResolver implements SolTenantResolver {\n` +
          `  activeTenantId(): number | null {\n` +
          `    return null;\n` +
          `  }\n` +
          `}\n`,
      );
    }

    const indexPath = `${dir}/index.ts`;
    if (!tree.exists(indexPath)) {
      tree.create(
        indexPath,
        `export { AppThemeSource } from './app-theme-source';\n` +
          `export { AppTenantResolver } from './app-tenant-resolver';\n`,
      );
    }

    return tree;
  };
}

/** Path aliases FSD en `tsconfig.json` (edición segura vía JSONC AST — tolera
 * comentarios/trailing commas, igual que el resto del tooling oficial Angular). */
function wireTsconfigPaths(sourceRoot: string): Rule {
  return (tree: Tree) => {
    const tsconfigPath = '/tsconfig.json';
    if (!tree.exists(tsconfigPath)) {
      return tree;
    }

    const json = new JSONFile(tree, tsconfigPath);
    for (const [alias, paths] of Object.entries(fsdPathAliases(sourceRoot))) {
      json.modify(['compilerOptions', 'paths', alias], paths);
    }
    return tree;
  };
}

/** Snippet de estilos globales que demuestra el consumo de los tokens `--sol-*`
 * (el resto de las 95 variables las emite ThemeService en runtime — ver
 * projects/solercia/ui/docs/THEMING.md). No falla si el proyecto no tiene
 * `styles.css` (p. ej. usa SCSS): solo avisa. */
function appendGlobalStyles(sourceRoot: string, context: SchematicContext): Rule {
  return (tree: Tree) => {
    const stylesPath = `/${sourceRoot}/styles.css`;
    if (!tree.exists(stylesPath)) {
      context.logger.warn(
        `[@solercia/ui] No se encontró "${stylesPath}" — agrega manualmente el snippet de ` +
          'tokens --sol-* a tu hoja de estilos global (ver projects/solercia/ui/docs/THEMING.md).',
      );
      return tree;
    }

    const marker = '/* @solercia/ui — tokens base */';
    const current = tree.read(stylesPath)?.toString('utf-8') ?? '';
    if (current.includes(marker)) {
      return tree;
    }

    const snippet =
      `\n${marker}\n` +
      `body {\n` +
      `  background: var(--sol-bg-page);\n` +
      `  color: var(--sol-color-text-primary);\n` +
      `  font-family: var(--sol-font-family);\n` +
      `}\n`;

    tree.overwrite(stylesPath, `${current}${snippet}`);
    return tree;
  };
}

/** `eslint.config.js` del consumidor, referenciando `@solercia/eslint-config`
 * (preset compartido — fronteras FSD, smart/dumb, Chart.js, naming-convention).
 * El `srcDir` por defecto del preset (`'src'`) ya coincide con el scaffold FSD
 * de este schematic. No sobrescribe uno existente (proyecto que ya trae su
 * propio lint). */
function scaffoldEslintConfig(context: SchematicContext): Rule {
  return (tree: Tree) => {
    const path = '/eslint.config.js';
    if (tree.exists(path)) {
      context.logger.info('[@solercia/ui] Ya existe "eslint.config.js" — se deja intacto.');
      return tree;
    }

    tree.create(
      path,
      `// @ts-check\n` +
        `// Generado por \`ng add @solercia/ui\`. @solercia/eslint-config trae las fronteras FSD\n` +
        `// (app → pages → widgets → features → entities → shared), la regla smart/dumb de\n` +
        `// shared/ui, la restricción de Chart.js y naming-convention/filename-case.\n` +
        `import solerciaConfig from '@solercia/eslint-config';\n\n` +
        `export default [\n` +
        `  { ignores: ['.angular/', 'dist/', 'coverage/', 'node_modules/'] },\n` +
        `  ...solerciaConfig,\n` +
        `];\n`,
    );
    return tree;
  };
}

/** Husky + lint-staged + commitlint, calcados 1:1 del cableado real de
 * `boki-front` (07-e9 PR2, T21): `pre-commit` → lint-staged (eslint --fix +
 * tsc --noEmit sobre staged); `commit-msg` → commitlint (conventional commits). */
function scaffoldHusky(context: SchematicContext): Rule {
  return (tree: Tree) => {
    if (!tree.exists('/.husky/pre-commit')) {
      tree.create('/.husky/pre-commit', 'npx lint-staged\n');
    }
    if (!tree.exists('/.husky/commit-msg')) {
      tree.create('/.husky/commit-msg', 'npx --no -- commitlint --edit "$1"\n');
    }
    if (!tree.exists('/commitlint.config.js')) {
      tree.create(
        '/commitlint.config.js',
        `module.exports = {\n  extends: ['@commitlint/config-conventional'],\n};\n`,
      );
    }
    if (!tree.exists('/lint-staged.config.js')) {
      tree.create(
        '/lint-staged.config.js',
        `// tsc --noEmit corre UNA vez contra todo el proyecto (no archivo por archivo):\n` +
          `// TypeScript necesita el grafo completo para chequear tipos correctamente.\n` +
          `module.exports = {\n` +
          `  '*.ts': [\n` +
          `    'eslint --fix',\n` +
          `    () => 'tsc -p tsconfig.app.json --noEmit',\n` +
          `  ],\n` +
          `};\n`,
      );
    }

    if (tree.exists('/package.json')) {
      const pkg = new JSONFile(tree, '/package.json');
      if (pkg.get(['scripts', 'prepare']) === undefined) {
        pkg.modify(['scripts', 'prepare'], 'husky');
      }
    }

    context.logger.info(
      '[@solercia/ui] Husky scaffoldeado. Ejecuta `npm run prepare` (o `npx husky`) una vez ' +
        'instaladas las dependencias para activar los hooks de git.',
    );
    return tree;
  };
}

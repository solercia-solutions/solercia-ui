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

/** Alias FSD fijos del ecosistema Solercia (CONVENCIONES-FRONT-SOLERCIA.md).
 * Prefijo `./` explícito (fix TS5090): un `tsconfig.json` de `ng new` NO
 * define `baseUrl`, así que una entrada de `paths` sin `./` (p. ej.
 * `"src/pages/*"`) queda ambigua para el compilador y falla con
 * `TS5090 (non-relative paths are not allowed when 'baseUrl' is not set)`. */
function fsdPathAliases(sourceRoot: string): Record<string, string[]> {
  return {
    '@app/*': [`./${sourceRoot}/app/*`],
    '@pages/*': [`./${sourceRoot}/pages/*`],
    '@widgets/*': [`./${sourceRoot}/widgets/*`],
    '@features/*': [`./${sourceRoot}/features/*`],
    '@entities/*': [`./${sourceRoot}/entities/*`],
    '@shared/*': [`./${sourceRoot}/shared/*`],
  };
}

/**
 * `ng add @solercia/ui` — scaffoldea el andamiaje FSD en un proyecto Angular
 * standalone recién creado (`ng new`): carpetas `pages/widgets/features/entities`
 * (con sus `index.ts` agregadores) + `shared/tokens` (adaptadores de los
 * puertos de theming/tenant de `@solercia/ui`) + `shared/i18n` (adaptador del
 * puerto `SOL_I18N`, consumido también por los schematics `page/feature/widget`),
 * path aliases en `tsconfig.json`, `provideTheme()` cableado real en
 * `app.config.ts`, `@solercia/eslint-config` instalada como `devDependency` y
 * Husky + lint-staged + commitlint.
 *
 * Alcance deliberado (ver `openspec/07-e9-extraccion-solercia-ui/design.md`,
 * Decisión A): `@solercia/ui` expone puertos (`THEME_SOURCE`, `SOL_TENANT_RESOLVER`,
 * `SOL_I18N`) con defaults null-object `providedIn: 'root'` — un proyecto recién
 * scaffoldeado YA renderiza con el tema por defecto de la librería sin wiring
 * adicional. `ng-add` deja los ADAPTADORES listos en `shared/tokens/` y
 * `shared/i18n/` (con TODO) para cuando el consumidor tenga backend/tenant/motor
 * i18n real, en vez de inventar una llamada HTTP falsa que rompería un `ng new`
 * limpio.
 */
export function ngAdd(options: NgAddOptions): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    const projectName = await resolveProjectName(tree, options.project);
    const sourceRoot = await resolveSourceRoot(tree, options.project);

    const rules: Rule[] = [
      scaffoldFsdLayers(sourceRoot),
      scaffoldThemeAdapters(sourceRoot),
      scaffoldI18nAdapter(sourceRoot),
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

    // devDependencies que SÍ existen en un registry público — `addDependency`
    // ya agenda su propia NodePackageInstallTask (una sola, deduplicada) salvo
    // `skipInstall`. `@solercia/eslint-config` está publicado desde 0.1.1 (npm
    // público) y es el preset que referencia el `eslint.config.{js,mjs}`
    // scaffoldeado por `scaffoldEslintConfig`.
    const installBehavior = options.skipInstall ? InstallBehavior.None : InstallBehavior.Auto;
    return chain([
      ...rules,
      addDependency('@solercia/eslint-config', '^0.1.1', {
        type: DependencyType.Dev,
        install: installBehavior,
      }),
      addDependency('husky', '^9.1.7', { type: DependencyType.Dev, install: installBehavior }),
      addDependency('lint-staged', '^17.0.8', { type: DependencyType.Dev, install: installBehavior }),
      addDependency('@commitlint/cli', '^21.2.1', { type: DependencyType.Dev, install: installBehavior }),
      addDependency('@commitlint/config-conventional', '^21.2.0', {
        type: DependencyType.Dev,
        install: installBehavior,
      }),
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

/** Adaptador mínimo de `SOL_I18N` (puerto de `@solercia/ui`) en `shared/i18n/`.
 * Fix TS2571: los schematics `page`/`feature`/`widget` de esta misma colección
 * generan código que importa `I18nService` desde `@shared/i18n` — sin esta capa
 * el proyecto horneado por el starter no compila. Por defecto es una identidad
 * (retorna la clave sin traducir), igual que `createIdentitySolI18n()` de la
 * librería; el consumidor reemplaza el cuerpo por su motor real (Transloco,
 * ngx-translate, `@angular/localize`) cuando lo tenga — ver
 * projects/solercia/ui/docs/I18N.md. */
function scaffoldI18nAdapter(sourceRoot: string): Rule {
  return (tree: Tree) => {
    const dir = `/${sourceRoot}/shared/i18n`;

    const servicePath = `${dir}/i18n.service.ts`;
    if (!tree.exists(servicePath)) {
      tree.create(
        servicePath,
        `import { Injectable, Signal, signal } from '@angular/core';\n` +
          `import type { SolI18n } from '@solercia/ui';\n\n` +
          `/**\n` +
          ` * Adaptador de SOL_I18N (puerto de @solercia/ui), consumido también por los\n` +
          ` * componentes que generan los schematics \`page\`/\`feature\`/\`widget\` de esta\n` +
          ` * misma colección (\`inject(I18nService)\`). Por defecto es una identidad\n` +
          ` * (retorna la clave sin traducir) — reemplaza el cuerpo por tu motor real\n` +
          ` * (Transloco, ngx-translate, @angular/localize) cuando el proyecto lo tenga.\n` +
          ` * Para que los propios componentes de @solercia/ui usen el mismo motor,\n` +
          ` * cablea en app.config.ts:\n` +
          ` *   { provide: SOL_I18N, useExisting: I18nService }\n` +
          ` * (ver projects/solercia/ui/docs/I18N.md del monorepo).\n` +
          ` */\n` +
          `@Injectable({ providedIn: 'root' })\n` +
          `export class I18nService implements SolI18n {\n` +
          `  readonly activeLang: Signal<string> = signal('es-CO');\n\n` +
          `  translate(key: string, _params?: Record<string, unknown>): string {\n` +
          `    return key;\n` +
          `  }\n\n` +
          `  t(key: string, _params?: Record<string, unknown>): Signal<string> {\n` +
          `    return signal(key);\n` +
          `  }\n\n` +
          `  tMany(keys: string[]): Signal<string[]> {\n` +
          `    return signal(keys);\n` +
          `  }\n` +
          `}\n`,
      );
    }

    const indexPath = `${dir}/index.ts`;
    if (!tree.exists(indexPath)) {
      tree.create(indexPath, `export { I18nService } from './i18n.service';\n`);
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
 * projects/solercia/ui/docs/THEMING.md). Detecta tanto `styles.css` como
 * `styles.scss` (fix: `ng new --style=scss` dejaba los tokens sin inyectar
 * porque solo se comprobaba `styles.css`); el snippet usa comentarios estilo
 * CSS de bloque, válidos también en SCSS. Si el proyecto no tiene ninguno de
 * los dos archivos, solo avisa. */
function appendGlobalStyles(sourceRoot: string, context: SchematicContext): Rule {
  return (tree: Tree) => {
    const candidates = [`/${sourceRoot}/styles.css`, `/${sourceRoot}/styles.scss`];
    const stylesPath = candidates.find((candidate) => tree.exists(candidate));
    if (!stylesPath) {
      context.logger.warn(
        `[@solercia/ui] No se encontró "${candidates[0]}" ni "${candidates[1]}" — agrega ` +
          'manualmente el snippet de tokens --sol-* a tu hoja de estilos global (ver ' +
          'projects/solercia/ui/docs/THEMING.md).',
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

/** `true` cuando el `package.json` del anfitrión declara `"type": "module"`. */
function packageDeclaresEsm(tree: Tree): boolean {
  if (!tree.exists('/package.json')) {
    return false;
  }
  const pkg = new JSONFile(tree, '/package.json');
  return pkg.get(['type']) === 'module';
}

/** `eslint.config.{js,mjs}` del consumidor, referenciando `@solercia/eslint-config`
 * (preset compartido — fronteras FSD, smart/dumb, Chart.js, naming-convention).
 * El `srcDir` por defecto del preset (`'src'`) ya coincide con el scaffold FSD
 * de este schematic. No sobrescribe uno existente (proyecto que ya trae su
 * propio lint, en cualquiera de las dos extensiones).
 *
 * Fix ESM: el preset se importa con `import ... from` (sintaxis ESM). Un
 * `package.json` de `ng new` NO declara `"type": "module"` por defecto, así
 * que Node interpreta `eslint.config.js` como CommonJS y falla con
 * `ERR_REQUIRE_ESM` al resolver el `import`. En vez de forzar `type: module`
 * en `package.json` (rompería los `module.exports` de `commitlint.config.js`/
 * `lint-staged.config.js` que scaffoldea `scaffoldHusky`), se emite el archivo
 * como `.mjs` cuando el proyecto no es ya ESM. */
function scaffoldEslintConfig(context: SchematicContext): Rule {
  return (tree: Tree) => {
    const jsPath = '/eslint.config.js';
    const mjsPath = '/eslint.config.mjs';
    if (tree.exists(jsPath) || tree.exists(mjsPath)) {
      context.logger.info('[@solercia/ui] Ya existe un "eslint.config.{js,mjs}" — se deja intacto.');
      return tree;
    }

    const targetPath = packageDeclaresEsm(tree) ? jsPath : mjsPath;
    tree.create(
      targetPath,
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
 * tsc --noEmit sobre staged); `commit-msg` → commitlint (conventional commits).
 *
 * Fix ESM (coherente con `scaffoldEslintConfig`): ambos configs usan sintaxis
 * CommonJS (`module.exports`). Si el `package.json` anfitrión declara
 * `"type": "module"`, Node interpreta cualquier `.js` como ESM y `module` deja
 * de existir en ese scope (`ReferenceError: module is not defined in ES
 * module scope`), reventando los hooks de Husky. commitlint y lint-staged
 * soportan `.cjs` explícito para forzar CommonJS sin tocar el contenido — se
 * usa esa extensión cuando el host ya es ESM; en caso contrario se mantiene
 * `.js` (comportamiento previo, sin cambios para el caso por defecto). */
function scaffoldHusky(context: SchematicContext): Rule {
  return (tree: Tree) => {
    const commonJsExt = packageDeclaresEsm(tree) ? 'cjs' : 'js';

    if (!tree.exists('/.husky/pre-commit')) {
      tree.create('/.husky/pre-commit', 'npx lint-staged\n');
    }
    if (!tree.exists('/.husky/commit-msg')) {
      tree.create('/.husky/commit-msg', 'npx --no -- commitlint --edit "$1"\n');
    }

    const commitlintPath = `/commitlint.config.${commonJsExt}`;
    if (!tree.exists('/commitlint.config.js') && !tree.exists('/commitlint.config.cjs')) {
      tree.create(
        commitlintPath,
        `module.exports = {\n  extends: ['@commitlint/config-conventional'],\n};\n`,
      );
    }

    const lintStagedPath = `/lint-staged.config.${commonJsExt}`;
    if (!tree.exists('/lint-staged.config.js') && !tree.exists('/lint-staged.config.cjs')) {
      tree.create(
        lintStagedPath,
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

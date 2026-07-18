import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';
import { describe, it, expect, beforeAll } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const collectionPath = join(here, '..', '..', '..', '..', '..', 'dist', 'solercia', 'ui', 'schematics', 'collection.json');

/**
 * Fixture mínima pero REALISTA de un `ng new` standalone (Angular 22, sin
 * NgModules): el mismo layout `src/app/{main.ts,app.config.ts}` +
 * `angular.json` con el builder `@angular/build:application` que usa
 * `boki-front` de verdad. Es lo que necesita `addRootProvider` (utilidad
 * OFICIAL de `@schematics/angular`) para localizar el `ApplicationConfig` y
 * cablear `provideTheme()` de forma segura (AST, no texto).
 */
/**
 * `style: 'css' | 'scss'` conmuta el archivo de estilos globales generado por
 * `ng new --style=<style>` (por defecto `css`) — usado por el caso de la
 * fixture SCSS (fix `appendGlobalStyles`).
 */
function ngNewFixtureTree(style: 'css' | 'scss' = 'css'): Tree {
  const tree = Tree.empty();

  tree.create(
    '/angular.json',
    JSON.stringify(
      {
        $schema: './node_modules/@angular/cli/lib/config/schema.json',
        version: 1,
        newProjectRoot: 'projects',
        projects: {
          demo: {
            projectType: 'application',
            root: '',
            sourceRoot: 'src',
            prefix: 'app',
            architect: {
              build: {
                builder: '@angular/build:application',
                options: {
                  outputPath: 'dist/demo',
                  index: 'src/index.html',
                  browser: 'src/main.ts',
                  tsConfig: 'tsconfig.app.json',
                  polyfills: ['zone.js'],
                  styles: [`src/styles.${style}`],
                },
              },
            },
          },
        },
      },
      null,
      2,
    ),
  );

  tree.create('/package.json', JSON.stringify({ name: 'demo', version: '0.0.0', dependencies: {}, devDependencies: {} }, null, 2));

  // `ng new` (Angular 22) NO declara `baseUrl` en el `tsconfig.json` raíz —
  // reproduce fielmente el escenario real del fix TS5090 (los `paths` deben
  // llevar `./` explícito, sin depender de una resolución implícita).
  tree.create(
    '/tsconfig.json',
    JSON.stringify({ compilerOptions: { paths: {}, moduleResolution: 'bundler', target: 'ES2022' } }, null, 2),
  );

  tree.create(
    '/tsconfig.app.json',
    JSON.stringify({ extends: './tsconfig.json', include: ['src/**/*.ts'] }, null, 2),
  );

  tree.create(
    '/src/main.ts',
    `import { bootstrapApplication } from '@angular/platform-browser';\n` +
      `import { appConfig } from './app/app.config';\n` +
      `import { App } from './app/app';\n\n` +
      `bootstrapApplication(App, appConfig).catch((err) => console.error(err));\n`,
  );

  tree.create(
    '/src/app/app.config.ts',
    `import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';\n` +
      `import { provideRouter } from '@angular/router';\n` +
      `import { routes } from './app.routes';\n\n` +
      `export const appConfig: ApplicationConfig = {\n` +
      `  providers: [provideZoneChangeDetection(), provideRouter(routes)],\n` +
      `};\n`,
  );

  tree.create('/src/app/app.routes.ts', `import { Routes } from '@angular/router';\n\nexport const routes: Routes = [];\n`);
  tree.create('/src/app/app.ts', `export class App {}\n`);
  tree.create(`/src/styles.${style}`, `/* global styles */\n`);

  return tree;
}

describe('schematic: ng-add', () => {
  let runner: SchematicTestRunner;

  beforeAll(() => {
    runner = new SchematicTestRunner('@solercia/ui', collectionPath);
  });

  it('cablea provideTheme() en app.config.ts (AST, no texto crudo)', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    const appConfig = tree.readContent('/src/app/app.config.ts');
    expect(appConfig).toContain("import { provideTheme } from '@solercia/ui';");
    expect(appConfig).toMatch(/providers:\s*\[[^\]]*provideTheme\(\)/s);
  });

  it('scaffoldea las 4 capas FSD con index.ts (pages/widgets/features/entities)', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    expect(tree.files).toContain('/src/pages/index.ts');
    expect(tree.files).toContain('/src/widgets/index.ts');
    expect(tree.files).toContain('/src/features/index.ts');
    expect(tree.files).toContain('/src/entities/index.ts');
    expect(tree.readContent('/src/pages/index.ts')).toContain('Pages layer');
  });

  it('scaffoldea los adaptadores de los puertos en shared/tokens/', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    expect(tree.files).toContain('/src/shared/tokens/app-theme-source.ts');
    expect(tree.files).toContain('/src/shared/tokens/app-tenant-resolver.ts');
    expect(tree.files).toContain('/src/shared/tokens/index.ts');

    const themeSource = tree.readContent('/src/shared/tokens/app-theme-source.ts');
    expect(themeSource).toContain('export class AppThemeSource implements ThemeSource');
    expect(themeSource).toContain("import type { ThemeFile, ThemeSource } from '@solercia/ui';");
  });

  it('[fix TS5090] agrega los path aliases FSD en tsconfig.json con prefijo "./" (sin depender de baseUrl)', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    const tsconfig = JSON.parse(tree.readContent('/tsconfig.json'));
    expect(tsconfig.compilerOptions.paths['@pages/*']).toEqual(['./src/pages/*']);
    expect(tsconfig.compilerOptions.paths['@widgets/*']).toEqual(['./src/widgets/*']);
    expect(tsconfig.compilerOptions.paths['@features/*']).toEqual(['./src/features/*']);
    expect(tsconfig.compilerOptions.paths['@entities/*']).toEqual(['./src/entities/*']);
    expect(tsconfig.compilerOptions.paths['@shared/*']).toEqual(['./src/shared/*']);
    expect(tsconfig.compilerOptions.paths['@app/*']).toEqual(['./src/app/*']);

    // ningún alias generado depende de baseUrl (que la fixture, fiel a
    // `ng new` real, no declara) — TS5090 solo se dispara con rutas sin `./`.
    for (const paths of Object.values<string[]>(tsconfig.compilerOptions.paths)) {
      for (const path of paths) {
        expect(path.startsWith('./')).toBe(true);
      }
    }
  });

  it('[fix eslint ESM] emite eslint.config.mjs cuando el package.json anfitrión no declara "type":"module" (evita ERR_REQUIRE_ESM)', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    expect(tree.files).toContain('/eslint.config.mjs');
    expect(tree.files).not.toContain('/eslint.config.js');
    expect(tree.readContent('/eslint.config.mjs')).toContain("import solerciaConfig from '@solercia/eslint-config';");
  });

  it('emite eslint.config.js (no .mjs) cuando el package.json ya declara "type":"module"', async () => {
    const tree = ngNewFixtureTree();
    const pkg = JSON.parse(tree.read('/package.json')?.toString('utf-8') ?? '{}');
    tree.overwrite('/package.json', JSON.stringify({ ...pkg, type: 'module' }, null, 2));

    const result = await runner.runSchematic('ng-add', {}, tree);
    expect(result.files).toContain('/eslint.config.js');
    expect(result.files).not.toContain('/eslint.config.mjs');
  });

  it('no pisa un eslint.config.js ya existente (ni crea uno .mjs duplicado)', async () => {
    const tree = ngNewFixtureTree();
    tree.create('/eslint.config.js', '// mi config propia\n');
    const result = await runner.runSchematic('ng-add', {}, tree);
    expect(result.readContent('/eslint.config.js')).toBe('// mi config propia\n');
    expect(result.files).not.toContain('/eslint.config.mjs');
  });

  it('[fix eslint-config] agrega @solercia/eslint-config como devDependency con versión válida', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    const pkg = JSON.parse(tree.readContent('/package.json'));
    expect(pkg.devDependencies['@solercia/eslint-config']).toBe('^0.1.1');
  });

  it('[fix @shared/i18n] scaffoldea shared/i18n/ con I18nService (evita TS2571 en page/feature/widget generados)', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    expect(tree.files).toContain('/src/shared/i18n/i18n.service.ts');
    expect(tree.files).toContain('/src/shared/i18n/index.ts');

    const service = tree.readContent('/src/shared/i18n/i18n.service.ts');
    expect(service).toContain('export class I18nService implements SolI18n');
    expect(service).toContain("import type { SolI18n } from '@solercia/ui';");
    expect(tree.readContent('/src/shared/i18n/index.ts')).toContain(
      "export { I18nService } from './i18n.service';",
    );
  });

  it('scaffoldea Husky + lint-staged + commitlint', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    expect(tree.files).toContain('/.husky/pre-commit');
    expect(tree.files).toContain('/.husky/commit-msg');
    expect(tree.files).toContain('/commitlint.config.js');
    expect(tree.files).toContain('/lint-staged.config.js');
    expect(tree.readContent('/.husky/pre-commit')).toContain('lint-staged');
    expect(tree.readContent('/.husky/commit-msg')).toContain('commitlint');

    const pkg = JSON.parse(tree.readContent('/package.json'));
    expect(pkg.scripts.prepare).toBe('husky');
  });

  it('[fix Husky ESM] emite commitlint.config.cjs y lint-staged.config.cjs (no .js) cuando el package.json declara "type":"module"', async () => {
    const tree = ngNewFixtureTree();
    const pkg = JSON.parse(tree.read('/package.json')?.toString('utf-8') ?? '{}');
    tree.overwrite('/package.json', JSON.stringify({ ...pkg, type: 'module' }, null, 2));

    const result = await runner.runSchematic('ng-add', {}, tree);
    expect(result.files).toContain('/commitlint.config.cjs');
    expect(result.files).toContain('/lint-staged.config.cjs');
    expect(result.files).not.toContain('/commitlint.config.js');
    expect(result.files).not.toContain('/lint-staged.config.js');

    // el contenido CommonJS (module.exports) se conserva sin cambios, solo
    // cambia la extensión — evita ReferenceError: module is not defined.
    expect(result.readContent('/commitlint.config.cjs')).toContain('module.exports');
    expect(result.readContent('/lint-staged.config.cjs')).toContain('module.exports');
  });

  it('agrega el snippet de tokens --sol-* a styles.css sin duplicarlo', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    const styles = tree.readContent('/src/styles.css');
    expect(styles).toContain('var(--sol-bg-page)');

    const secondRun = await runner.runSchematic('ng-add', {}, tree);
    const stylesAgain = secondRun.readContent('/src/styles.css');
    const occurrences = stylesAgain.split('/* @solercia/ui — tokens base */').length - 1;
    expect(occurrences).toBe(1);
  });

  it('appendGlobalStyles no falla y deja el árbol de estilos intacto cuando el proyecto no tiene styles.css ni styles.scss', async () => {
    const tree = ngNewFixtureTree();
    tree.delete('/src/styles.css');

    const warnings: string[] = [];
    const subscription = runner.logger.subscribe((entry) => {
      if (entry.level === 'warn') {
        warnings.push(entry.message);
      }
    });

    let result: UnitTestTree;
    try {
      result = await runner.runSchematic('ng-add', {}, tree);
    } finally {
      subscription.unsubscribe();
    }

    // el schematic no revienta: sigue produciendo el resto del andamiaje FSD.
    expect(result.files).toContain('/src/pages/index.ts');
    // no crea ni "adivina" ningún archivo de estilos.
    expect(result.files).not.toContain('/src/styles.css');
    expect(result.files).not.toContain('/src/styles.scss');
    // avisa por el logger en vez de fallar silenciosamente.
    expect(warnings.some((message) => message.includes('styles.css') && message.includes('styles.scss'))).toBe(
      true,
    );
  });

  it('[fix styles.scss] agrega el snippet de tokens --sol-* a styles.scss cuando el proyecto usa --style=scss', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree('scss'));
    expect(tree.files).not.toContain('/src/styles.css');
    expect(tree.files).toContain('/src/styles.scss');

    const styles = tree.readContent('/src/styles.scss');
    expect(styles).toContain('var(--sol-bg-page)');

    const secondRun = await runner.runSchematic('ng-add', {}, tree);
    const stylesAgain = secondRun.readContent('/src/styles.scss');
    const occurrences = stylesAgain.split('/* @solercia/ui — tokens base */').length - 1;
    expect(occurrences).toBe(1);
  });
});

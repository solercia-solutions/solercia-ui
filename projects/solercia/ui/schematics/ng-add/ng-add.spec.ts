import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
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
function ngNewFixtureTree(): Tree {
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
                  styles: ['src/styles.css'],
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

  tree.create(
    '/tsconfig.json',
    JSON.stringify(
      { compilerOptions: { baseUrl: '.', paths: {}, moduleResolution: 'bundler', target: 'ES2022' } },
      null,
      2,
    ),
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
  tree.create('/src/styles.css', `/* global styles */\n`);

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

  it('agrega los path aliases FSD en tsconfig.json', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    const tsconfig = JSON.parse(tree.readContent('/tsconfig.json'));
    expect(tsconfig.compilerOptions.paths['@pages/*']).toEqual(['src/pages/*']);
    expect(tsconfig.compilerOptions.paths['@widgets/*']).toEqual(['src/widgets/*']);
    expect(tsconfig.compilerOptions.paths['@features/*']).toEqual(['src/features/*']);
    expect(tsconfig.compilerOptions.paths['@entities/*']).toEqual(['src/entities/*']);
    expect(tsconfig.compilerOptions.paths['@shared/*']).toEqual(['src/shared/*']);
    expect(tsconfig.compilerOptions.paths['@app/*']).toEqual(['src/app/*']);
  });

  it('crea eslint.config.js referenciando @solercia/eslint-config', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    expect(tree.files).toContain('/eslint.config.js');
    expect(tree.readContent('/eslint.config.js')).toContain("import solerciaConfig from '@solercia/eslint-config';");
  });

  it('no pisa un eslint.config.js ya existente', async () => {
    const tree = ngNewFixtureTree();
    tree.create('/eslint.config.js', '// mi config propia\n');
    const result = await runner.runSchematic('ng-add', {}, tree);
    expect(result.readContent('/eslint.config.js')).toBe('// mi config propia\n');
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

  it('agrega el snippet de tokens --sol-* a styles.css sin duplicarlo', async () => {
    const tree = await runner.runSchematic('ng-add', {}, ngNewFixtureTree());
    const styles = tree.readContent('/src/styles.css');
    expect(styles).toContain('var(--sol-bg-page)');

    const secondRun = await runner.runSchematic('ng-add', {}, tree);
    const stylesAgain = secondRun.readContent('/src/styles.css');
    const occurrences = stylesAgain.split('/* @solercia/ui — tokens base */').length - 1;
    expect(occurrences).toBe(1);
  });
});

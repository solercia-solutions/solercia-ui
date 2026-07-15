import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { describe, it, expect, beforeAll } from 'vitest';

/**
 * SchematicTestRunner corre contra la colección COMPILADA (`dist/solercia/ui/schematics`),
 * nunca contra el TS fuente — igual que el resto del ecosistema de schematics de Angular.
 * Requiere `npm run build:schematics` antes de `ng test @solercia/ui` (ver `test:schematics`
 * en el `package.json` raíz).
 */
const here = dirname(fileURLToPath(import.meta.url));
const collectionPath = join(here, '..', '..', '..', '..', '..', 'dist', 'solercia', 'ui', 'schematics', 'collection.json');

describe('schematic: page', () => {
  let runner: SchematicTestRunner;

  beforeAll(() => {
    runner = new SchematicTestRunner('@solercia/ui', collectionPath);
  });

  function emptyTree(): Tree {
    const tree = Tree.empty();
    tree.create(
      '/src/assets/i18n/es-CO.json',
      JSON.stringify({ shared: {}, pages: {}, features: {}, entities: {} }, null, 2),
    );
    return tree;
  }

  it('crea la page con selector sol-, standalone, OnPush y sin prefijo Sol en la clase', async () => {
    const tree = await runner.runSchematic('page', { name: 'catalog' }, emptyTree());

    expect(tree.files).toContain('/src/pages/catalog/ui/catalog-page.component.ts');
    expect(tree.files).toContain('/src/pages/catalog/catalog.routes.ts');
    expect(tree.files).toContain('/src/pages/catalog/index.ts');

    const component = tree.readContent('/src/pages/catalog/ui/catalog-page.component.ts');
    expect(component).toContain("selector: 'sol-catalog-page'");
    expect(component).toContain('standalone: true');
    expect(component).toContain('ChangeDetectionStrategy.OnPush');
    expect(component).toContain('export class CatalogPageComponent');
    expect(component).not.toContain('class SolCatalogPageComponent');
    expect(component).toContain("this.i18n.t('pages.catalog.title')");

    const routes = tree.readContent('/src/pages/catalog/catalog.routes.ts');
    expect(routes).toContain('export const catalogRoutes: Routes');
    expect(routes).toContain('CatalogPageComponent');

    const index = tree.readContent('/src/pages/catalog/index.ts');
    expect(index).toContain("export { CatalogPageComponent } from './ui/catalog-page.component';");
    expect(index).toContain("export { catalogRoutes } from './catalog.routes';");
  });

  it('dasheriza nombres multi-palabra (kebab-case en carpeta/selector, PascalCase en clase)', async () => {
    const tree = await runner.runSchematic('page', { name: 'onboardingStart' }, emptyTree());

    expect(tree.files).toContain('/src/pages/onboarding-start/ui/onboarding-start-page.component.ts');
    const component = tree.readContent('/src/pages/onboarding-start/ui/onboarding-start-page.component.ts');
    expect(component).toContain("selector: 'sol-onboarding-start-page'");
    expect(component).toContain('export class OnboardingStartPageComponent');
  });

  it('inserta la clave i18n pages.<name>.title en es-CO.json (idempotente)', async () => {
    const tree = await runner.runSchematic('page', { name: 'catalog' }, emptyTree());
    const i18n = JSON.parse(tree.readContent('/src/assets/i18n/es-CO.json'));
    expect(i18n.pages.catalog.title).toBe('Catalog');

    // Segunda corrida: no debe duplicar ni pisar un valor ya presente.
    const secondRun = await runner.runSchematic('page', { name: 'catalog' }, tree);
    const i18nAgain = JSON.parse(secondRun.readContent('/src/assets/i18n/es-CO.json'));
    expect(i18nAgain.pages.catalog.title).toBe('Catalog');
  });

  it('no toca pages/index.ts (sin agregador — lazy-loading por ruta)', async () => {
    const tree = emptyTree();
    tree.create('/src/pages/index.ts', '// Pages layer — lazy-loaded route views\n');

    const result = await runner.runSchematic('page', { name: 'catalog' }, tree);
    expect(result.readContent('/src/pages/index.ts')).toBe('// Pages layer — lazy-loaded route views\n');
  });

  it('falla con un mensaje claro si no se da nombre', async () => {
    await expect(runner.runSchematic('page', { name: '' }, emptyTree())).rejects.toThrow(/requiere un nombre/);
  });
});

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { describe, it, expect, beforeAll } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const collectionPath = join(here, '..', '..', '..', '..', '..', 'dist', 'solercia', 'ui', 'schematics', 'collection.json');

describe('schematic: feature', () => {
  let runner: SchematicTestRunner;

  beforeAll(() => {
    runner = new SchematicTestRunner('@solercia/ui', collectionPath);
  });

  function emptyTree(): Tree {
    const tree = Tree.empty();
    tree.create('/src/features/index.ts', '// Features layer — user actions with business value\n');
    tree.create(
      '/src/assets/i18n/es-CO.json',
      JSON.stringify({ shared: {}, pages: {}, features: {}, entities: {} }, null, 2),
    );
    return tree;
  }

  it('crea la feature standalone/OnPush con signals input()/output() y claves i18n', async () => {
    const tree = await runner.runSchematic('feature', { name: 'manage-tags' }, emptyTree());

    expect(tree.files).toContain('/src/features/manage-tags/ui/manage-tags.component.ts');
    expect(tree.files).toContain('/src/features/manage-tags/index.ts');

    const component = tree.readContent('/src/features/manage-tags/ui/manage-tags.component.ts');
    expect(component).toContain("selector: 'sol-manage-tags'");
    expect(component).toContain('standalone: true');
    expect(component).toContain('ChangeDetectionStrategy.OnPush');
    expect(component).toContain('export class ManageTagsComponent');
    expect(component).not.toContain('class SolManageTagsComponent');
    expect(component).toContain('readonly value = input<string>');
    expect(component).toContain('readonly changed = output<string>');
    expect(component).toContain("this.i18n.t('features.manageTags.title')");
  });

  it('actualiza (idempotente) el barrel agregador features/index.ts', async () => {
    const tree = await runner.runSchematic('feature', { name: 'manage-tags' }, emptyTree());
    const barrel = tree.readContent('/src/features/index.ts');
    expect(barrel).toContain("export { ManageTagsComponent } from './manage-tags';");

    const secondRun = await runner.runSchematic('feature', { name: 'manage-tags' }, tree);
    const barrelAgain = secondRun.readContent('/src/features/index.ts');
    const occurrences = barrelAgain.split("export { ManageTagsComponent } from './manage-tags';").length - 1;
    expect(occurrences).toBe(1);
  });

  it('el archivo generado no importa de @pages/* ni @widgets/* (frontera FSD de features)', async () => {
    const tree = await runner.runSchematic('feature', { name: 'manage-tags' }, emptyTree());
    const component = tree.readContent('/src/features/manage-tags/ui/manage-tags.component.ts');
    expect(component).not.toMatch(/@pages\//);
    expect(component).not.toMatch(/@widgets\//);
  });
});

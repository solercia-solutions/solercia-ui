import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { describe, it, expect, beforeAll } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const collectionPath = join(here, '..', '..', '..', '..', '..', 'dist', 'solercia', 'ui', 'schematics', 'collection.json');

describe('schematic: widget', () => {
  let runner: SchematicTestRunner;

  beforeAll(() => {
    runner = new SchematicTestRunner('@solercia/ui', collectionPath);
  });

  function emptyTree(): Tree {
    const tree = Tree.empty();
    tree.create('/src/widgets/index.ts', '// Widgets layer — autonomous composed UI blocks\n');
    tree.create(
      '/src/assets/i18n/es-CO.json',
      JSON.stringify({ shared: {}, pages: {}, widgets: {}, features: {}, entities: {} }, null, 2),
    );
    return tree;
  }

  it('crea el widget standalone/OnPush con signals y claves i18n propias (widgets.*)', async () => {
    const tree = await runner.runSchematic('widget', { name: 'stat-card' }, emptyTree());

    expect(tree.files).toContain('/src/widgets/stat-card/ui/stat-card.component.ts');
    expect(tree.files).toContain('/src/widgets/stat-card/index.ts');

    const component = tree.readContent('/src/widgets/stat-card/ui/stat-card.component.ts');
    expect(component).toContain("selector: 'sol-stat-card'");
    expect(component).toContain('standalone: true');
    expect(component).toContain('ChangeDetectionStrategy.OnPush');
    // Naming correcto: "Sol*" reservado a shared/ui — un widget generado NO
    // lo lleva (CONVENCIONES-FRONT-SOLERCIA §5 + solercia-schematics spec).
    expect(component).toContain('export class StatCardComponent');
    expect(component).not.toContain('class SolStatCardComponent');
    expect(component).toContain('readonly value = input<string>');
    expect(component).toContain('readonly activated = output<void>');
    expect(component).toContain("this.i18n.t('widgets.statCard.title')");
  });

  it('actualiza (idempotente) el barrel agregador widgets/index.ts', async () => {
    const tree = await runner.runSchematic('widget', { name: 'stat-card' }, emptyTree());
    expect(tree.readContent('/src/widgets/index.ts')).toContain(
      "export { StatCardComponent } from './stat-card';",
    );

    const secondRun = await runner.runSchematic('widget', { name: 'stat-card' }, tree);
    const barrelAgain = secondRun.readContent('/src/widgets/index.ts');
    const occurrences = barrelAgain.split("export { StatCardComponent } from './stat-card';").length - 1;
    expect(occurrences).toBe(1);
  });
});

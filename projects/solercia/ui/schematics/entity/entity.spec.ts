import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { describe, it, expect, beforeAll } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const collectionPath = join(here, '..', '..', '..', '..', '..', 'dist', 'solercia', 'ui', 'schematics', 'collection.json');

describe('schematic: entity', () => {
  let runner: SchematicTestRunner;

  beforeAll(() => {
    runner = new SchematicTestRunner('@solercia/ui', collectionPath);
  });

  function emptyTree(): Tree {
    const tree = Tree.empty();
    tree.create('/src/entities/index.ts', '// Entities layer — domain models\n');
    return tree;
  }

  it('crea model + api + index.ts (sin componentes — entities no tiene UI)', async () => {
    const tree = await runner.runSchematic('entity', { name: 'tag' }, emptyTree());

    expect(tree.files).toContain('/src/entities/tag/model/tag.model.ts');
    expect(tree.files).toContain('/src/entities/tag/api/tag-api.service.ts');
    expect(tree.files).toContain('/src/entities/tag/index.ts');
    expect(tree.files).not.toContain('/src/entities/tag/ui/tag.component.ts');

    const model = tree.readContent('/src/entities/tag/model/tag.model.ts');
    expect(model).toContain('export interface Tag {');
    expect(model).toContain('export interface CreateTagRequest {');

    const api = tree.readContent('/src/entities/tag/api/tag-api.service.ts');
    expect(api).toContain('export class TagApiService');
    expect(api).toContain('private baseUrl = `${APP_CONSTANTS.apiBaseUrl}/tags`');
    expect(api).toContain("import { APP_CONSTANTS } from '@shared/config'");

    const index = tree.readContent('/src/entities/tag/index.ts');
    expect(index).toContain("export type { Tag, CreateTagRequest } from './model/tag.model';");
    expect(index).toContain("export { TagApiService } from './api/tag-api.service';");
  });

  it('pluraliza el recurso REST de forma naive (faq -> faqs, category -> categories NO — documentado)', async () => {
    const tree = await runner.runSchematic('entity', { name: 'faq' }, emptyTree());
    const api = tree.readContent('/src/entities/faq/api/faq-api.service.ts');
    expect(api).toContain('/faqs');
  });

  it('actualiza (idempotente) el barrel agregador entities/index.ts', async () => {
    const tree = await runner.runSchematic('entity', { name: 'tag' }, emptyTree());
    const barrel = tree.readContent('/src/entities/index.ts');
    expect(barrel).toContain("export type { Tag, CreateTagRequest } from './tag';");
    expect(barrel).toContain("export { TagApiService } from './tag';");

    const secondRun = await runner.runSchematic('entity', { name: 'tag' }, tree);
    const barrelAgain = secondRun.readContent('/src/entities/index.ts');
    const occurrences = barrelAgain.split("export { TagApiService } from './tag';").length - 1;
    expect(occurrences).toBe(1);
  });
});

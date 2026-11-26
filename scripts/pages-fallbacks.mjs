// GitHub Pages has no SPA rewrites. It serves `/<path>` from `<path>.html`, so copying index.html to
// one `.html` file per route makes deep links (for example /docs/theming) answer 200 instead of
// going through 404.html. 404.html stays as the fallback for any other path.
//   node scripts/pages-fallbacks.mjs dist/showcase/browser
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ROOT } from './docs-lib.mjs';

const outDir = resolve(process.argv[2] ?? join(ROOT, 'dist/showcase/browser'));
const index = join(outDir, 'index.html');

const navigation = readFileSync(join(ROOT, 'projects/showcase/src/app/navigation.ts'), 'utf8');
const componentRoutes = [...navigation.matchAll(/path: '([^']+)'/g)].map((match) => match[1]);
const toc = JSON.parse(readFileSync(join(outDir, 'docs-content/toc.json'), 'utf8'));
const docsRoutes = ['docs', ...toc.chapters.map((chapter) => `docs/${chapter.slug}`)];

const routes = [...componentRoutes, ...docsRoutes];
for (const route of routes) {
  const target = join(outDir, `${route}.html`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(index, target);
}
copyFileSync(index, join(outDir, '404.html'));
console.log(`pages: ${routes.length} route entry points + 404.html in ${outDir}`);

// Renders docs/manual/*.md into the showcase "Guides" section:
//   projects/showcase/public/docs-content/<slug>.html  one HTML fragment per chapter
//   projects/showcase/public/docs-content/toc.json     table of contents (chapters and their h2/h3 headings)
//   projects/showcase/public/docs-content/assets/      images referenced by the chapters
// The output is generated (gitignored). Mermaid blocks stay as code and are drawn in the browser.
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ROOT, headingsOf, libraryVersion, loadChapters, renderChapter } from './docs-lib.mjs';

const OUT_DIR = join(ROOT, 'projects/showcase/public/docs-content');

const chapters = loadChapters();
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(OUT_DIR, 'assets'), { recursive: true });

const copied = new Map();
const assets = (repoPath) => {
  if (!copied.has(repoPath)) {
    const name = basename(repoPath);
    copyFileSync(join(ROOT, repoPath), join(OUT_DIR, 'assets', name));
    copied.set(repoPath, `docs-content/assets/${name}`);
  }
  return copied.get(repoPath);
};

for (const chapter of chapters) {
  const html = renderChapter(chapter, { mode: 'site', chapters, assets, withIds: false });
  writeFileSync(join(OUT_DIR, `${chapter.slug}.html`), html);
}

const toc = {
  version: libraryVersion(),
  chapters: chapters.map((chapter) => ({
    slug: chapter.slug,
    number: chapter.number,
    title: chapter.title,
    description: chapter.description,
    headings: headingsOf(chapter.body).filter((heading) => heading.depth === 2 || heading.depth === 3),
  })),
};
writeFileSync(join(OUT_DIR, 'toc.json'), `${JSON.stringify(toc, null, 2)}\n`);

console.log(`docs: ${chapters.length} chapters, ${copied.size} assets -> projects/showcase/public/docs-content/`);

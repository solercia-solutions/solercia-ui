// Concatenates docs/manual/*.md and the README component reference into llms-full.txt, the
// single-file manual for AI agents. Relative links become absolute repository URLs.
//   node scripts/build-llms-full.mjs          write llms-full.txt
//   node scripts/build-llms-full.mjs --check  exit 1 when llms-full.txt is out of date
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadChapters, readmeComponentReference, rewriteMarkdownLinks } from './docs-lib.mjs';

const TARGET = join(ROOT, 'llms-full.txt');

function build() {
  const chapters = loadChapters();
  const parts = [
    '# Solercia Design System: complete manual',
    '',
    '> Every chapter of the Solercia design-system manual (packages @solercia/ui, @solercia/eslint-config and',
    '> @solercia/chat) followed by the complete @solercia/ui component reference. Generated from',
    '> docs/manual/*.md and README.md by `npm run docs:llms`; do not edit by hand. Short index: llms.txt.',
    '',
    '## Chapters',
    '',
    ...chapters.map((chapter) => `- ${chapter.number} ${chapter.title}: ${chapter.description}`),
    '- Appendix: component reference (inputs, outputs, slots and examples of every component)',
  ];
  for (const chapter of chapters) {
    const body = rewriteMarkdownLinks(chapter.body, { fromPath: chapter.path, mode: 'github', chapters, current: chapter });
    parts.push('', '---', '', `<!-- chapter ${chapter.number}: ${chapter.path} -->`, '', body.trim());
  }
  const reference = rewriteMarkdownLinks(readmeComponentReference(), {
    fromPath: 'README.md',
    mode: 'github',
    chapters,
    current: { slug: 'readme' },
  });
  parts.push('', '---', '', '<!-- appendix: README.md, section "Component reference" -->', '', '# Appendix: component reference', '', reference.replace(/^## Component reference\n+/, ''));
  return `${parts.join('\n').trim()}\n`;
}

const content = build();
if (process.argv.includes('--check')) {
  const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
  if (current !== content) {
    console.error('llms-full.txt is out of date. Run `npm run docs:llms` and commit the result.');
    process.exit(1);
  }
  console.log('llms-full.txt is up to date.');
} else {
  writeFileSync(TARGET, content);
  console.log(`llms-full.txt: ${content.length} characters, ${content.split('\n').length} lines`);
}

// Shared helpers for the documentation build scripts (build-docs, build-llms-full, build-manual).
// Source of truth: docs/manual/NN-<slug>.md, each with a small front matter block.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MANUAL_DIR = join(ROOT, 'docs', 'manual');
export const REPO_URL = 'https://github.com/solercia-solutions/solercia-ui';
export const BLOB_URL = `${REPO_URL}/blob/main/`;
export const RAW_URL = 'https://raw.githubusercontent.com/solercia-solutions/solercia-ui/main/';
/** Public URL of the showcase (GitHub Pages). Links to it become internal links on the site. */
export const SITE_URL = 'https://solercia-solutions.github.io/solercia-ui/';

const IMAGE_EXTENSIONS = /\.(svg|png|jpe?g|webp|gif|avif)$/i;

export function libraryVersion() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'projects/solercia/ui/package.json'), 'utf8'));
  return pkg.version;
}

/** Parses a leading `---` block of `key: value` lines. */
export function parseFrontMatter(source) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return { data: {}, body: source };
  const data = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator > 0) data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { data, body: source.slice(match[0].length).replace(/^\n+/, '') };
}

/** Reads the chapters in file-name order. */
export function loadChapters() {
  const files = readdirSync(MANUAL_DIR)
    .filter((file) => /^\d{2}-.+\.md$/.test(file))
    .sort();
  const chapters = files.map((file) => {
    const { data, body } = parseFrontMatter(readFileSync(join(MANUAL_DIR, file), 'utf8'));
    const h1 = /^# (.+)$/m.exec(body);
    return {
      file,
      path: `docs/manual/${file}`,
      number: file.slice(0, 2),
      slug: data.slug || file.replace(/^\d{2}-/, '').replace(/\.md$/, ''),
      title: data.title || (h1 ? h1[1] : file),
      description: data.description || '',
      body,
    };
  });
  const slugs = new Set();
  for (const chapter of chapters) {
    if (slugs.has(chapter.slug)) throw new Error(`Duplicate chapter slug "${chapter.slug}"`);
    slugs.add(chapter.slug);
  }
  return chapters;
}

/** Plain text of inline Markdown (for heading ids and the table of contents). */
export function plainText(markdown) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_]/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/** GitHub-compatible heading slugger (lowercase, punctuation removed, spaces to hyphens, deduplicated). */
export function createSlugger() {
  const seen = new Map();
  return (text) => {
    const base = plainText(text)
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replace(/ /g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

/** Lines outside fenced code blocks, with their fence state. */
function* proseLines(body) {
  let fence = null;
  for (const line of body.split('\n')) {
    const marker = /^(```+|~~~+)/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (line.startsWith(fence)) fence = null;
      continue;
    }
    if (!fence) yield line;
  }
}

/** Every heading of a chapter in document order, with GitHub-compatible ids. */
export function headingsOf(body) {
  const slug = createSlugger();
  const headings = [];
  for (const line of proseLines(body)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) headings.push({ depth: match[1].length, text: plainText(match[2]), id: slug(match[2]) });
  }
  return headings;
}

/**
 * Resolves a link or image target written relative to `fromPath` (a repository-relative file).
 * Modes: `site` (showcase Guides pages), `github` (absolute repository URLs, used by llms-full.txt)
 * and `manual` (one HTML document; chapters become in-document anchors).
 */
export function resolveTarget(target, { fromPath, mode, chapters, current, assets }) {
  if (/^(https?:|mailto:)/.test(target)) {
    if (mode === 'site' && target.startsWith(SITE_URL)) return target.slice(SITE_URL.length) || './';
    return target;
  }
  const [pathPart, hash = ''] = target.split('#');
  const fragment = hash ? `#${hash}` : '';
  if (!pathPart) {
    if (mode === 'site') return `docs/${current.slug}${fragment}`;
    if (mode === 'manual') return `#${current.slug}--${hash}`;
    return `${BLOB_URL}${fromPath}${fragment}`;
  }
  const repoPath = posix.normalize(posix.join(posix.dirname(fromPath), pathPart));
  const chapter = chapters.find((item) => item.path === repoPath);
  if (chapter) {
    if (mode === 'site') return `docs/${chapter.slug}${fragment}`;
    if (mode === 'manual') return hash ? `#${chapter.slug}--${hash}` : `#${chapter.slug}`;
    return `${BLOB_URL}${repoPath}${fragment}`;
  }
  if (IMAGE_EXTENSIONS.test(repoPath)) {
    if (assets) return assets(repoPath);
    return `${RAW_URL}${repoPath}`;
  }
  return `${BLOB_URL}${repoPath}${fragment}`;
}

/** Rewrites Markdown link and image targets, and `src`/`href` attributes of raw HTML. */
export function rewriteMarkdownLinks(markdown, context) {
  let fence = null;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = /^(```+|~~~+)/.exec(line);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (line.startsWith(fence)) fence = null;
        return line;
      }
      if (fence) return line;
      return line
        .replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (_, open, target, close) => open + resolveTarget(target, context) + close)
        .replace(/\b(src|href)="([^"]+)"/g, (_, attribute, target) => `${attribute}="${resolveTarget(target, context)}"`);
    })
    .join('\n');
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Renders a chapter to an HTML fragment.
 * - `idPrefix` prefixes heading ids (the manual joins every chapter in one document).
 * - `withIds: false` omits `id` attributes (Angular's sanitizer strips them; the site assigns them at runtime).
 * - Mermaid blocks become `<pre class="mermaid-source"><code class="language-mermaid">`.
 */
export function renderChapter(chapter, { mode, chapters, assets, withIds = true, idPrefix = '' }) {
  const context = { fromPath: chapter.path, mode, chapters, current: chapter, assets };
  const markdown = rewriteMarkdownLinks(chapter.body, context);
  const slug = createSlugger();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }) {
        const id = slug(text);
        const inner = this.parser.parseInline(tokens);
        if (depth === 1) return `<h1${withIds ? ` id="${idPrefix}${id}"` : ''}>${inner}</h1>\n`;
        const href = mode === 'site' ? `docs/${chapter.slug}#${id}` : `#${idPrefix}${id}`;
        const anchor = depth <= 3 ? `<a class="docs-anchor" href="${href}" aria-label="Link to this section">#</a>` : '';
        return `<h${depth}${withIds ? ` id="${idPrefix}${id}"` : ''}>${inner}${anchor}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const language = (lang || '').split(/\s/)[0];
        if (language === 'mermaid') {
          return `<pre class="mermaid-source"><code class="language-mermaid">${escapeHtml(text)}</code></pre>\n`;
        }
        const label = language ? ` data-lang="${escapeHtml(language)}"` : '';
        const className = language ? ` class="language-${escapeHtml(language)}"` : '';
        return `<pre${mode === 'site' ? '' : label}><code${className}>${escapeHtml(text)}</code></pre>\n`;
      },
      checkbox({ checked }) {
        return `<span class="docs-task${checked ? ' docs-task--done' : ''}" aria-hidden="true"></span> `;
      },
    },
  });
  return marked.parse(markdown);
}

/** The README "Component reference" section (appended to llms-full.txt). */
export function readmeComponentReference() {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const start = readme.indexOf('\n## Component reference');
  const end = readme.indexOf('\n## Showcase', start);
  if (start < 0 || end < 0) throw new Error('README.md: "Component reference" section not found');
  return readme.slice(start + 1, end).trim();
}

// Builds the printable manual from docs/manual/*.md:
//   dist/manual/solercia-design-system.pdf   cover, table of contents with page numbers, numbered pages
//   dist/manual/solercia-design-system.docx  cover, Word table of contents, numbered pages
//
// Local tool, not part of CI. Prerequisites (none of them is a repository dependency):
//   - playwright-core with a downloaded Chromium (`npx playwright install chromium`). The script looks
//     for it in PLAYWRIGHT_CORE (path to the playwright-core package folder), then in node_modules,
//     then in the npx cache (~/.npm/_npx/*/node_modules/playwright-core).
//   - Pandoc 3 for the .docx (skipped with a warning when missing).
//   - Poppler (pdftotext, pdfunite) for TOC page numbers and an unnumbered cover (optional).
//   - zip and unzip for the Word page-number footer (optional).
// Usage: npm run docs:manual
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BLOB_URL,
  ROOT,
  SITE_URL,
  libraryVersion,
  loadChapters,
  renderChapter,
  rewriteMarkdownLinks,
} from './docs-lib.mjs';

const OUT_DIR = join(ROOT, 'dist', 'manual');
const BASENAME = 'solercia-design-system';
const VERSION = libraryVersion();
const DATE = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const LOGO_SVG = readFileSync(join(ROOT, '.github/assets/solercia-mark.svg'), 'utf8');
const MERMAID_JS = join(ROOT, 'node_modules/mermaid/dist/mermaid.min.js');
const TITLE = 'Solercia Design System';
const SUBTITLE = 'Manual for @solercia/ui, @solercia/eslint-config and @solercia/chat';

const has = (command) => spawnSync('which', [command], { stdio: 'ignore' }).status === 0;

async function loadPlaywright() {
  const candidates = [];
  if (process.env.PLAYWRIGHT_CORE) candidates.push(process.env.PLAYWRIGHT_CORE);
  candidates.push(join(ROOT, 'node_modules/playwright-core'));
  const npxCache = join(homedir(), '.npm/_npx');
  if (existsSync(npxCache)) {
    for (const entry of readdirSync(npxCache)) candidates.push(join(npxCache, entry, 'node_modules/playwright-core'));
  }
  for (const candidate of candidates) {
    const entry = join(candidate, 'index.mjs');
    if (existsSync(entry)) return import(pathToFileURL(entry).href);
  }
  throw new Error('playwright-core not found. Set PLAYWRIGHT_CORE to its package folder (see the header of this script).');
}

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STYLES = `
  @page { size: A4; margin: 20mm 18mm 22mm; }
  * { box-sizing: border-box; }
  html { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1e293b; }
  body { margin: 0; line-height: 1.55; }
  a { color: #0b7f8e; text-decoration: none; }
  code { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 0.86em; background: #f1f5f9; padding: 0 3px; border-radius: 3px; }
  pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 8.2pt; line-height: 1.45; }
  h1, h2, h3 { color: #0f172a; break-after: avoid; line-height: 1.25; }
  h1 { font-size: 24pt; margin: 0 0 14pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; padding-top: 8pt; border-top: 1px solid #e2e8f0; }
  h3 { font-size: 11.5pt; margin: 14pt 0 4pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 8.8pt; break-inside: auto; }
  tr { break-inside: avoid; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { color: #475569; background: #f8fafc; }
  blockquote { margin: 8pt 0; padding: 6pt 10pt; border-left: 3px solid #10c1d6; background: #f0fdfa; }
  img { max-width: 100%; }
  ul, ol { padding-left: 18pt; }
  li:has(> .docs-task) { list-style: none; }
  .docs-task { display: inline-block; width: 9pt; height: 9pt; margin: 0 4pt 0 -14pt; border: 1px solid #64748b; border-radius: 2px; vertical-align: -1pt; }
  .docs-anchor { display: none; }
  .mermaid { text-align: center; margin: 10pt 0; break-inside: avoid; }
  .mermaid svg { max-width: 100%; max-height: 120mm; height: auto; }
  .chapter { break-before: page; }
  .eyebrow { margin: 0 0 4pt; font-size: 9pt; font-weight: 700; letter-spacing: 0.08em; color: #0b7f8e; }
  .toc h1 { font-size: 20pt; }
  .toc ol { list-style: none; padding: 0; margin: 0; }
  .toc li { display: grid; grid-template-columns: 24pt 1fr auto; gap: 4pt 8pt; padding: 6pt 0; border-bottom: 1px solid #e2e8f0; }
  .toc .num { color: #0b7f8e; font-weight: 700; }
  .toc .title { font-weight: 600; color: #0f172a; }
  .toc .desc { grid-column: 2 / 3; color: #64748b; font-size: 9pt; }
  .toc .page { grid-row: 1; grid-column: 3; font-variant-numeric: tabular-nums; color: #0f172a; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; gap: 14pt; padding: 0 6mm; }
  .cover svg { width: 46pt; height: auto; }
  .cover h1 { font-size: 34pt; margin: 18pt 0 0; letter-spacing: -0.01em; }
  .cover .subtitle { font-size: 13pt; color: #475569; margin: 0; }
  .cover .meta { margin-top: 30pt; font-size: 10pt; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 10pt; }
`;

function htmlDocument(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${TITLE}</title><style>${STYLES}</style></head><body>${body}</body></html>`;
}

function coverHtml() {
  return htmlDocument(`
    <section class="cover">
      ${LOGO_SVG.replace(/width="\d+" height="\d+"/, 'width="46" height="88"')}
      <h1>${TITLE}</h1>
      <p class="subtitle">${SUBTITLE}</p>
      <div class="meta">
        <div><strong>Version</strong> @solercia/ui ${VERSION}</div>
        <div><strong>Date</strong> ${DATE}</div>
        <div><strong>Source</strong> ${BLOB_URL}docs/manual</div>
      </div>
    </section>`);
}

function bodyHtml(chapters, pages) {
  const toc = chapters
    .map(
      (chapter) => `<li><span class="num">${chapter.number}</span><a class="title" href="#${chapter.slug}">${escapeHtml(chapter.title)}</a>
        <span class="page">${pages.get(chapter.slug) ?? ''}</span><span class="desc">${escapeHtml(chapter.description)}</span></li>`,
    )
    .join('\n');
  const sections = chapters
    .map((chapter) => {
      const html = renderChapter(chapter, { mode: 'manual', chapters, idPrefix: `${chapter.slug}--` })
        .replace(/<p align="center"><img [^>]*><\/p>/, '');
      return `<section class="chapter" id="${chapter.slug}"><p class="eyebrow">Chapter ${chapter.number}</p>${html}</section>`;
    })
    .join('\n');
  return htmlDocument(`<section class="toc"><h1>Contents</h1><ol>${toc}</ol></section>${sections}`);
}

async function renderDiagrams(page) {
  await page.addScriptTag({ path: MERMAID_JS });
  return page.evaluate(async () => {
    document.querySelectorAll('pre.mermaid-source').forEach((pre) => {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = pre.textContent;
      pre.replaceWith(div);
    });
    const mermaid = globalThis.mermaid;
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'Helvetica, Arial, sans-serif' });
    await mermaid.run({ querySelector: '.mermaid' });
    return document.querySelectorAll('.mermaid svg').length;
  });
}

const FOOTER = `<div style="width:100%;font-size:8px;color:#64748b;padding:0 18mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif">
  <span>${TITLE} · @solercia/ui ${VERSION}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

async function printPdf(page, path, numbered) {
  await page.pdf({
    path,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: numbered,
    headerTemplate: '<span></span>',
    footerTemplate: numbered ? FOOTER : '<span></span>',
  });
}

/** Page (1-based, counted from the first body page) where each chapter starts, read back with pdftotext. */
function chapterPages(pdfPath, chapters) {
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const pageTexts = text.split('\f');
  const pages = new Map();
  for (const chapter of chapters) {
    const index = pageTexts.findIndex((pageText) => new RegExp(`^\\s*Chapter ${chapter.number}\\s*$`, 'm').test(pageText));
    if (index >= 0) pages.set(chapter.slug, index + 1);
  }
  return pages;
}

function pdfPageCount(pdfPath) {
  if (!has('pdfinfo')) return null;
  const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  return Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? NaN);
}

/** A copy of Pandoc's reference.docx with A4 pages and a centered page-number footer. */
function referenceDocx(work) {
  const reference = join(work, 'reference.docx');
  execFileSync('pandoc', ['-o', reference, '--print-default-data-file', 'reference.docx']);
  if (!has('zip') || !has('unzip')) return reference;
  const dir = join(work, 'reference');
  execFileSync('unzip', ['-q', reference, '-d', dir]);
  writeFileSync(
    join(dir, 'word/footer1.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>
<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${TITLE} · @solercia/ui ${VERSION} · </w:t></w:r>
<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`,
  );
  const relsPath = join(dir, 'word/_rels/document.xml.rels');
  writeFileSync(
    relsPath,
    readFileSync(relsPath, 'utf8').replace(
      '</Relationships>',
      '<Relationship Id="rIdSolFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
    ),
  );
  const typesPath = join(dir, '[Content_Types].xml');
  writeFileSync(
    typesPath,
    readFileSync(typesPath, 'utf8').replace(
      '</Types>',
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
    ),
  );
  const documentPath = join(dir, 'word/document.xml');
  writeFileSync(
    documentPath,
    readFileSync(documentPath, 'utf8').replace(
      /<w:sectPr>[\s\S]*?<\/w:sectPr>/,
      '<w:sectPr><w:footerReference w:type="default" r:id="rIdSolFooter"/><w:pgSz w:w="11906" w:h="16838"/>' +
        '<w:pgMar w:top="1134" w:right="1020" w:bottom="1247" w:left="1020" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>',
    ),
  );
  rmSync(reference);
  execFileSync('zip', ['-q', '-r', '-X', reference, '.'], { cwd: dir });
  return reference;
}

/** Markdown for Pandoc: chapter anchors, page breaks, Mermaid blocks replaced by rendered PNGs. */
function docxMarkdown(chapters, diagramFiles) {
  let diagram = 0;
  const pageBreak = '```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```';
  return chapters
    .map((chapter) => {
      let body = rewriteMarkdownLinks(chapter.body, { fromPath: chapter.path, mode: 'manual', chapters, current: chapter })
        // Section anchors differ between generators: link to the chapter instead.
        .replace(/\]\(#([a-z0-9-]+)--[^)]+\)/g, '](#$1)')
        .replace(/^<p align="center"><img [^>]*><\/p>\n?/m, '')
        .replace(/^# (.+)$/m, `# $1 {#${chapter.slug}}`);
      body = body.replace(/```mermaid\n[\s\S]*?\n```/g, () => {
        const file = diagramFiles[diagram++];
        return file ? `![](${file.path}){width=${file.widthCm}cm}` : '';
      });
      return `${pageBreak}\n\n${body}`;
    })
    .join('\n\n');
}

async function main() {
  const chapters = loadChapters();
  mkdirSync(OUT_DIR, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'solercia-manual-'));
  const pdfPath = join(OUT_DIR, `${BASENAME}.pdf`);
  const docxPath = join(OUT_DIR, `${BASENAME}.docx`);
  const poppler = has('pdftotext') && has('pdfunite');

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });

    // Pass 1: render, then read back where each chapter starts.
    let pages = new Map();
    await page.setContent(bodyHtml(chapters, pages), { waitUntil: 'load' });
    const diagramCount = await renderDiagrams(page);
    if (poppler) {
      const firstPass = join(work, 'pass1.pdf');
      await printPdf(page, firstPass, true);
      pages = chapterPages(firstPass, chapters);
      // Pass 2: same layout with the page numbers filled in.
      await page.setContent(bodyHtml(chapters, pages), { waitUntil: 'load' });
      await renderDiagrams(page);
    }

    // Diagrams as PNG for Word.
    const diagramFiles = [];
    const handles = await page.$$('.mermaid');
    for (const [index, handle] of handles.entries()) {
      const path = join(work, `diagram-${index + 1}.png`);
      await handle.$eval('svg', (svg) => svg.closest('.mermaid').scrollIntoView());
      const box = await handle.boundingBox();
      await handle.screenshot({ path, omitBackground: false });
      diagramFiles.push({ path, widthCm: Math.min(16, Math.max(6, ((box?.width ?? 600) / 96) * 2.54)).toFixed(1) });
    }

    const bodyPdf = poppler ? join(work, 'body.pdf') : pdfPath;
    await printPdf(page, bodyPdf, true);
    if (poppler) {
      const coverPdf = join(work, 'cover.pdf');
      await page.setContent(coverHtml(), { waitUntil: 'load' });
      await printPdf(page, coverPdf, false);
      execFileSync('pdfunite', [coverPdf, bodyPdf, pdfPath]);
    }
    console.log(`PDF:  ${pdfPath} (${pdfPageCount(pdfPath) ?? '?'} pages, ${diagramCount} diagrams)`);

    if (!has('pandoc')) {
      console.warn('DOCX: skipped, pandoc is not installed.');
      return;
    }
    const logoPng = join(work, 'logo.png');
    await page.setContent(htmlDocument(`<div id="logo" style="display:inline-block;padding:4px">${LOGO_SVG.replace(/width="\d+" height="\d+"/, 'width="63" height="120"')}</div>`));
    await (await page.$('#logo')).screenshot({ path: logoPng, omitBackground: true });
    const metadata = join(work, 'metadata.yaml');
    writeFileSync(
      metadata,
      [
        `title: "${TITLE}"`,
        `subtitle: "${SUBTITLE}"`,
        `date: "@solercia/ui ${VERSION} · ${DATE}"`,
        'abstract-title: ""',
        'abstract: |',
        `  ![](${logoPng}){width=1.2cm}`,
        '',
        `  Source: ${BLOB_URL}docs/manual · Website: ${SITE_URL}docs`,
        '',
        '  ```{=openxml}',
        '  <w:p><w:r><w:br w:type="page"/></w:r></w:p>',
        '  ```',
        'toc-title: Contents',
        '',
      ].join('\n'),
    );
    const markdownPath = join(work, 'manual.md');
    writeFileSync(markdownPath, docxMarkdown(chapters, diagramFiles));
    execFileSync('pandoc', [
      markdownPath,
      '--from=gfm+attributes+raw_attribute',
      '--to=docx',
      `--metadata-file=${metadata}`,
      `--reference-doc=${referenceDocx(work)}`,
      '--toc',
      '--toc-depth=1',
      `--resource-path=${work}`,
      '-o',
      docxPath,
    ]);
    console.log(`DOCX: ${docxPath} (Word paginates on open; the table of contents updates with F9)`);
  } finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});

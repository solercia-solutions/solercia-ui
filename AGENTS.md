# AGENTS.md — @solercia/ui

Instructions for AI coding agents (Claude Code, Codex, OpenCode, Cursor, Copilot…) working in this
repository. `CLAUDE.md` is a symlink to this file.

## What this is

An Angular 22 workspace with two projects:

| Project | Path | Purpose |
| --- | --- | --- |
| `@solercia/ui` | `projects/solercia/ui` | The design-system library published to npm |
| `showcase` | `projects/showcase` | Live demo of every public component; also the reference integration |

| Path | Content |
| --- | --- |
| `projects/solercia/ui/src/lib/ui/` | One folder per component family (`sol-*`) |
| `projects/solercia/ui/src/lib/tokens/` | `ThemeService`, theme ports, bundled default theme |
| `projects/solercia/ui/src/public-api.ts` | Everything consumers can import |
| `projects/solercia/ui/schematics/` | `ng add` and `ng generate` schematics |
| `projects/solercia/ui/docs/` | Theming, i18n, theme studio and multitenant guides |
| `projects/solercia/ui/i18n/es-CO.json` | Library text catalog used by the specs |
| `README.md` | Component reference and quick start; `npm run build` copies it, `llms.txt` and `llms-full.txt` into the package |
| `docs/manual/` | Design-system manual (one Markdown source for the showcase Guides, `llms-full.txt` and the PDF/Word manual) |
| `scripts/` | `build-docs.mjs` (Guides), `build-llms-full.mjs` (`llms-full.txt`), `build-manual.mjs` (PDF and Word) |

## Commands

```bash
npm ci
npm test                # builds library + schematics, runs Vitest (zoneless); must pass before every commit
npm run build:showcase  # must also pass: CI builds the showcase
npm start               # serve the showcase on http://localhost:4200
npm run docs:llms       # regenerate llms-full.txt (CI runs docs:llms:check)
npm run docs:manual     # local only: dist/manual/solercia-design-system.pdf and .docx
```

Rebuilding the library while `ng serve showcase` runs deletes `dist/solercia/ui`: restart the server.

## Rules

- Standalone components, `OnPush`, signal inputs/outputs. The workspace is zoneless: do not add zone.js.
  In specs, create helper templates **before** the component under test (otherwise `NG0950`).
- Styles only through `var(--sol-*)` tokens; no hardcoded colors or fonts, no `!important`, no `::ng-deep`.
- Visible text goes through `SOL_I18N` keys (`shared.*` in `es-CO.json`) or inputs; do not add new
  hard-coded Spanish defaults.
- Every new or changed public component needs: a spec, a page or variant in `projects/showcase`, its
  entry in the README (overview table and reference) and in `llms.txt`.
- Documentation moves with the public API: any change to an exported symbol, selector, input, output,
  port or `ng add` behavior updates the affected chapter in `docs/manual/` in the same commit, and
  `npm run docs:llms` regenerates `llms-full.txt` (also needed after README reference changes).
  Manual snippets use only symbols exported from `public-api.ts`.
- Cover loading, empty, no-results, error and success states, and keyboard and screen-reader access.
- Changing or removing an exported symbol, selector, input or output is a breaking change.

## Commits

- Conventional Commits, header ≤ 72 characters, lowercase, scope `solercia`.
- Body: 2–4 bullets of ≤ 100 characters.
- **No AI attribution**: never add `Co-Authored-By`, `Claude-Session`, `Generated with` or similar.
- Author email: the GitHub noreply address configured in the local clone.

## Every commit is tagged (mandatory)

Each commit that lands on `main` is a release and **must carry its own version tag**:

1. In the same commit, bump `version` in `projects/solercia/ui/package.json` (SemVer: `patch` for fixes
   and docs, `minor` for new components or inputs, `major` for breaking changes) and add the entry to
   `projects/solercia/ui/CHANGELOG.md`.
2. Commit, then tag it with exactly the library version: `git tag v<version>`.
3. Push the commit and the tag: `git push origin main && git push origin v<version>`.

The tag triggers `.github/workflows/publish.yml`, which checks that the tag matches the library version
and publishes to npm with Trusted Publishing (OIDC, no token) and provenance. An untagged commit on
`main` is a defect: tag it before doing anything else. Never move or delete a pushed tag.

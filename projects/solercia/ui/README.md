# @solercia/ui

Shared Angular design system for the Solercia platform. This project was
generated using [Angular CLI](https://github.com/angular/angular-cli) version
22.0.0.

## Theming & i18n (agnostic by design)

The library is a **shareable, host-agnostic** design system: theming and i18n are
fully decoupled from any host and injected in. Components emit only `--sol-*` CSS
variables and depend on tiny injection contracts — never on an HTTP endpoint or
a specific i18n engine.

- **Theming** — the host implements two ports: `SOL_TENANT_RESOLVER` (who the
  active tenant is) and `THEME_SOURCE` (how to load its `ThemeFile`). The library
  resolves that JSON into 96 `--sol-*` custom properties on `:root`. Three
  degradation levels, best to worst: **(1)** tenant theme via the host's
  `THEME_SOURCE` → **(2)** `SOL_DEFAULT_THEME` (the bundled "Vértice" theme, works
  with **no host wiring**) → **(3)** inline `:root` CSS in the host's `styles.css`
  (last resort). A project that wires nothing renders on Vértice and works
  identically.
- **i18n** — the library defines `SOL_I18N` (a `SolI18n` contract:
  `t` / `translate` / `activeLang` / `tMany`) with a built-in identity default
  (returns the key). The host binds its own engine (boki-front uses Transloco),
  mirroring Angular Material's `*Intl` services.

Docs:

- [`docs/THEMING.md`](./docs/THEMING.md) — ports, the full `ThemeFile` contract,
  degradation levels, and how to implement a `ThemeSource`.
- [`docs/I18N.md`](./docs/I18N.md) — the `SOL_I18N` contract and how to provide an
  engine (Transloco, ngx-translate, or the identity default).
- [`docs/THEME-STUDIO.md`](./docs/THEME-STUDIO.md) — the `@solercia/ui/theme-studio` entry point:
  `<sol-theme-studio>`, the `ThemeStudioStore` contract and an adapter example.
- [`docs/MULTITENANT_SETUP.md`](./docs/MULTITENANT_SETUP.md) — step-by-step wiring
  for a new starter project and for an existing project adopting `@solercia/ui`.

### Themed sign-in (`@solercia/ui/login-appearance`)

The theme can carry a `meta.login` block (photos, motion, per-mode composition and caption).
The entry point ships the pieces to paint it and no auth logic: the host projects its own form.

```ts
import { SolLoginFrameComponent, resolveLoginView } from '@solercia/ui/login-appearance';

// In the login page: `null` (no photos anywhere) keeps the classic centered card.
readonly view = computed(() => {
  const meta = this.themeService.activeTheme()?.meta as { login?: unknown } | undefined;
  return resolveLoginView({ published: null, theme: meta?.login }, this.themeService.isDark());
});
```

```html
<sol-login-frame [view]="view()" [tagline]="tagline()" [logo]="logo()" [dark]="isDark()">
  <h1>…</h1>
  <app-login-form />
</sol-login-frame>
```

- `normalizeLogin` bounds every value; photos are only `https://`, root-relative or `assets/` URLs
  of PNG, JPEG, WebP or AVIF images. The library never fetches anything: a host that serves the
  appearance before sign-in passes its body through `normalizeLoginAppearance`.
- `<sol-theme-studio [features]="{ loginAppearance: true }">` adds the «Inicio de sesión» tab with
  `<sol-login-appearance-editor>`; photos upload through `ThemeStudioStore.uploadLogo` and the block
  is saved with «Aplicar tema».
- Texts live under `sol.loginAppearance.*` (defaults in Colombian Spanish and English).

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the library, run:

```bash
ng build ui
```

This command will compile your project, and the build artifacts will be placed in the `dist/` directory.

### Publicación del paquete

`@solercia/ui` se publica en el registro público de npm desde el repositorio
[`solercia-solutions/solercia-ui`](https://github.com/solercia-solutions/solercia-ui).
`npm run build` (en la raíz del repositorio) emite `dist/solercia/ui` con la librería, los entry
points `login-appearance` y `theme-studio` y los schematics.

1. Sube `version` en `projects/solercia/ui/package.json` y registra el cambio en `CHANGELOG.md`.
2. Valida el empaquetado: `npm run build && cd dist/solercia/ui && npm publish --dry-run`.
3. Empuja un tag `v<versión>` (`git tag v0.7.1 && git push origin v0.7.1`). El workflow
   `.github/workflows/publish.yml` verifica que el tag coincida con la versión y publica con
   Trusted Publishing de npm (OIDC, sin token), con provenance.

En npmjs.com, el paquete debe tener como Trusted Publisher la organización `solercia-solutions`,
el repositorio `solercia-ui` y el workflow `publish.yml`. Si el job falla con `ENEEDAUTH`,
revisa que esos tres datos coincidan.

## Licencia

`Apache-2.0` © 2026 Solercia Solutions SAS. Ver [`LICENSE`](./LICENSE) y [`NOTICE`](./NOTICE).

## Pruebas

```bash
npm test
```

Compila la librería y los schematics y corre las pruebas con Vitest (builder
`@angular/build:unit-test`). Las pruebas que validan textos usan el catálogo propio de la
librería, `projects/solercia/ui/i18n/es-CO.json`.

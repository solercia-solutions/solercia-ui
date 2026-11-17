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

`@solercia/ui` se publica en el registro **público** de npm (`registry.npmjs.org`,
organización `solercia` — `publishConfig.registry` en este `package.json`; la nota anterior
sobre GitHub Packages quedó obsoleta desde `07-e9`). `0.1.0` y `0.1.1` YA están publicadas ahí
(`npm view @solercia/ui versions`) — se publicaron **manualmente** (`npm publish` local,
usuario `camilocalderont`), no por el workflow de CI. El PROYECTO Angular se construye con
`ng build @solercia/ui` (NO `ng build ui`), que emite `dist/solercia/ui` (fesm2022 +
`index.d.ts` + schematics + `LICENSE` + `NOTICE`).

1. Construir el paquete completo (lib + schematics) y empaquetarlo:

   ```bash
   npm run build
   cd dist/solercia/ui && npm pack
   ```

2. Validar el empaquetado sin publicar de verdad (`--dry-run`, no requiere token ni red hacia
   el registry):

   ```bash
   cd dist/solercia/ui
   npm publish --dry-run
   ```

3. **Paso pendiente del fundador — publicar `0.2.0` (NO ejecutado por el agente, gate
   explícito del fundador):**

   ```bash
   # Versión ya bumpeada a 0.2.0 en projects/solercia/ui/package.json (PR6, T48).
   git tag v0.2.0
   git push origin v0.2.0   # dispara .github/workflows/publish-packages.yml (tag v*)
   ```

   La publicación por CI usa Trusted Publishing de npm (OIDC): no hay token ni secret.
   Cada paquete (`@solercia/ui`, `@solercia/eslint-config`) tiene en npmjs.com, en
   Settings → Trusted Publisher, la organización `solercia-solutions`, el repo `boki-front`
   y el workflow `publish-packages.yml`. Empujar el tag `v*` publica sola, con provenance.
   Si el job falla con `ENEEDAUTH`, revisa que esos tres datos coincidan exactamente.

   Una vez publicada `0.2.0`, los consumidores que hoy usan el tarball local (`gestion_proyectos`,
   ver `openspec/11-a-solercia-ui/`) pueden volver a un rango semver normal
   (`"@solercia/ui": "^0.2.0"`) contra el registro público, en vez de `file:./vendor/*.tgz`.

## Licencia

`Apache-2.0` © 2026 Solercia Solutions SAS. Ver [`LICENSE`](./LICENSE) y [`NOTICE`](./NOTICE).

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

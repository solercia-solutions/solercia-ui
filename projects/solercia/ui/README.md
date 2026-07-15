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
  resolves that JSON into 95 `--sol-*` custom properties on `:root`. Three
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
- [`docs/MULTITENANT_SETUP.md`](./docs/MULTITENANT_SETUP.md) — step-by-step wiring
  for a new starter project and for an existing project adopting `@solercia/ui`.

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

`@solercia/ui` se publica en GitHub Packages (registry privado, `publishConfig.registry` en
este `package.json`). El PROYECTO Angular se construye con `ng build @solercia/ui` (NO
`ng build ui`), que emite `dist/solercia/ui` (fesm2022 + `index.d.ts` + schematics + `LICENSE`
+ `NOTICE`).

1. Construir el paquete completo (lib + schematics):

   ```bash
   npm run build
   ```

2. Validar el empaquetado sin publicar de verdad (`--dry-run`, no requiere token ni red hacia
   el registry):

   ```bash
   cd dist/solercia/ui
   npm publish --dry-run
   ```

3. La publicación **real** está automatizada por tag (`v*`) en
   `.github/workflows/publish-packages.yml` y bloqueada hoy por la decisión D1 del fundador
   (owner/organización del scope `@solercia`, repositorio de alojamiento, método de
   autenticación) — ver `openspec/07-e9-extraccion-solercia-ui/tasks.md`, PR4.

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

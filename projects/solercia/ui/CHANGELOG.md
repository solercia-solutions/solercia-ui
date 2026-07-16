# Changelog — @solercia/ui

Todos los cambios notables de este paquete se documentan en este archivo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado es
[SemVer](https://semver.org/lang/es/) (decisión D2: se inicia en `0.1.0` pre-1.0, mientras el
paquete tiene solo dos consumidores potenciales — `boki-front` y, próximamente, `gestion_proyectos`
— y puede admitir cambios incompatibles en versiones `minor`).

## [0.1.2] - 2026-07-16

### Corregido

- `ng-add` (schematic): 5 correcciones descubiertas al hornear un proyecto real (`ng new` +
  `ng add @solercia/ui@0.1.0`) contra el paquete publicado, sin backport previo al schematic:
  1. **`TS5090`**: `wireTsconfigPaths` escribía los alias FSD (`@pages/*`, `@widgets/*`, etc.) sin
     prefijo `./` (p. ej. `"src/pages/*"`); un `tsconfig.json` de `ng new` no define `baseUrl`, así
     que el compilador rechazaba la ruta no-relativa. Ahora los `paths` generados siempre llevan
     `./` explícito.
  2. **`appendGlobalStyles` ignoraba SCSS**: solo detectaba `src/styles.css`; en un proyecto
     `ng new --style=scss` los tokens `--sol-*` de ejemplo no se inyectaban. Ahora detecta también
     `src/styles.scss`.
  3. **`@solercia/eslint-config` no se instalaba**: el schematic solo dejaba un log informativo
     ("aún no publicado"). Ahora se agrega como `devDependency` real vía `addDependency` (el preset
     está publicado en npm desde `0.1.1`).
  4. **`TS2571` por falta de `@shared/i18n`**: los schematics `page`/`feature`/`widget` generan
     componentes que importan `I18nService` desde `@shared/i18n`, capa que `ng-add` nunca
     scaffoldeaba. Ahora se crea `shared/i18n/i18n.service.ts` (adaptador identidad de `SolI18n`,
     listo para cablear a `SOL_I18N`) + `shared/i18n/index.ts`.
  5. **`eslint.config.js` sin `"type":"module"`**: se generaba en sintaxis ESM (`import ... from`)
     sobre un `package.json` de `ng new` por defecto CommonJS, produciendo `ERR_REQUIRE_ESM`. Ahora
     el archivo se emite como `eslint.config.mjs` cuando el `package.json` anfitrión no declara
     `"type":"module"`.
- Configs de Husky en `.cjs` para hosts ESM: hallazgo del lente `review-reliability` sobre el fix 5
  — si el `package.json` anfitrión SÍ declara `"type":"module"` (por ejemplo, a mano o por un futuro
  default), Node interpretaba `commitlint.config.js`/`lint-staged.config.js` (ambos en sintaxis
  CommonJS, `module.exports`) como ESM y los hooks de Husky reventaban con
  `ReferenceError: module is not defined in ES module scope`. Ahora `scaffoldHusky` emite ambos
  archivos con extensión `.cjs` (mismo contenido CommonJS, sin cambios) cuando el host ya es ESM; en
  el caso por defecto (CommonJS) se mantiene `.js` sin cambios de comportamiento.
- Cobertura: 7 casos nuevos/actualizados en `ng-add.spec.ts` con `SchematicTestRunner` sobre un
  árbol `ng new` simulado (sin red) — 5 por fix + 2 de la corrección posterior al review
  (`review-reliability`: versión exacta de `@solercia/eslint-config`, Husky en `.cjs` para hosts
  ESM, y cobertura de la rama sin `styles.css`/`styles.scss`). 283 tests de la librería en verde
  (277 base + 6 netos nuevos).

## [0.1.1] - 2026-07-15

### Agregado

- `sol-data-table`: tabla genérica dirigida por columnas (`DataTableColumn`), con búsqueda, paginación,
  ordenamiento, estados loading/empty, modo móvil colapsable y slot `#rowActions` para acciones por fila
  (edit/delete de conveniencia). Autocontenida (sin dependencias de dominio ni de utilidades del host).
- `sol-page-header`: encabezado de página (`title` requerido, `subtitle` opcional, slot de acciones).
- `sol-icon-button`: botón de solo ícono sobre el registro de íconos de la librería, con `ariaLabel`
  requerido, variantes (`default`/`danger`/`ghost`), tamaños y output `clicked`.
- `sol-rich-editor`: menciones (`@`) y task-linking (`#`) **opt-in** — inputs `mentionableUsers`/`linkableTasks`
  y outputs `mentionsChange`/`taskLinksChange` (tipos `MentionUser`/`LinkableTask`). Aditivo: con listas
  vacías el editor mantiene su comportamiento previo (imágenes, serialización TCPDF). El sanitizador
  preserva solo los chips `data-mention-id`/`data-task-key` (whitelist estricta, anti-XSS).

### Notas

- Componentes surgidos del segundo consumidor (`gestion_proyectos`): reemplazan sus stopgaps locales, de
  modo que el consumidor no mantenga design system propio.
- 277 tests de la librería en verde (246 base + 31 nuevos).

## [0.1.0] - 2026-07-14

### Agregado

- Extracción inicial del design system Solercia: 28 componentes `sol-*` (`shared/ui`), theming de 3
  niveles con 95 tokens `--sol-*` (`shared/tokens`, `ThemeService`), registro de íconos (Heroicons) y
  utilidades presentacionales.
- Arquitectura agnóstica del host por puertos (`InjectionToken`): `THEME_SOURCE`, `SOL_DEFAULT_THEME`,
  `SOL_TENANT_RESOLVER`, `SOL_I18N`. La librería no conoce `boki-api` ni HTTP; los adaptadores viven en
  el host consumidor.
- Colección de schematics `ng add` / `ng generate page|feature|entity|widget` dentro de la propia
  librería, conforme a Feature-Sliced Design.
- Documentación: `docs/{THEMING,I18N,MULTITENANT_SETUP}.md` + README de la librería.
- Metadata de publicación: licencia `Apache-2.0`, `NOTICE` de autoría (Solercia Solutions SAS),
  `publishConfig` apuntando a GitHub Packages (`https://npm.pkg.github.com`).

### Notas

- Publicación real en GitHub Packages pendiente de la decisión D1 del fundador (owner/organización
  del scope `@solercia`, repositorio de alojamiento y método de autenticación).

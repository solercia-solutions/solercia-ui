# Changelog — @solercia/ui

Todos los cambios notables de este paquete se documentan en este archivo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado es
[SemVer](https://semver.org/lang/es/) (decisión D2: se inicia en `0.1.0` pre-1.0, mientras el
paquete tiene solo dos consumidores potenciales — `boki-front` y, próximamente, `gestion_proyectos`
— y puede admitir cambios incompatibles en versiones `minor`).

## [0.3.0] - 2026-07-16

### Agregado

- `sol-drawer` (11-h-sol-drawer, PR1): panel lateral (drawer / side sheet) a alto
  completo (`100dvh`), hermano de `sol-modal` para formularios largos con contenido
  desplegable. Lado `start`/`end` (`end` = derecha, default), ancho `sm`/`md`/`lg` por
  tokens, header con título y cierre proyectables, contenido con scroll propio,
  footer proyectable (`[drawerFooter]`), `role="dialog"` + `aria-modal="true"` +
  `aria-labelledby`, focus trap propio con retorno de foco al disparador, candado de
  scroll del body y cierre por backdrop/Escape/botón (backdrop-close por defecto
  `true`, a diferencia de `sol-modal`). Motion por tokens
  (`--sol-dur-base`/`--sol-ease-entrance`) con degradación a `prefers-reduced-motion`.
  Overlay compartido (`ui/overlay/`): `overlay-interactions` (predicados puros de
  Escape/backdrop), `body-scroll-lock` (candado con contador de referencias) y
  `focus-trap` (ciclo de `Tab` in-house, sin `@angular/cdk/a11y`) — extraídos de
  `sol-modal` sin cambiar su comportamiento observable (specs de regresión en verde).
- `sol-chip` / `sol-chip-group`: átomo de selección presentacional (emoji, conteo,
  removible, deshabilitado, tamaño) + contenedor CVA con política de selección única
  (`radiogroup`/`radio`) o múltiple (`group`/`checkbox`) resuelta por Strategy
  (`SolChipSelectionStrategy`), roving-tabindex con flechas/Home/End, `aria-pressed` vs
  `aria-checked` según rol, i18n (`shared.chip.remove`).
- `sol-number-input` (`SolNumberInputComponent`, deliberadamente distinto de
  `sol-stepper`, que indica pasos): stepper numérico CVA con `min`/`max`/`step`,
  `role="spinbutton"` + `aria-valuemin/max/now`, botones `−`/`+` deshabilitados en el
  límite (sin wrap), flechas ± un `step` y Home/End a los límites, re-clamp reactivo si
  `min`/`max` cambian en runtime, i18n (`shared.numberInput.decrement/increment`).
- Ícono `minus` agregado al registro (`icon.registry.ts`) para los botones de
  `sol-number-input`.

### Corregido

- Zoom automático de iOS en móvil (`<640px`) en 5 átomos que ya usaban `<input>`/
  `<textarea>` nativos: `sol-input`, `sol-textarea`, `sol-search-input` (antes 12px vía
  `--sol-font-size-sm`), `sol-select` (buscador + trigger, paridad visual) y
  `sol-date-picker` (variantes normal y `--sm`). Fix encapsulado por átomo vía
  `@media (max-width:640px){ font-size:16px }` en los `styles` inline de cada
  componente — sin tocar el token global `--sol-font-size-base` (contrato de tenant,
  afecta también desktop) ni el `viewport` de `index.html` (WCAG 1.4.4 se preserva).

### Notas

- Superficie pública curada: `SolChipSelectionStrategy`, `SINGLE_SELECT_STRATEGY` y
  `MULTIPLE_SELECT_STRATEGY` son internos a `chip/` (no exportados desde
  `lib/ui/index.ts`) — no hay input `strategy` que los consuma todavía (YAGNI, sin
  consumidores reales aún); el componente sigue decidiendo la FORMA del valor CVA
  (`string` vs `string[]`) directamente sobre `multiple()`.
- Publicación real a `registry.npmjs.org` **NO ejecutada** (gate del fundador, igual
  que `0.2.0`) — este release solo se empaqueta localmente (`npm pack`) para consumo
  vía `.tgz` en `gestion_proyectos` y como validación de compatibilidad `ThemeFile`/
  `EMIT_TABLE` (sin cambios de contrato).
- 1023/1023 tests de la librería en verde (1016 de las nuevas incorporaciones de
  `sol-chip`/`sol-chip-group`/`sol-number-input` + 7 de la corrección de robustez
  post-review sobre foco/CVA/bounds).
- `sol-drawer` (PR1, 11-h): 1070/1070 tests de la librería en verde (29 nuevos: 13 de
  `sol-drawer`, 6 de `overlay-interactions`, 6 de `focus-trap`, 4 de
  `body-scroll-lock`); `sol-modal` queda con el mismo comportamiento observable tras
  delegar Escape/backdrop al helper compartido (specs de regresión sin tocar).

## [0.2.0] - 2026-07-16

### Agregado

- `sol-avatar`, `sol-score-badge`, `sol-trend`, `sol-message-status`: átomos de "vocero"
  (iniciales + color estable por hash de 8 tonos, umbral configurable ≥80/≥50, tendencia con
  signo, 5 estados de mensaje vía `sol-icon` sin SVG inline).
- `sol-stepper`: nuevo input `navigation:'linear'|'free'` — en `free` cualquier paso es
  navegable (pipeline CRM accionable) emitiendo `stepSelected`; retrocompatible con la API
  horizontal `0.1.x`.
- `sol-timeline`: timeline jerárquico N-niveles genérico (D2 — nunca conoce `epic`/`sprint`/
  dominio del consumidor), motor de posicionamiento puro `positionRows(nodes, range)`,
  envolvente automática para nodos padre sin fechas propias, colapso/expansión con "espejo"
  interno, sin dependencias externas nuevas.
- `sol-kanban-board` / `-column` / `-card`: tablero kanban genérico con arrastrar-y-soltar.
  `@angular/cdk` como `peerDependency` encapsulada tras `sol-kanban` (lint
  `no-restricted-imports` impide que el consumidor la importe directo). Anclas terminales por
  template proyectado, mecanismo alternativo 100 % accesible por teclado (`<select>` de mover
  tarjeta) y anuncio `aria-live` de cada movimiento (drag real o select).
- `sol-calendar`: calendario genérico semana/día con paridad de vistas frente al widget legado
  de `boki-front`, resolución de color por Strategy inyectable (`SOL_CALENDAR_COLOR`, default
  null-object desde `event.color`), cuerpo de evento por template proyectado y leyenda
  configurable (`view` tipa solo `'week' | 'day'`).
- `sol-data-table`: `rowActionsTemplate` (`contentChild('rowActions')`), `actionsLabel` y
  `toggleDetailsLabel` consolidados, con default de `toggleDetailsLabel` corregido para igualar
  el texto real que usaban los consumidores.
- Registro de íconos: +45 entradas Heroicons v2 (outline) + 7 SVG propios
  (`robot`/`gauge`/`plug`/`git-branch`/`webhook`/`state-machine`/`double-check`). Gate
  automatizado (`icon.registry.spec.ts` + `svg-inline-gate.spec.ts`) que impide agregar SVG
  inline nuevo dentro de `projects/solercia/ui/src/lib/**` (escaneo de contenido completo,
  no línea por línea — cubre `<svg>`/`<path>`/`<circle>`/`<polyline>`/`<polygon>`/`<line>`/
  `<rect>` en cualquier posición, con exclusión de comentarios).

### Corregido

- Migración de SVG inline del lado librería (`pagination`/`modal`/`select`/`search-input`) a
  `sol-icon` del registro ampliado.

### Notas

- `0.1.0` y `0.1.1` ya están publicadas en `registry.npmjs.org` (`npm view @solercia/ui
  versions`), publicadas **manualmente** (no por CI). `0.1.2` quedó preparada (ver entrada
  anterior) pero nunca llegó a publicarse por separado — su contenido queda absorbido por este
  release.
- Publicación real de `0.2.0` **PREPARADA, no ejecutada** (gate del fundador) — ver
  `README.md#Publicación del paquete` para el paso exacto (`git tag v0.2.0` + push, o publish
  manual como respaldo). Pendiente antes de publicar por CI: configurar el secret `NPM_TOKEN`
  del repositorio (hoy vacío/ausente) y **rotar** el token de npm usado en la publicación
  manual de `0.1.1` (quedó expuesto en un log de sesión) — deuda heredada de
  `07-e9-extraccion-solercia-ui` (ver `openspec/07-e9-extraccion-solercia-ui/state.yaml`).
- 961/961 tests de la librería en verde (283 de `0.1.2` + los nuevos de `sol-avatar`/
  `sol-score-badge`/`sol-trend`/`sol-message-status`/`sol-stepper`/`sol-timeline`/`sol-kanban`/
  `sol-calendar`/`sol-data-table`/registro de íconos acumulados en PR2-PR8).

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

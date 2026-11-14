# Changelog — @solercia/ui

Todos los cambios notables de este paquete se documentan en este archivo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado es
[SemVer](https://semver.org/lang/es/) (decisión D2: se inicia en `0.1.0` pre-1.0, mientras el
paquete tiene solo dos consumidores potenciales — `boki-front` y, próximamente, `gestion_proyectos`
— y puede admitir cambios incompatibles en versiones `minor`).

## [0.7.0] - 2026-11-14

Inicio de sesión personalizable desde el tema, teclado completo y modo controlado en `sol-select`,
y ajustes para celular. Todo es aditivo frente a 0.6.1: sin activar la opción nueva,
`<sol-theme-studio>` se ve y se comporta igual.

### Agregado

- `sol-select`: teclado completo (flechas, Inicio, Fin, Enter, Esc, Tab) con opción activa y
  `aria-activedescendant`, con y sin buscador; `role="option"` y `aria-selected` en las opciones,
  `aria-haspopup="listbox"` en el botón; el foco vuelve al botón al cerrar con teclado o al elegir.
- `sol-select`: entradas opcionales `ariaLabel`, `searchPlaceholder` y `emptyLabel` (con los textos de
  siempre por defecto), y modo controlado `[value]` + `(valueChange)`, que pinta el valor desde el
  primer render, también en el HTML prerenderizado.

- Punto de entrada `@solercia/ui/login-appearance`:
  - Contrato `meta.login` del tema y `normalizeLoginAppearance`: valores por defecto, listas
    cerradas, URLs de imagen y de logo seguras (`https://`, `/…` o `assets/…`, solo PNG, JPEG,
    WebP o AVIF) y modo por defecto del inicio de sesión.
  - `<sol-login-frame>`: marco tematizado del inicio de sesión (escena, fotos que rotan, figuras,
    fondo del panel, marca con logo por modo y lema). La aplicación pone su propio formulario
    dentro con `ng-content`; la librería no trae lógica de autenticación ni llamadas HTTP.
  - `<sol-login-appearance-editor>`: editor de la apariencia con vista previa en vivo.
- `@solercia/ui/theme-studio`: opción `features.loginAppearance` (por defecto apagada) que agrega
  las pestañas «Apariencia general» e «Inicio de sesión»; `meta.login` se guarda con «Aplicar
  tema» y se acepta al importar JSON.

### Cambiado

- `<sol-select>` en pantalla táctil abre como hoja inferior (todo el ancho, hasta 70 % del alto,
  opciones de 44 px, letra de 16 px y respeto de la barra de inicio del iPhone) y no enfoca el
  buscador al abrir, para que el teclado no tape la lista: el foco queda en la lista.
- `sol-select`: una opción con valor `''` se muestra por su nombre en vez de por el marcador; `label`
  queda asociado al botón (`for`); el buscador ignora las tildes; las opciones suben a 44 px de alto
  en el celular; el `hover` de las opciones también se ve en modo oscuro.
- `solFloatingPanel`: el panel hereda el `--sol-z-modal` de su disparador, para quedar por encima de
  una hoja que lo haya subido.

### Corregido

- `sol-data-table`: el host pasa a `display: block`. El colapso a tarjetas mide el ancho del host
  con `ResizeObserver`, que reporta 0 en un elemento en línea, así que la tabla colapsaba también
  en escritorio cuando su contenedor no era flex ni grid.

## [0.6.1] - 2026-10-02

Paridad total de `<sol-theme-studio>` con el Theme Studio de PANDORA, del que se portó. Se
comprobó con un arnés lado a lado sobre los mismos datos: 88 pares de capturas (1440×900 y
390×844, claro y oscuro: estado inicial, cada sección, historial y su segunda página, diálogo de
restauración, error de JSON inválido, botón flotante y panel lateral) con 0 píxeles distintos, y
un recorrido funcional con las mismas llamadas y los mismos payloads. Todo es aditivo frente a
0.6.0.

### Agregado

- `SolConfirmDialogComponent` (`<sol-confirm-dialog>`): confirmación con ícono por variante
  (`danger` | `warning` | `info`), Escape y clic en el fondo para cancelar.
- `SolRevealDirective` (`[solReveal]`): animación de entrada al hacer scroll dirigida por los
  tokens de movimiento del tema (`--sol-reveal-name`, `--sol-dur-slow`, `--sol-ease-entrance`), con
  stagger por índice y replay. Inyecta una sola vez sus keyframes globales (con el nonce de
  `CSP_NONCE` si existe).
- `@solercia/ui/theme-studio`:
  - Entrada `features` (`SolThemeStudioFeatures`) con secciones y comportamientos opcionales:
    `themeName` (por defecto `true`), `loader` (sección «Loader / spinner» en `meta.loader`, con su
    muestra en la vista previa), `tableVariantMetaKey` (refleja la variante de tabla en una clave
    de `meta`) y `persistDefaultModeOnApply` (fija el modo por defecto como preferencia del
    navegador al aplicar).
  - Entradas `metaExtrasSchema`, `footerPlaceholder`, `exportFileName`, `versionTimeZone` y
    `versionTimeZoneLabel`; variable CSS `--sol-theme-studio-bottom-inset`.
  - `ThemeStudioStore.apply` puede emitir el tema persistido: la pantalla lo empuja con
    `ThemeService.setTenantTheme` (sin volver a pedirlo) y avisa si no es renderizable.
  - Los errores del store muestran el mensaje del backend (`error.message`,
    `error.errors[0].message` o `userMessage`); la regla se exporta como
    `extractStoreErrorMessage`.
  - `SolThemeStudioNotice.kind` admite `warning` (imagen de más de 2 MB, hex inválido,
    portapapeles no disponible).
  - `parseThemeJson` acepta `metaExtrasSchema`, `loader` y `tableVariantMetaKey`;
    `ThemeImportError.pathVisible` indica cuándo la ruta señala el campo exacto que se debe
    corregir.
  - Modelo del indicador de carga: `ThemeLoaderConfig`, `DEFAULT_LOADER_CONFIG`,
    `STUDIO_LOADER_PRESENTATIONS`, `STUDIO_LOADER_ANIMATIONS`.

### Cambiado

- `<sol-theme-studio>` usa el marcado, los estilos y los textos del original: tarjetas con
  animación de entrada, panel lateral propio bajo 1024 px (en vez de `sol-drawer`) con Escape para
  cerrar, `sol-confirm-dialog` (en vez de `sol-modal`), historial con fecha y hora `medium`,
  línea de estado del JSON siempre presente, pie de página de hasta 200 caracteres. Importar y
  previsualizar una versión ya no emiten `notify`: se informan en la línea de estado, como en el
  original.
- Los textos es-CO son los del original (salvo `preview.footerFallback`, `table.hint` y
  `loader.hint`, que quedan genéricos); los del historial y del JSON conservan el trato de usted
  del original.
- Tras aplicar, el borrador importado o la versión restaurada sigue siendo la base del editor:
  sus tokens no editados viajan intactos en lo que se exporte o se vuelva a aplicar.
- El color elegido con el selector o una sugerencia se guarda tal cual (sin pasarlo a
  mayúsculas), igual que en el original.

### Corregido

- Las 2 pruebas de `ThemeService` sobre `meta.defaultMode` esperaban que la preferencia guardada
  ganara; el código (el modo de BD gana en cada carga y se sincroniza en `localStorage`) es el
  comportamiento correcto y del que depende PANDORA. Se corrigieron las pruebas y la
  documentación de `setTenantTheme` y `setDarkMode`.

### Notas

- El panel lateral de la vista previa usa `--sol-dur-normal`, que la `EMIT_TABLE` no emite: como
  en el original, aparece sin deslizarse. Se conserva así por paridad.

## [0.6.0] - 2026-10-01

Versión estable. Incluye todo lo de `0.6.0-rc.1` (abajo) más lo que PANDORA, primer consumidor
externo, construyó o parchó por fuera de la librería. Todo es aditivo salvo la nota de
«Cambiado».

### Agregado

- **Punto de entrada secundario `@solercia/ui/theme-studio`** (las apps que no lo importan no lo
  cargan):
  - `<sol-theme-studio>`: editor visual completo del tema — controles compartidos y por modo
    (claro/oscuro), vista previa aislada (las variables se aplican al host del preview, nunca a
    `:root`), aplicar con confirmación (`sol-modal`), historial paginado con restauración de
    versiones, importar y exportar JSON, carga de logo y favicon. Entradas `baseTheme` y
    `metaExtras`; salidas `applied` (tema guardado) y `notify` (`SolThemeStudioNotice`, la app
    decide cómo mostrarlo). Estados de carga, vacío legítimo, error con reintento y éxito.
  - Contrato de persistencia `ThemeStudioStore` + token `THEME_STUDIO_STORE`, con los tipos
    `ThemeVersion` y `ThemeVersionPage`. Los métodos opcionales (`listVersions`, `getVersion`,
    `uploadLogo`) apagan su sección si el host no los implementa.
  - Núcleo headless sin inyección de Angular: `buildThemeFile(form, baseTheme?, metaExtras?)`,
    `mapThemeFileToForm`, `deepMerge`, `parseThemeJson` (tope de 256 KB, profundidad 20, bloquea
    `__proto__`, `url(`, `javascript:`, `@import`, `expression(`, marcado y URLs de asset que no
    son https ni relativas; colores de marca extra solo en hex) y `mergeThemeEditorChanges`.
  - `parseThemeJson` lanza `ThemeImportError` con un `ThemeImportErrorCode` traducible en vez de
    mensajes en español quemados.
  - Textos por `SOL_I18N` con claves `sol.themeStudio.*`; respaldo propio en es-CO (tuteo) y en,
    exportados como `SOL_THEME_STUDIO_I18N_ES_CO` y `SOL_THEME_STUDIO_I18N_EN`.
- Contrato del tema (punto de entrada principal):
  - `ThemeMeta.name?` (nombre de la plantilla, solo metadato) y `ThemeMeta.favicon?` (sanitizado
    con `sanitizeAssetUrl`; sin valor o con una URL insegura, el favicon sigue al logo como antes).
    `ThemeService.tenantFavicon` expone la URL efectiva.
  - `component.table.variant` (`SolTableVariant`: `clean` | `zebra` | `bordered` |
    `emphasis-header` | `banded`) y el catálogo `SOL_TABLE_VARIANTS`.
  - `semantic.color.primaryContrast?` → `--sol-color-primary-contrast` (default `#FFFFFF`). La
    tabla de emisión pasa a 96 variables.
  - `semantic.color.secondaryContrast?` queda declarado en el tipo (la `EMIT_TABLE` ya lo emitía).
  - `SOL_BUNDLED_DEFAULT_THEME`: el tema empaquetado como constante (valor de fábrica de
    `SOL_DEFAULT_THEME` y base por defecto del builder).
- `sol-data-table`: input `variant` que sobrescribe `component.table.variant` del tema. Los estilos
  de cada variante viven en el componente y usan solo `var(--sol-*, respaldo)`; sin variante la
  tabla conserva su look de siempre.
- `sol-select`: input `mobileBreakpoint` (default `640`). Extiende la protección anti-zoom de iOS
  (16 px en el disparador y el buscador) a hosts cuyo layout móvil corta más arriba (p. ej. 768).

### Cambiado

- `ThemeTableComponent.mobile` pasa a opcional para que un tema pueda declarar solo `variant`.
  Quien leía `table.mobile` ya debía tratar el bloque como opcional (`table?`); el default sigue
  siendo `collapse`.

### Corregido

- El paquete vuelve a incluir `schematics/` (el tarball de `0.6.0-rc.1` se generó sin
  `npm run build:schematics`, aunque `package.json` declara `schematics` y `ng-update`).

## [0.6.0-rc.1] - 2026-09-01

> Prerelease (`-rc.1`): se publica como tarball local para que PANDORA (`poc-shell-angular`),
> primer consumidor externo de `@solercia/ui`, lo pruebe antes de la publicación definitiva a
> npm. Todo lo de abajo es aditivo — ningún input ni tipo existente cambia de forma incompatible.

### Agregado

- `sol-data-table` (`ui/data-table/data-table.component.ts`):
  - Input `actionsPosition: 'start' | 'end'` (default `'end'`, no rompe a nadie): mueve el
    th/td de acciones (el `#rowActions` proyectado y los botones editar/eliminar por defecto)
    a la primera columna en vez de la última. Sin efecto en el modo colapsado móvil — ahí las
    acciones siguen viviendo solo en el detalle expandido de la card, como siempre.
  - Filtros por columna, opt-in (`DataTableColumn.filter: 'text' | 'select'`): con al menos una
    columna declarándolo aparece una fila de controles bajo el header
    (`sol-data-table__filters-row`), oculta en el modo colapsado móvil. `'text'` filtra por
    contención case-insensitive; `'select'` puebla un `<select>` nativo con las opciones únicas
    del `data` actual de esa columna (ordenadas, con opción vacía = «Todas») y filtra por
    igualdad exacta. Ambos criterios se combinan (AND) entre sí y con la búsqueda global
    existente de `filteredData`, siempre client-side.
  - Input `collapseWidth: number` (default `767`, mismo breakpoint que antes) — ver el cambio
    de fuente de verdad del colapso móvil en «Cambiado».
- `sol-icon-button` (`ui/icon-button/icon-button.component.ts`): variante `outline` —
  mismo borde y color de texto que `default`, pero con fondo transparente, para que un grupo de
  icon-buttons de acciones se vea homogéneo (todos con reborde) sin que cada uno cargue su
  propia superficie sólida compitiendo con la de al lado.
- `ICON_REGISTRY`: `arrow-down-tray`, `book-open`, `light-bulb`, `hand-thumb-up`,
  `presentation-chart-line`, `printer`, `folder` y `folder-open` (Heroicons v2.1.5, MIT — `d`
  copiado sin editar, outline y solid en los ocho).
- `sol-rating-input` (`ui/rating-input/rating-input.component.ts`): calificación INTERACTIVA de
  1 a 5 estrellas, para que una clienta califique su cita. Es un componente **aparte** de
  `sol-star-rating`, que se queda intacto y de solo lectura: mostrar un valor y capturarlo son
  contratos de accesibilidad distintos — el de solo lectura es un `role="img"` con el valor en
  el `aria-label` y estrellas `aria-hidden`, mientras que este es un `role="radiogroup"` con
  cinco `role="radio"`, `aria-checked` por estrella, navegación por teclado y una sola parada de
  tabulación. Meter ambos comportamientos en una clase detrás de una bandera obligaría a
  alternar rol, foco, tabindex y semántica en cada estrella, y degradaría los dos.
  - **Arranca sin valor, a propósito**: `value` nace en `null` y ninguna estrella queda marcada.
    Es el límite ético del principio de «valores por defecto»: una calificación pre-marcada
    ancla la respuesta y le sirve al negocio, no a quien responde — si arranca en 5, el promedio
    sube sin que nadie lo haya decidido y el dato deja de medir la experiencia. Un radiogroup
    sin opción marcada es válido en ARIA. Queda documentado en el JSDoc de la clase.
  - `ControlValueAccessor` completo, como el resto de los controles de la librería. A diferencia
    de `sol-select` y `sol-number-input` —que dejan `setDisabledState` vacío—, aquí el
    formulario **sí** manda: un `control.disable()` deshabilita de verdad el control. El input
    `disabled` sigue funcionando; el estado efectivo es la unión de ambos.
  - Teclado: `←`/`↑`/`→`/`↓` mueven el foco y marcan (patrón radiogroup), sin dar la vuelta en
    los extremos —`←` sobre la primera la marca, que es la única forma de elegir «1» con teclado
    desde el grupo vacío—; `Inicio`/`Fin` saltan a los extremos marcando; `Espacio` marca la
    estrella enfocada; `Suprimir`/`Retroceso` limpian cuando `allowClear` está activo.
  - Estados: normal, `disabled` (`aria-disabled`, sin foco), `readOnly` (`aria-readonly`, valor
    congelado pero con contraste pleno y enfocable — «esto ya no se cambia» no es lo mismo que
    «esto no es para ti») y `error` (mensaje visible con el mismo contrato de texto de
    `sol-input`, más `aria-invalid` y `aria-describedby`).
  - La vista previa al pasar el ratón pinta las estrellas pero nunca toca `value` ni
    `aria-checked`: al salir el puntero vuelve lo elegido, así que pasar por encima jamás pierde
    la respuesta.
  - `allowClear` (opcional) habilita quitar la calificación con un botón visible —fuera del
    radiogroup, para no romper la única parada de tabulación— y con `Suprimir`/`Retroceso`.
  - Cada estrella reserva 44×44 px reales de área táctil (ley de Fitts) porque se usa desde el
    celular; por eso el tamaño por defecto es `lg` y no el `sm` del componente de solo lectura.
  - Estilos solo con tokens `var(--sol-*)` (estrella elegida sobre `--sol-color-warning`, sin
    elegir sobre `--sol-color-text-muted`, error sobre `--sol-color-danger`), sin un solo color
    fijo, y con `prefers-reduced-motion` respetado. Los íconos van por `<sol-icon>` (`star`,
    `x-mark`), nunca con marcado en línea.
  - Se exporta también `normalizeRating`, la función pura que recorta cualquier entrada a `1..5`
    o `null`: un `0`, un `NaN` o un `undefined` significan «sin responder», no «cero estrellas».
- Claves i18n `shared.ratingInput.{groupLabel,option,clear}` en el catálogo `es-CO` del consumidor
  (`boki-front/src/assets/i18n/es-CO.json`). Las tres son sobreescribibles por input
  (`ariaLabelKey`, `optionLabelKey`, `clearLabelKey`) y las tres tienen respaldo es-CO propio en
  el componente, así que un host que no traduzca anuncia «3 de 5» y no la clave cruda.

### Cambiado

- `sol-data-table`: el colapso a cards en móvil ya NO decide por el viewport del navegador
  (`matchMedia`) sino por el ancho del propio elemento host, medido con `ResizeObserver`
  (nuevo input `collapseWidth`, ver «Agregado»). Una tabla dentro de un contenedor angosto
  (sidebar, grid a dos columnas) ahora colapsa aunque la ventana del navegador siga en ancho
  desktop. `matchMedia` contra el breakpoint canónico (767px) se conserva solo como valor
  inicial anti-flicker hasta la primera medición real del observer.

### Corregido

- `sol-card` (`ui/card/card.component.ts`): agrega `:host { display: block; }`. El componente
  no declaraba ningún `display` propio, así que su host colapsaba a `max-content` cuando el
  padre lo volvía flex/grid item — el borde y el fondo de `.sol-card` seguían pintándose a
  tamaño completo, pero la caja real del host no reservaba espacio, y un layout flex con varias
  `sol-card` como hijas quedaba roto (bug real reportado desde PANDORA).

## [0.5.0] - 2026-08-23

Primera tanda de aportes que vienen **desde un consumidor**: los tres componentes
nacieron dentro de Solercia Command (el producto antes llamado `gestion_proyectos`) y
suben aquí sin su dominio. El criterio de corte es el mismo en los tres: **el mecanismo
es de la librería, la orquestación se queda en la aplicación**. La propia auditoría de UI
de ese producto ya los tenía registrados como «pendientes de aporte a la librería».

### Agregado

- `sol-tree` (`ui/tree/tree.component.ts`): árbol jerárquico genérico con nodo recursivo,
  ARIA nativo (`tree`/`treeitem`/`group`, `aria-expanded`, `aria-level`), roving tabindex
  y mapa de teclado completo (flechas, Home/End, Enter/Espacio). El contenido de cada nodo
  lo aporta el consumidor por `ng-template` a través de `SolTreeNodeDefDirective`
  (`[solTreeNodeDef]`), con contexto tipado `{ $implicit, node, depth, expanded, hasChildren }`.
  `expandedIds` es un `model()` de doble modo: `null` deja la expansión en manos del
  componente (sembrada por `defaultExpandedDepth`, 1 por defecto), y cualquier arreglo
  —incluido `[]`— pasa a modo controlado; la distinción existe para separar «no me
  controles» de «todo colapsado». La semilla se recalcula por clave estructural de ids, así
  que recrear `nodes` con el mismo contenido no borra lo que el usuario ya expandió.
  Profundidad acotada por `SOL_TREE_MAX_DEPTH` (5). Emite `nodeSelected` y `nodeToggled`
  en lugar de navegar: la librería no conoce el router.
- `sol-notification-panel` (`ui/notification-panel/notification-panel.component.ts`): panel
  de notificaciones con `items` por input y cero servicios inyectados. Su `state()` es un
  `computed()` excluyente y ordenado — `loading` › `error` › `empty` › `content` — con
  `error` **antes** que `empty` a propósito: una carga fallida también deja la lista vacía,
  y si ganara `empty` el panel afirmaría «no tienes notificaciones» cuando la verdad es
  «no pudimos saberlo». El error se pinta con estructura y `role="alert"` propios, nunca
  reciclando `sol-empty-state`. Emite `itemSelected`, `markedRead`, `markedAllRead`,
  `retryRequested` y `closed`; no guarda espejo interno de `read`, así que la interfaz
  nunca afirma un cambio que el backend rechazó.
- `sol-scope-switcher` (`ui/scope-switcher/scope-switcher.component.ts`): selector de ámbito
  activo (empresa, organización, sede) sobre la directiva compartida `solFloatingPanel`.
  Lista ámbitos con etiqueta y etiqueta secundaria, resuelve el avatar por `imageUrl` o por
  iniciales, y distingue `idle`/`loading`/`error` como estados separados conservando el
  contexto anterior cuando algo falla. Con un solo ámbito lo muestra como activo sin obligar
  a elegir. `effectiveActiveId` valida que el id recibido exista en la lista antes de usarlo
  y cae al primero si no: un id persistido que ya no es válido dejaba el disparador en blanco.
  Emite `scopeSelected` y `openChange`; la persistencia, el refresco de contexto y cualquier
  cabecera HTTP son responsabilidad del anfitrión.
- `ICON_REGISTRY`: `arrow-left`, `arrow-right-on-rectangle` y `flag` (Heroicons v2, `d`
  copiados sin editar). Cierran el gap que Solercia Command había documentado en su
  auditoría de UI, donde sobrevivían como SVG inline por no existir aquí. `sitemap`, también
  pedido por esa auditoría, **no** se agrega: no existe en Heroicons v2 y la cabecera del
  registro prohíbe inventar path data.

### Notas para quien actualice

- Solercia Command mantiene un `SolDrawerComponent` local con el **mismo nombre de clase y
  el mismo selector** que el de esta librería. Su barril hace `export *` de ambas fuentes,
  así que al pasar de 0.3.0 a 0.5.0 el símbolo queda ambiguo. Hay que borrar el drawer local
  en el mismo cambio que sube la versión. La migración es corta: `position="right"` pasa a
  `side="end"`, y el input `blur` desaparece porque aquí lo resuelve el token
  `--sol-overlay-blur`.

## [0.4.1] - 2026-08-23

### Agregado

- `sol-input` (`ui/input/input.component.ts`): input opcional `min` (`string | undefined`,
  `undefined` por defecto), passthrough al atributo `min` del `<input>` nativo vía
  `[attr.min]`. Su caso de uso es `type="date"`: fija la fecha mínima seleccionable para
  que el selector nativo del navegador no permita agendar al pasado (ola-09, P3b). Con
  `[attr.min]` Angular omite el atributo por completo cuando el valor es `undefined`, así
  que ningún consumidor existente cambia de comportamiento — mismo patrón aditivo del
  input `autocomplete`.

## [0.4.0] - 2026-08-08

> Entrada reconstruida a posteriori (2026-08-23): la versión se publicó a npm sin registrarse
> en este archivo.

### Agregado

- `sol-star-rating` (`ui/star-rating/star-rating.component.ts`): componente de calificación
  por estrellas, exportado desde la API pública (`ui/index.ts`).
- Íconos de estrella en `ICON_REGISTRY` (`ui/icon/icon.registry.ts`) que consume el
  componente anterior.

## [0.3.1] - 2026-07-20

### Agregado

- `solFloatingPanel` (`ui/overlay/floating-panel.directive.ts`): primitiva compartida que
  portalea un panel flotante a `document.body` con `position: fixed` y coordenadas del
  viewport calculadas manualmente (sin `@floating-ui/dom` ni `popper.js`, prohibidas por
  la filosofía del proyecto). Nace de extraer el arreglo CP-2 que vivía inline en
  `sol-select`, para que cualquier componente cuyo panel deba flotar POR ENCIMA de un
  `sol-modal` o un `sol-drawer` no quede recortado por ancestros con `overflow` o
  `backdrop-filter` (típicamente `.sol-modal-body`). API: input requerido `trigger`
  (alias del propio selector), `gap` (4), `flipThreshold` (300), `matchTriggerWidth`
  (`true`), `align` (`'start'`/`'end'`), señal de solo lectura `dropUp` + salida
  `dropUpChange` para que el host aplique su clase modificadora, y método público
  `reposition()`. Aporta la clase compartida `.sol-floating-panel` con
  `z-index: calc(var(--sol-z-modal, 1050) + 10)`, inyectada una sola vez en
  `document.head` (el panel portaleado deja de heredar del host, así que el `z-index` no
  puede vivir en estilos encapsulados por componente).

### Cambiado

- `sol-select` consume la directiva en vez de su portal inline: se eliminan
  `attachPanel`/`detachPanel`/`positionPanel`, el `effect` del constructor y el estado
  `portalPanel`. Comportamiento observable idéntico — las 7 specs del portal (CP-2)
  pasan sin tocarse. El `z-index` sale de `.sol-select__dropdown` y lo aporta la clase
  compartida.
- `sol-date-picker` migra su popover de calendario al portal compartido
  (`matchTriggerWidth: false` porque el calendario tiene ancho propio de 300px, `align`
  por el borde derecho cuando no cabe hacia la derecha, `flipThreshold` igual a su alto
  estimado de 340px). Conserva el volteo `dropUp` y gana reposicionamiento en scroll y
  resize, que antes no tenía. El popover deja de ser descendiente del host, así que el
  cierre por clic-fuera y el foco de la celda activa (roving tabindex) ahora consultan el
  nodo portaleado.

### Notas

- Alcance deliberadamente acotado (decisión del fundador): la directiva aplica SOLO a
  componentes con un elemento que flota por encima del modal o del `sol-drawer`.
  `sol-rich-editor` NO se toca — sus popovers están clampados dentro del host a
  propósito y no desbordan; `sol-tooltip` tampoco (sin usos en la aplicación).
- Superficie pública sin cambios: la directiva es interna a la librería (vive en
  `ui/overlay/`, junto a `body-scroll-lock`, `focus-trap` y `overlay-interactions`, que
  tampoco se exportan desde `lib/ui/index.ts`) — todavía no hay consumidor externo que
  la necesite.
- Dos detalles del portal que se preservaron literalmente al extraerlo, porque sin ellos
  el arreglo deja de funcionar: el listener de `scroll` va con `{ capture: true }` (los
  eventos de scroll no burbujean, y sin captura el panel no se entera del scroll de
  `.sol-modal-body`), y el `removeChild` va guardado por
  `parentNode === document.body` (Angular puede haber destruido el nodo por su cuenta).
- 1280/1280 tests de la librería en verde (20 nuevos: 12 de `solFloatingPanel` y 8 del
  portal del popover de `sol-date-picker`).

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

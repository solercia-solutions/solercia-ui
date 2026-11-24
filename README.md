# Solercia UI

Design system de Solercia para Angular: componentes `sol-*`, theming agnóstico por puertos
(tokens `--sol-*`), contrato de i18n y schematics de `ng add` / `ng generate`.

```bash
npm install @solercia/ui
ng add @solercia/ui
```

La documentación del paquete está en [`projects/solercia/ui/README.md`](projects/solercia/ui/README.md),
con las guías de [theming](projects/solercia/ui/docs/THEMING.md) e
[i18n](projects/solercia/ui/docs/I18N.md). Los cambios por versión están en el
[CHANGELOG](projects/solercia/ui/CHANGELOG.md).

## Desarrollo

Requiere Node 22.14 o superior.

```bash
npm ci
npm run build   # dist/solercia/ui: librería, entry points y schematics
npm test        # compila y corre las pruebas con Vitest
```

| Ruta | Contenido |
|---|---|
| `projects/solercia/ui/src/lib` | Componentes, tokens, i18n y utilidades de la librería |
| `projects/solercia/ui/login-appearance` | Entry point `@solercia/ui/login-appearance` |
| `projects/solercia/ui/theme-studio` | Entry point `@solercia/ui/theme-studio` |
| `projects/solercia/ui/schematics` | `ng add` y generadores (`page`, `feature`, `widget`, `entity`) |
| `projects/solercia/ui/i18n` | Catálogo `es-CO` de las claves que usan los componentes |

Para probar un cambio en un proyecto consumidor antes de publicarlo:
`npm run build && cd dist/solercia/ui && npm pack`, e instalar el `.tgz` en el consumidor.

## Reglas de estilo para consumidores

El preset [`@solercia/eslint-config`](https://github.com/solercia-solutions/eslint-config) hace
cumplir en los proyectos consumidores la arquitectura FSD y el uso de las variables del tema.

## Licencia

`Apache-2.0` © 2026 Solercia Solutions SAS. Ver [`LICENSE`](LICENSE).

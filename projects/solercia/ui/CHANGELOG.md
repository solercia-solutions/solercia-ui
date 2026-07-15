# Changelog — @solercia/ui

Todos los cambios notables de este paquete se documentan en este archivo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado es
[SemVer](https://semver.org/lang/es/) (decisión D2: se inicia en `0.1.0` pre-1.0, mientras el
paquete tiene solo dos consumidores potenciales — `boki-front` y, próximamente, `gestion_proyectos`
— y puede admitir cambios incompatibles en versiones `minor`).

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

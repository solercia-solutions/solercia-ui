#!/usr/bin/env bash
#
# Publica un paquete en npm SOLO si su versión todavía no existe en el registro.
#
# Uso: bash .github/scripts/publish-if-unpublished.sh <directorio-del-paquete>
#
# Por qué existe: el workflow publica los dos paquetes con cada tag `v*`, pero
# cada paquete lleva su propia versión. Un tag que solo sube la UI intentaba
# volver a publicar `@solercia/eslint-config` con la misma versión, npm lo
# rechazaba (no se publica dos veces la misma versión) y el job quedaba en
# rojo aunque la UI hubiera salido bien.
#
# Reglas:
#   - La versión ya existe en npm  -> se omite, con un aviso en el log.
#   - npm responde 404 (no existe) -> se publica.
#   - Cualquier otra falla al consultar (red, registro caído) -> el job falla:
#     nunca se publica a ciegas.
set -euo pipefail

package_dir="${1:?Uso: publish-if-unpublished.sh <directorio-del-paquete>}"
manifest="${package_dir%/}/package.json"

if [ ! -f "$manifest" ]; then
  echo "::error title=Paquete no encontrado::No existe $manifest" >&2
  exit 1
fi

manifest_path="$(cd "$(dirname "$manifest")" && pwd)/package.json"
name="$(node -p "require(process.argv[1]).name" "$manifest_path")"
version="$(node -p "require(process.argv[1]).version" "$manifest_path")"

stderr_file="$(mktemp)"
trap 'rm -f "$stderr_file"' EXIT

set +e
published="$(npm view "${name}@${version}" version 2>"$stderr_file")"
view_status=$?
set -e
view_errors="$(<"$stderr_file")"

if [ "$view_status" -eq 0 ] && [ "${published##*$'\n'}" = "$version" ]; then
  echo "::notice title=Publicación omitida::${name}@${version} ya está publicado en npm; no se vuelve a publicar."
  exit 0
fi

if [ "$view_status" -ne 0 ] && [[ "$view_errors" != *E404* ]]; then
  echo "::error title=No fue posible consultar npm::${name}@${version}: ${view_errors}" >&2
  exit 1
fi

echo "Publicando ${name}@${version}..."
(cd "$package_dir" && npm publish --access public)
echo "::notice title=Publicado::${name}@${version}"

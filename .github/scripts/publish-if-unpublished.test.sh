#!/usr/bin/env bash
#
# Prueba de `publish-if-unpublished.sh` con un npm falso: sin red, sin
# registro y sin publicar nada de verdad. La corre CI en cada push.
#
# Uso: bash .github/scripts/publish-if-unpublished.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/bin" "$work/pkg"
printf '{"name":"@solercia/prueba","version":"1.2.3"}\n' > "$work/pkg/package.json"

# npm falso: `view` responde según FAKE_NPM_VIEW y `publish` solo deja rastro.
cat > "$work/bin/npm" <<'FAKE'
#!/usr/bin/env bash
case "$1" in
  view)
    case "${FAKE_NPM_VIEW:-}" in
      published) echo "1.2.3" ;;
      missing) echo "npm error code E404" >&2; exit 1 ;;
      down) echo "npm error code ECONNREFUSED" >&2; exit 1 ;;
    esac
    ;;
  publish)
    echo "publish $*" >> "$FAKE_NPM_LOG"
    ;;
esac
FAKE
chmod +x "$work/bin/npm"

run() {
  FAKE_NPM_VIEW="$1" FAKE_NPM_LOG="$work/publish.log" PATH="$work/bin:$PATH" \
    bash "$here/publish-if-unpublished.sh" "$work/pkg"
}

fail() {
  echo "FALLA: $*" >&2
  exit 1
}

: > "$work/publish.log"
run published > /dev/null || fail "una versión ya publicada debe terminar sin error"
[ ! -s "$work/publish.log" ] || fail "una versión ya publicada no se vuelve a publicar"

: > "$work/publish.log"
run missing > /dev/null || fail "una versión nueva debe terminar sin error"
[ "$(wc -l < "$work/publish.log" | tr -d ' ')" = "1" ] || fail "una versión nueva se publica exactamente una vez"

: > "$work/publish.log"
if run down > /dev/null 2>&1; then
  fail "si no se puede consultar npm, el job debe fallar"
fi
[ ! -s "$work/publish.log" ] || fail "con el registro caído no se publica a ciegas"

echo "publish-if-unpublished: 3 de 3 casos en verde"

#!/usr/bin/env bash
# Build the pi-bridge release artifact and signed manifest inputs.
#
# Usage:
#   bridge/deploy/package-bridge.sh [version]
#
# Outputs under dist/bridge-release/:
#   pi-bridge-<version>.tar.gz
#   bridge-release.json
#   bridge-release.json.sig      (only when RELEASE_SIGNING_KEY_PEM is set)

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
VERSION="${1:-$(node -p "require('$ROOT/package.json').version")}" 
OUT_DIR="$ROOT/dist/bridge-release"
STAGE="$OUT_DIR/stage/pi-bridge-$VERSION"
ARTIFACT="pi-bridge-$VERSION.tar.gz"
rm -rf "$OUT_DIR/stage"
mkdir -p "$STAGE" "$OUT_DIR"

cp "$ROOT/package.json" "$ROOT/pnpm-lock.yaml" "$ROOT/pnpm-workspace.yaml" "$STAGE/"
cp -a "$ROOT/bridge" "$ROOT/packages" "$STAGE/"
printf '%s\n' "$VERSION" >"$STAGE/VERSION"

find "$STAGE" -type d \( -name node_modules -o -name dist \) -prune -exec rm -rf {} +
find "$STAGE" -name '*.tsbuildinfo' -delete

tar -C "$OUT_DIR/stage" -czf "$OUT_DIR/$ARTIFACT" "pi-bridge-$VERSION"
SHA256="$(sha256sum "$OUT_DIR/$ARTIFACT" | awk '{print $1}')"

(cd "$ROOT" && pnpm --filter pi-bridge exec tsx deploy/admin.ts package-release "$VERSION" "$ARTIFACT" "$SHA256") >"$OUT_DIR/bridge-release.json"

if [[ -n "${RELEASE_SIGNING_KEY_PEM:-}" ]]; then
  KEY_FILE="$OUT_DIR/signing-key.pem"
  printf '%s' "$RELEASE_SIGNING_KEY_PEM" >"$KEY_FILE"
  chmod 0600 "$KEY_FILE"
  openssl dgst -sha256 -sign "$KEY_FILE" -out "$OUT_DIR/bridge-release.json.sig" "$OUT_DIR/bridge-release.json"
  rm -f "$KEY_FILE"
fi

echo "$OUT_DIR/$ARTIFACT"
echo "$OUT_DIR/bridge-release.json"
[[ ! -f "$OUT_DIR/bridge-release.json.sig" ]] || echo "$OUT_DIR/bridge-release.json.sig"

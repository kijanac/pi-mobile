#!/usr/bin/env bash
# Release-based pi-bridge updater with atomic symlink switch and rollback.

set -euo pipefail

APP_DIR="${PI_BRIDGE_INSTALL_DIR:-/opt/pi-mobile-workspace}"
DATA_DIR="${PI_BRIDGE_DATA_DIR:-/var/lib/pi-bridge}"
RELEASES_DIR="$APP_DIR/releases"
CURRENT_LINK="$APP_DIR/current"
STATE_FILE="$DATA_DIR/update-state.json"
REPO="${PI_BRIDGE_RELEASE_REPO:-kijanac/pi-mobile}"
CHANNEL="${PI_BRIDGE_UPDATE_CHANNEL:-stable}"
PUBLIC_KEY="${PI_BRIDGE_UPDATE_PUBLIC_KEY:-/etc/pi-bridge/update-public-key.pem}"
TMP_DIR="$(mktemp -d)"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

log() { printf '[pi-bridge-update] %s\n' "$*"; }
fatal() { printf '[pi-bridge-update] ERROR: %s\n' "$*" >&2; exit 1; }

version_gt() {
  node -e '
    const [a,b]=process.argv.slice(1);
    const pa=a.replace(/^v/,"").split(".").map(Number);
    const pb=b.replace(/^v/,"").split(".").map(Number);
    for (let i=0;i<Math.max(pa.length,pb.length);i++) {
      const d=(pa[i]||0)-(pb[i]||0);
      if (d>0) process.exit(0);
      if (d<0) process.exit(1);
    }
    process.exit(1);
  ' "$1" "$2"
}

json_get() {
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(process.argv[2].split('.').reduce((o,k)=>o?.[k], data) ?? '')" "$1" "$2"
}

mkdir -p "$RELEASES_DIR" "$DATA_DIR"

CURRENT_VERSION="0.0.0"
if [[ -e "$CURRENT_LINK/VERSION" ]]; then
  CURRENT_VERSION="$(tr -d '[:space:]' <"$CURRENT_LINK/VERSION")"
fi
LAST_SEEN="$CURRENT_VERSION"
if [[ -f "$STATE_FILE" ]]; then
  LAST_SEEN="$(node -e 'const fs=require("fs"); try { console.log(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).lastSeenVersion || "0.0.0") } catch { console.log("0.0.0") }' "$STATE_FILE")"
fi

log "current=$CURRENT_VERSION lastSeen=$LAST_SEEN channel=$CHANNEL repo=$REPO"

API_URL="https://api.github.com/repos/$REPO/releases/latest"
RELEASE_JSON="$TMP_DIR/release.json"
curl -fsSL "$API_URL" -o "$RELEASE_JSON"

TAG="$(json_get "$RELEASE_JSON" tag_name)"
VERSION="${TAG#v}"
[[ -n "$VERSION" ]] || fatal "latest release has no tag_name"

if ! version_gt "$VERSION" "$CURRENT_VERSION"; then
  log "no newer release ($VERSION)"
  exit 0
fi
if version_gt "$LAST_SEEN" "$VERSION"; then
  fatal "refusing rollback from last seen $LAST_SEEN to $VERSION"
fi
if [[ -f "$STATE_FILE" ]] && node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.exit((s.failedVersions||[]).includes(process.argv[2]) ? 0 : 1)' "$STATE_FILE" "$VERSION"; then
  fatal "refusing previously failed version $VERSION"
fi

ASSETS_JSON="$TMP_DIR/assets.json"
node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); fs.writeFileSync(process.argv[2], JSON.stringify(r.assets||[]));' "$RELEASE_JSON" "$ASSETS_JSON"
asset_url() {
  node -e 'const fs=require("fs"); const assets=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const name=process.argv[2]; const a=assets.find(x=>x.name===name); if (!a) process.exit(1); console.log(a.browser_download_url);' "$ASSETS_JSON" "$1"
}

MANIFEST_URL="$(asset_url bridge-release.json)" || fatal "bridge-release.json asset missing"
SIG_URL="$(asset_url bridge-release.json.sig || true)"
MANIFEST="$TMP_DIR/bridge-release.json"
SIG="$TMP_DIR/bridge-release.json.sig"
curl -fsSL "$MANIFEST_URL" -o "$MANIFEST"

[[ -n "$SIG_URL" ]] || fatal "bridge-release.json.sig asset missing; refusing unsigned update"
curl -fsSL "$SIG_URL" -o "$SIG"
[[ -f "$PUBLIC_KEY" ]] || fatal "manifest signature present but public key not found: $PUBLIC_KEY"
openssl dgst -sha256 -verify "$PUBLIC_KEY" -signature "$SIG" "$MANIFEST" >/dev/null || fatal "manifest signature verification failed"
log "manifest signature verified"

MANIFEST_VERSION="$(json_get "$MANIFEST" version)"
ARTIFACT="$(json_get "$MANIFEST" artifact.name)"
EXPECTED_SHA="$(json_get "$MANIFEST" artifact.sha256)"
[[ "$MANIFEST_VERSION" == "$VERSION" ]] || fatal "manifest version $MANIFEST_VERSION does not match release $VERSION"
[[ -n "$ARTIFACT" && -n "$EXPECTED_SHA" ]] || fatal "manifest missing artifact name or sha256"
node -e '
  const fs=require("fs");
  const path=process.argv[1];
  const version=process.argv[2];
  let state={};
  try { state=JSON.parse(fs.readFileSync(path,"utf8")); } catch {}
  state.lastSeenVersion=version;
  state.lastSeenAt=Date.now();
  fs.writeFileSync(path, JSON.stringify(state, null, 2));
' "$STATE_FILE" "$VERSION"

ARTIFACT_URL="$(asset_url "$ARTIFACT")" || fatal "$ARTIFACT asset missing"
ARCHIVE="$TMP_DIR/$ARTIFACT"
curl -fL "$ARTIFACT_URL" -o "$ARCHIVE"
printf '%s  %s\n' "$EXPECTED_SHA" "$ARCHIVE" | sha256sum -c - >/dev/null || fatal "artifact checksum failed"
log "artifact checksum verified"

TARGET="$RELEASES_DIR/$VERSION"
rm -rf "$TARGET.tmp" "$TARGET"
mkdir -p "$TARGET.tmp"
tar -C "$TARGET.tmp" --strip-components=1 -xzf "$ARCHIVE"
cd "$TARGET.tmp"
pnpm --filter pi-bridge... install --prod --frozen-lockfile
cd /
chown -R pi-bridge:pi-bridge "$TARGET.tmp"
mv "$TARGET.tmp" "$TARGET"

PREVIOUS=""
[[ ! -L "$CURRENT_LINK" ]] || PREVIOUS="$(readlink -f "$CURRENT_LINK")"
ln -sfn "$TARGET" "$CURRENT_LINK"

log "restarting pi-bridge on $VERSION"
if ! systemctl restart pi-bridge; then
  [[ -z "$PREVIOUS" ]] || ln -sfn "$PREVIOUS" "$CURRENT_LINK"
  systemctl restart pi-bridge || true
  fatal "restart failed; rolled back"
fi

if ! sh -c 'for i in $(seq 1 30); do curl -fsS --max-time 5 http://127.0.0.1:7777/healthz >/dev/null && exit 0; sleep 1; done; exit 1'; then
  log "health check failed; rolling back"
  [[ -z "$PREVIOUS" ]] || ln -sfn "$PREVIOUS" "$CURRENT_LINK"
  systemctl restart pi-bridge || true
  node -e '
    const fs=require("fs");
    const path=process.argv[1];
    const version=process.argv[2];
    let state={};
    try { state=JSON.parse(fs.readFileSync(path,"utf8")); } catch {}
    state.failedVersions=Array.from(new Set([...(state.failedVersions||[]), version]));
    state.failedAt=Date.now();
    fs.writeFileSync(path, JSON.stringify(state, null, 2));
  ' "$STATE_FILE" "$VERSION"
  fatal "health check failed"
fi

node -e '
  const fs=require("fs");
  const path=process.argv[1];
  const version=process.argv[2];
  let state={};
  try { state=JSON.parse(fs.readFileSync(path,"utf8")); } catch {}
  state.currentVersion=version;
  state.lastSeenVersion=version;
  state.updatedAt=Date.now();
  fs.writeFileSync(path, JSON.stringify(state, null, 2));
' "$STATE_FILE" "$VERSION"

log "updated to $VERSION"

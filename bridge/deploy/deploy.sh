#!/usr/bin/env bash
# pi-bridge push deploy from laptop.
#
# Usage:
#   PI_BRIDGE_HOST=root@mybox ./deploy/deploy.sh
#
# Run from anywhere; the script anchors itself to its own location so
# rsync sources from the correct tree. Assumes install.sh has already
# run on the server.

set -euo pipefail

HOST="${PI_BRIDGE_HOST:-}"
if [[ -z "$HOST" ]]; then
  echo "PI_BRIDGE_HOST not set. Example:" >&2
  echo "  PI_BRIDGE_HOST=root@1.2.3.4 ./deploy/deploy.sh" >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
REMOTE=/opt/pi-bridge

step() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

step "preflight"
ssh -o ConnectTimeout=5 "$HOST" "test -d $REMOTE && id pi-bridge >/dev/null 2>&1" \
  || { echo "  server isn't set up — run deploy/install.sh on it first" >&2; exit 1; }
echo "  $HOST:$REMOTE ready"

step "rsync source"
# Push everything except local-only artifacts (data, deps, scratch
# scripts, the deploy/ dir itself).
rsync -av --delete \
  --exclude='data/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='.git/' \
  --exclude='smoke*' \
  --exclude='faux-direct*' \
  --exclude='deploy/' \
  --exclude='README.md' \
  "$ROOT/" "$HOST:$REMOTE/"

step "pnpm install (prod)"
ssh "$HOST" "cd $REMOTE && \
  corepack enable && \
  pnpm install --prod --frozen-lockfile && \
  chown -R pi-bridge:pi-bridge $REMOTE"

step "restart"
ssh "$HOST" "systemctl restart pi-bridge && sleep 2 && systemctl is-active pi-bridge"

step "verify"
# Health-check via tailscale (works whether or not `tailscale serve` is
# proxying yet, since we hit the box from its own loopback over ssh).
if ssh "$HOST" "curl -fsS --max-time 3 http://127.0.0.1:7777/healthz" >/dev/null; then
  echo "  /healthz ok"
else
  echo "  /healthz FAILED — check 'journalctl -u pi-bridge -n 30'" >&2
  exit 1
fi

step "done"
ssh "$HOST" "systemctl status pi-bridge --no-pager -n 5"

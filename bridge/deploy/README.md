# pi-bridge deployment

Target shape: a single Hetzner (or any Linux) VPS reachable only over
Tailscale, running pi-bridge under systemd, with `tailscale serve`
providing the HTTPS endpoint the mobile app talks to.

## Why this shape

- **No public exposure.** The bridge has no auth; it must not sit on
  the open internet. Binding to `127.0.0.1` + `tailscale serve` is a
  tighter perimeter than `0.0.0.0` + firewall rules — wrong rule, no
  exposure.
- **HTTPS is solved.** iOS App Transport Security blocks plain HTTP,
  and the Capacitor WebView is no different. `tailscale serve` mints
  Let's Encrypt certs for `*.<your-tailnet>.ts.net` for free, so the
  mobile gets a proper `https://` URL with zero cert maintenance.
- **One box, one process.** A single-user agent bridge doesn't need
  Docker, k8s, or load balancing. systemd + restart-on-failure is
  enough and stays diagnosable through `journalctl`.

## Prereqs

- A Linux VPS you can SSH into as root (Hetzner CX11 is plenty —
  ~$5/mo, 2 GB RAM, more than this needs).
- A Tailscale account; both the VPS and your phone joined to the same
  tailnet (you'll authenticate the VPS during install, the phone via
  the Tailscale iOS/Android app).
- An Anthropic API key.
- SSH key auth set up (the install + deploy scripts assume `ssh` Just
  Works for the target host).

## First-time install — on the server

```sh
# from your laptop
scp -r deploy/ root@YOURBOX:/tmp/pi-bridge-deploy/
ssh root@YOURBOX 'bash /tmp/pi-bridge-deploy/install.sh'
```

`install.sh` is idempotent — re-running it is safe (won't clobber
`/etc/pi-bridge/env`). It:

1. Creates the `pi-bridge` system user, `/opt/pi-bridge` source dir,
   `/var/lib/pi-bridge` data dir.
2. Installs node 24+ (NodeSource), pnpm 10.5.2 (via corepack),
   tailscale (via the official install script) if any are missing.
3. Drops the systemd unit, enables it (doesn't start it yet).
4. Seeds `/etc/pi-bridge/env` from `env.example` *only if it doesn't
   already exist*.

After it finishes, edit `/etc/pi-bridge/env` to set
`ANTHROPIC_API_KEY=sk-ant-...`.

## Deploy the source — from your laptop

```sh
PI_BRIDGE_HOST=root@YOURBOX ./deploy/deploy.sh
```

This rsyncs `src/`, `package.json`, `pnpm-lock.yaml`, and
`tsconfig.json` to `/opt/pi-bridge`, runs `pnpm install --prod
--frozen-lockfile` on the server, restarts the service, and hits
`/healthz` to confirm the boot succeeded.

`data/`, `node_modules/`, smoke scripts, and the demo `faux-direct.mjs`
are excluded — the box doesn't need them.

Re-run this script for every deploy. The bridge has no migration story
yet (SQLite tables use `CREATE TABLE IF NOT EXISTS`); a schema change
will require manual intervention until that's built out.

## Tailscale serve — one time per box

`tailscale serve` is what gives the mobile a working `https://` URL
backed by a real Let's Encrypt cert.

```sh
ssh root@YOURBOX
tailscale up                                            # if not already up
tailscale cert  $(tailscale status --json | jq -r .Self.DNSName | sed 's/\.$//')
tailscale serve --bg --https=443 http://localhost:7777
tailscale serve status                                  # confirm the route
```

The output of `tailscale serve status` shows the public URL — something
like `https://<hostname>.<tailnet>.ts.net`. That's what the mobile app
goes into.

## Mobile config

1. Install the Tailscale app on the phone, sign in to the same tailnet
   as the VPS.
2. Open pi-mobile → Settings → set "Bridge URL" to the tailnet HTTPS
   URL from the previous step.
3. Pull-to-refresh on the session list to confirm the connection.

The mobile's `connectStream` auto-upgrades `https://` → `wss://` for
the WebSocket, so the single setting covers both transports.

## Operations cheatsheet

```sh
# logs (tail)
journalctl -u pi-bridge -f

# logs (last 200 lines)
journalctl -u pi-bridge -n 200 --no-pager

# restart
systemctl restart pi-bridge

# rotate the Anthropic key
sudo $EDITOR /etc/pi-bridge/env && systemctl restart pi-bridge

# inspect state
ls -la /var/lib/pi-bridge/                              # sqlite db + pi sessions
sqlite3 /var/lib/pi-bridge/bridge.db '.tables'

# disable temporarily
systemctl stop pi-bridge

# fully remove (irreversible — drops the DB and session JSONLs)
systemctl disable --now pi-bridge
rm -rf /opt/pi-bridge /var/lib/pi-bridge /etc/pi-bridge /etc/systemd/system/pi-bridge.service
systemctl daemon-reload
userdel pi-bridge
```

## What this deploy does not do

- **No multi-user.** The bridge assumes a single human is on the other
  side of the WS. There's no user identity in the protocol; anyone
  with the tailnet URL can drive any session.
- **No backups.** Snapshot `/var/lib/pi-bridge/` if the conversation
  history matters to you — it's the SQLite DB plus pi's per-cwd JSONLs
  under `.pi/agent/sessions/`.
- **No migrations.** Schema changes to `bridge.db` will require manual
  SQL until a proper migration story lands.
- **No metrics.** If you want Prometheus/etc., add an exporter. Right
  now observability is "tail journalctl".

## Troubleshooting

**`systemctl is-active pi-bridge` reports `failed`.** Check
`journalctl -u pi-bridge -n 50`. Most common: `/etc/pi-bridge/env`
doesn't have `ANTHROPIC_API_KEY` set, or the value is wrapped in
quotes (don't quote in env files).

**Mobile connects but `/healthz` 404s.** The `tailscale serve` route
isn't pointing at port 7777 — re-run the `tailscale serve` command
and check `tailscale serve status`.

**Mobile shows "connecting" forever.** The Tailscale app on the phone
isn't connected to the tailnet, or the tailnet name in the URL is
wrong (use the literal output from `tailscale serve status`, not what
you remember it being).

**WS close code 4004 on every reconnect.** The session id the mobile
is holding doesn't exist on the bridge — either pi's on-disk JSONL was
removed under `/var/lib/pi-bridge/.pi/`, or you deployed onto a fresh
box and the mobile is still trying to resume an old session id. The
mobile recognizes 4004 as terminal and shows the "session no longer
available" pane; pull back to the list and start fresh.

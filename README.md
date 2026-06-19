# Pico workspace

Pico is an independent, unofficial mobile companion for the Pi coding agent.

## Projects

| Path | Purpose |
| --- | --- |
| [`packages/host-runtime/`](./packages/host-runtime) | Current Node/TypeScript Pico host runtime package (`@pico/host-runtime`). |
| [`packages/host/`](./packages/host) | Reusable Pico host facade/helpers (`@pico/host`: doctor checks, pairing, service install, local admin client). |
| [`packages/cli/`](./packages/cli) | Experimental `pico` host CLI (`pair`, `doctor`, `install`, `status`). |
| [`pi-mobile/`](./pi-mobile) | Pico Svelte + Capacitor mobile client. |
| [`packages/protocol/`](./packages/protocol) | Shared Valibot schemas and TypeScript types for the REST/WS protocol. |

## Requirements

- Node.js 26.1+
- pnpm 10.5.2+
- a working `pi` CLI setup in the project you want to use from mobile
- pi provider credentials for live host mode, or `PI_USE_MOCK=1` for mock mode

## Install

```bash
pnpm install
```

This is a pnpm workspace; install from the repository root rather than from each package directory.

## Development

```bash
# Terminal 1: Pico host with mocked pi responses
pnpm dev:host:mock

# Terminal 2: mobile web app
pnpm dev:mobile
```

Then open the Vite URL printed by `pico`.

For live pi instead of mock mode:

```bash
pnpm dev:host
```

## Checks

```bash
pnpm check
```

This typechecks the protocol, host runtime/helper packages, CLI, and builds the mobile app.

## Repository layout

```text
.
├── packages/host-runtime/ # current Pico host runtime package (@pico/host-runtime)
├── packages/host/         # reusable host facade/helpers (@pico/host)
├── packages/cli/          # experimental pico host CLI
├── packages/protocol/     # shared protocol schemas/types
├── pi-mobile/           # Pico Svelte + Capacitor client
├── package.json         # root workspace scripts
├── pnpm-workspace.yaml  # workspace package list
└── README.md            # this file
```

## Notes

- The original tarballs are import artifacts and are ignored by git.
- Runtime Pico host data (`data/`, SQLite files) is ignored by git.
- Pico is not affiliated with or endorsed by Earendil Inc. or the Pi project.
- The host runtime, CLI, and mobile app all import protocol types from `@pico/protocol`.
- Pico embeds the Pi SDK package for predictable integration, but it uses the current OS user's normal `~/.pi/agent`, git/SSH config, and project directory.

## iPhone native shell

Install dependencies from the workspace root first:

```bash
pnpm install
```

Then create/open the iOS project:

```bash
pnpm --filter pico build
pnpm --filter pico exec cap add ios   # first time only
pnpm --filter pico exec cap sync ios
pnpm --filter pico exec cap open ios
```

## Pico host pairing (experimental)

For a desktop or existing SSH box, run a foreground Pico host as the current
OS user and pair the phone with a one-time claim token:

```bash
pi --offline --list-models
pnpm run doctor
pnpm pair
```

This uses your normal Pi environment (`$HOME`, `~/.pi/agent`, git/SSH config)
and exposes `127.0.0.1:7777` through `tailscale serve`. Open the printed
`pico://connect?...` link on the phone to save and claim the host.

Useful host commands:

```bash
pnpm run status       # local admin + Tailscale status
pnpm run pair-code    # reprint the current pairing QR/link
pnpm run pair-code -- --rotate # rotate the local pairing token, then print a QR/link
pnpm run serve        # durable foreground host, used by services
pnpm run install:host # install a LaunchAgent/systemd --user service
```

## Remote Pico host + iPhone

The intended production shape is:

```text
iPhone app ──Tailscale HTTPS/WSS──> Hetzner VPS: tailscale serve ──localhost──> Pico host (pico-host service) ──> pi agent
```

See [`packages/host-runtime/deploy/README.md`](./packages/host-runtime/deploy/README.md) for the current server-appliance setup. In short: run `packages/host-runtime/deploy/install.sh` on the VPS, deploy with `PICO_DEPLOY_HOST=root@YOURBOX ./packages/host-runtime/deploy/deploy.sh`, authenticate pi either by running `/login` as the `pico-host` server user or by setting API-key env vars in `/etc/pico-host/env`, expose `localhost:7777` with `tailscale serve`, then enter that `https://…ts.net` host URL in the iPhone app Settings.

# pi mobile workspace

This repository contains the mobile client and local bridge for using the pi coding agent from a phone.

## Projects

| Path | Purpose |
| --- | --- |
| [`bridge/`](./bridge) | Node/TypeScript REST + WebSocket bridge between pi-mobile and the pi coding agent. |
| [`pi-mobile/`](./pi-mobile) | Solid + Capacitor mobile client. |

## Requirements

- Node.js 24+
- pnpm 10.5.2+
- pi provider credentials for live bridge mode, or `PI_USE_MOCK=1` for mock mode

## Install

```bash
pnpm install
```

This is a pnpm workspace; install from the repository root rather than from each package directory.

## Development

```bash
# Terminal 1: bridge with mocked pi responses
pnpm dev:bridge:mock

# Terminal 2: mobile web app
pnpm dev:mobile
```

Then open the Vite URL printed by `pi-mobile`.

For live pi instead of mock mode:

```bash
pnpm dev:bridge
```

## Checks

```bash
pnpm check
```

This typechecks the bridge and builds the mobile app.

## Repository layout

```text
.
├── bridge/              # pi bridge service
├── pi-mobile/           # Solid + Capacitor client
├── package.json         # root workspace scripts
├── pnpm-workspace.yaml  # workspace package list
└── README.md            # this file
```

## Notes

- The original tarballs are import artifacts and are ignored by git.
- Runtime bridge data (`bridge/data/`, SQLite files) is ignored by git.
- `bridge/src/protocol.ts` and `pi-mobile/src/lib/types.ts` currently duplicate the wire protocol; if this grows, extract a shared `packages/protocol` workspace package.

# Agent notes

## Workspace

This is a pnpm monorepo with two workspace packages:

- `bridge/` (`pi-bridge`): Node 24+ TypeScript bridge. Main checks: `pnpm --filter pi-bridge typecheck`.
- `pi-mobile/` (`pi-mobile`): Solid + Capacitor client. Main check: `pnpm --filter pi-mobile build`.

Run commands from the repository root.

## Useful commands

```bash
pnpm install
pnpm dev:bridge:mock
pnpm dev:mobile
pnpm check
```

## Important conventions

- Do not commit tarballs; they are import artifacts and ignored by `.gitignore`.
- Do not commit bridge runtime databases or local `.env*` files.
- Keep the bridge wire protocol and mobile protocol types in sync:
  - `bridge/src/protocol.ts`
  - `pi-mobile/src/lib/types.ts`
- If protocol churn continues, prefer extracting a shared `packages/protocol` workspace package instead of hand-copying types.

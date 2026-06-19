# Agent notes

## Workspace

This is a pnpm monorepo with workspace packages:

- `packages/host-runtime/` (`@pico/host-runtime`): Node 26.1+ TypeScript Pico host runtime. Main check: `pnpm --filter @pico/host-runtime typecheck`.
- `packages/host/` (`@pico/host`): Reusable host facade/helpers. Main check: `pnpm --filter @pico/host typecheck`.
- `packages/cli/` (`@pico/cli`): Host CLI. Main check: `pnpm --filter @pico/cli typecheck`.
- `packages/protocol/` (`@pico/protocol`): Shared REST/WS Valibot schemas and derived TypeScript types.
- `pi-mobile/` (`pico`): Svelte + Capacitor client. Main check: `pnpm --filter pico build`.

Run commands from the repository root.

## Useful commands

```bash
pnpm install
pnpm dev:host:mock
pnpm dev:mobile
pnpm check
```

## Important conventions

- Do not commit tarballs; they are import artifacts and ignored by `.gitignore`.
- Do not commit Pico host runtime databases or local `.env*` files.
- Keep protocol changes in `packages/protocol/src/index.ts`; host and mobile packages import `@pico/protocol`.
- Deployment scripts live in `packages/host-runtime/deploy/` but deploy from the workspace root because the Pico host depends on `packages/protocol`.

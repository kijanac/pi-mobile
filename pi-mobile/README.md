# pi-mobile

A Solid + Capacitor mobile client for the [pi.dev](https://pi.dev) coding agent.

Aesthetic brief: **terminal-native, executed at mobile-app polish.** Single mono
typeface (JetBrains Mono), pure dark surface, one sharp lime accent for status
and emphasis, hairline borders, no shadows. Weight + opacity carry hierarchy.

This skeleton is **all mocked** — no server yet. Mock data feeds a fake event
stream so you can iterate on the UI feel before the bridge exists.

## Stack (May 2026)

| Layer            | Pick                  | Version  |
| ---------------- | --------------------- | -------- |
| Framework        | Solid                 | 1.9.13   |
| Router           | @solidjs/router       | 0.15.4   |
| Build            | Vite (Rolldown)       | 8.0.x    |
| Styling          | Tailwind CSS          | 4.3.x    |
| Native shell     | Capacitor             | 8.3.x    |
| Type system      | TypeScript            | 5.9.x    |
| Code highlight   | Shiki + shiki-stream  | 3.23 / 0.1 |
| Markdown         | markdown-to-jsx       | 9.8.1    |
| Validation       | Valibot               | 1.4.1    |
| Icons            | lucide-solid          | 0.460    |
| Reconnecting WS  | partysocket           | 1.1.x    |

**Solid 2.0** is in beta as of March 2026 with first-class async and a reworked
reactivity model. It would force a partial rewrite (`onMount` → `onSettled`,
`createEffect` splits into `compute`/`apply`). Sticking on 1.9 stable until 2.0
GA — opt in later by installing `solid-js@next @solidjs/web@next`.

## Setup

```bash
pnpm install
pnpm dev            # http://localhost:5173 — works in any browser
```

The app is small enough to develop in a desktop browser. For real-device feel:

```bash
# Add native platforms once
pnpm exec cap add ios
pnpm exec cap add android

# Live reload on a phone via your LAN
#   1. find your LAN IP (e.g. 192.168.1.42)
#   2. uncomment the `server.url` block in capacitor.config.ts with that IP
#   3. run `pnpm dev` and `pnpm cap:ios` (or cap:android)
```

## Project tour

```
src/
├── index.css              ← design system (Tailwind 4 @theme tokens)
├── App.tsx                ← router
├── lib/
│   ├── types.ts           ← protocol stubs (will move to packages/protocol)
│   ├── mock.ts            ← seeded sessions + scripted event stream
│   └── format.ts          ← time / path / cost helpers
├── stores/
│   ├── sessions.ts        ← session list + active log + wire-event reducer
│   └── connection.ts      ← WS state for the header status pill
├── routes/
│   ├── Sessions.tsx       ← home: every session as one tight row
│   └── Session.tsx        ← chat surface: header → meter → log → composer
└── components/
    ├── Header.tsx         ← top bar with safe-area + status
    ├── StatusDot.tsx      ← the 6px status dot used everywhere
    └── chat/
        ├── MessageList.tsx
        ├── UserMessage.tsx
        ├── AssistantMessage.tsx
        ├── ToolCall.tsx       ← collapsed-by-default, tap to expand
        ├── PermissionGate.tsx ← three-choice approval card
        └── InputBar.tsx       ← textarea + send/mic, safe-area aware
```

## How wire events flow

The reducer in `stores/sessions.ts` is the single ingestion point. The mock
stream and the real WebSocket client will both call `applyWireEvent(e)` — so
the UI is transport-agnostic by construction.

```
mock stream  ─┐
              ├──▶ applyWireEvent(e) ──▶ Solid store ──▶ MessageList
real WS      ─┘
```

When the server bridge lands, swap the `startMockStream` call in
`routes/Session.tsx` for the real client.

## Deliberate omissions

These are in the roadmap but **not** in this skeleton, to keep the surface
tight:

- Shiki / shiki-stream wiring for code blocks (in `markdown-to-jsx` rendering)
- The `partysocket` reconnecting transport
- shadcn-solid command palette for slash commands
- Capacitor `push-notifications`, `network`, `preferences` wiring
- Voice input via `@capacitor-community/speech-recognition`

Each of those slots into a specific file and can be added in isolation.

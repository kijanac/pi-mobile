import { Cause, Effect, Fiber, Layer } from "effect";
import { HttpApiBuilder } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { createServer, type Server } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { WebSocketServer } from "ws";
import { DB_PATH, HOST_INSECURE_NO_AUTH, USE_MOCK } from "./config.ts";
import { allowedOrigins } from "./auth.ts";
import { hostRuntime as runtime } from "./runtime.ts";
import { SessionManager } from "./session.ts";
import { PicoHostApi } from "./http/api.ts";
import { AdminApiLive, SystemApiLive } from "./http/handlers.ts";
import { authMiddleware } from "./http/middleware.ts";
import { compress } from "./http/compression.ts";
import { RawRoutesLive } from "./http/routes.ts";
import { attachWebSocketUpgrade } from "./server.ts";
import { ensureLocalAdminToken } from "./local-admin.ts";

export interface PicoHostOptions {
  readonly host?: string;
  readonly port?: number;
}

export interface PicoHostHandle {
  readonly host: string;
  readonly port: number;
  readonly url: string;
  close: () => Promise<void>;
}

const DEFAULT_PORT = 7777;
const DEFAULT_HOST = "127.0.0.1";

export interface LaunchedHttpServer {
  readonly stop: () => Promise<void>;
}

// Assembles the full HTTP server as one self-contained Effect layer (typed
// HttpApi + raw routes + CORS + the global auth gate) and launches it on the
// host runtime. The ws upgrade is attached to the very node server the layer
// listens on. Exported so the smoke test exercises the real wiring.
export function launchHttpServer(
  port: number,
  host: string,
  onServer?: (server: Server) => void,
): LaunchedHttpServer {
  // Created eagerly so the node server is a stable reference (the layer factory
  // just hands it back); listen happens when the layer builds below.
  const server = createServer();
  onServer?.(server);
  let wss: WebSocketServer | undefined;

  const ApiLive = HttpApiBuilder.api(PicoHostApi).pipe(
    Layer.provide(SystemApiLive),
    Layer.provide(AdminApiLive),
  );

  const ServerLive = HttpApiBuilder.serve(authMiddleware).pipe(
    Layer.provide(
      HttpApiBuilder.middlewareCors({
        allowedOrigins: HOST_INSECURE_NO_AUTH ? () => true : allowedOrigins(),
        allowedMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["content-type"],
      }),
    ),
    Layer.provide(HttpApiBuilder.middleware(compress)),
    Layer.provide(RawRoutesLive),
    Layer.provide(ApiLive),
    Layer.provide(NodeHttpServer.layer(() => server, { port, host })),
  );

  const fiber = runtime.runFork(
    Effect.gen(function* () {
      yield* Layer.build(ServerLive);
      // NodeHttpServer attaches its own "upgrade" listener for Effect-native
      // websockets. We run the session WebSocket on raw `ws` (until the
      // @effect/rpc phase), so once the server is built we drop that listener
      // and attach ours — otherwise both write to the same upgrade socket.
      yield* Effect.sync(() => {
        server.removeAllListeners("upgrade");
        wss = attachWebSocketUpgrade(server, runtime);
      });
      yield* Effect.never;
    }).pipe(
      Effect.scoped,
      Effect.tapErrorCause((cause) => Effect.logError(`http server failed: ${Cause.pretty(cause)}`)),
    ),
  );

  const stop = async () => {
    const currentWss = wss;
    if (currentWss) await new Promise<void>((resolve) => currentWss.close(() => resolve()));
    // Interrupting the fiber closes the build scope, running the layer
    // finalizers that shut the node server down.
    await runtime.runPromise(Fiber.interrupt(fiber));
  };

  return { stop };
}

export function startPicoHost(options: PicoHostOptions = {}): PicoHostHandle {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const usingMock = USE_MOCK;

  if (HOST_INSECURE_NO_AUTH) {
    runtime.runFork(
      Effect.logWarning(
        "PICO_HOST_INSECURE_NO_AUTH=1 — Tailscale identity checks are DISABLED. Anyone who can reach this port has full access. Local dev only.",
      ),
    );
  }

  mkdirSync(dirname(DB_PATH), { recursive: true });
  ensureLocalAdminToken();

  const server = launchHttpServer(port, host);
  const url = `http://${host}:${port}`;
  let closed = false;

  runtime.runFork(
    Effect.logInfo(
      `Pico host listening on ${url}  ${usingMock ? "(mock pi)" : "(live pi)"}\n` +
        `   db   :  ${DB_PATH}\n` +
        `   HTTP :  GET    /healthz, /sessions/:id/export.html\n` +
        `   tRPC :  /trpc/*\n` +
        `   WS   :  /ws?session=:id&cursor=:n`,
    ),
  );

  const close = async () => {
    if (closed) return;
    closed = true;
    await runtime.runPromise(Effect.logInfo("shutting down…"));
    await runtime.runPromise(Effect.flatMap(SessionManager, (manager) => manager.closeAll()));
    await server.stop();
    await runtime.dispose();
  };

  return { host, port, url, close };
}

import { Cause, Context, Effect, Option } from "effect";
import type { Hono } from "hono";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, type HostTrpcServices } from "@pico/protocol/trpc";
import type { HostErrorCode } from "@pico/protocol";
import { authorizeHeaders, claimPicoHostOwner } from "../auth.ts";
import { loadCommands } from "../commands.ts";
import { HostError, SessionNotFound } from "../errors.ts";
import { listFs } from "../fs.ts";
import { PiError } from "../pi.ts";
import { ProviderAuth } from "../provider-auth.ts";
import { SessionManager } from "../session.ts";
import type { HostRuntime, HostRuntimeServices } from "../runtime.ts";
import { hostSystemInfo, readUpdateStatus, requestHostUpdate } from "./system.ts";

function trpcError(failure: unknown): TRPCError {
  if (failure instanceof SessionNotFound) {
    return new TRPCError({ code: "NOT_FOUND", message: "Session not found", cause: failure });
  }

  if (failure instanceof PiError || failure instanceof Error) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: failure.message,
      cause: failure,
    });
  }

  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Request failed", cause: failure });
}

async function runEffectForTrpc<A, E>(
  runtime: HostRuntime,
  effect: Effect.Effect<A, E, HostRuntimeServices>,
): Promise<A> {
  const result = await runtime.runPromiseExit(effect);
  if (result._tag === "Success") return result.value;
  const failure = Option.getOrUndefined(Cause.failureOption(result.cause));
  // Defects (e.g. a SQLite throw inside Effect.sync) carry no typed failure;
  // log the full cause server-side so they don't surface as bare 500s only.
  if (failure === undefined && !Cause.isInterruptedOnly(result.cause)) {
    runtime.runFork(Effect.logError(`[trpc] request died: ${Cause.pretty(result.cause)}`));
  }
  throw trpcError(failure);
}

function authError(status: number, code: HostErrorCode): TRPCError {
  return new TRPCError({
    code: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
    message: code,
    cause: new HostError(code),
  });
}

function makeSystemService(req: Request): HostTrpcServices["system"] {
  return {
    info: async () => hostSystemInfo(),
    updateStatus: async () => readUpdateStatus(),
    triggerUpdate: async () => requestHostUpdate(),
    identity: async () => {
      const result = authorizeHeaders(req.headers);
      if (!result.ok) throw authError(result.status, result.error);
      return { user: result.user, claimed: result.claimed };
    },
    claim: async ({ token }) => {
      const result = authorizeHeaders(req.headers);
      if (!result.ok) throw authError(result.status, result.error);
      if (!result.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "missing_tailscale_identity",
          cause: new HostError("missing_tailscale_identity"),
        });
      }

      try {
        return claimPicoHostOwner(result.user, token);
      } catch (error) {
        throw new TRPCError({
          code: "CONFLICT",
          message: error instanceof HostError ? error.hostErrorCode : error instanceof Error ? error.message : String(error),
          cause: error,
        });
      }
    },
  };
}

function makeSessionService(runtime: HostRuntime): HostTrpcServices["sessions"] {
  const run = <A, E>(
    f: (manager: Context.Tag.Service<SessionManager>) => Effect.Effect<A, E>,
  ) => runEffectForTrpc(runtime, Effect.flatMap(SessionManager, f));

  return {
    list: ({ archived }) => run((manager) => manager.list({ archived })),
    create: (input) => run((manager) => manager.create(input)),
    patch: ({ id, ...patch }) => run((manager) => manager.patch(id, patch)),
    remove: ({ id }) => run((manager) => manager.remove(id)),
    controls: ({ id }) => run((manager) => manager.getSettings(id)),
    patchControl: ({ id, key, value }) => run((manager) => manager.patchSetting(id, key, value)),
    compact: ({ id, instructions }) => run((manager) => manager.compact(id, instructions)),
    queue: ({ id }) => run((manager) => manager.getQueue(id)),
    clearQueue: ({ id }) => run((manager) => manager.clearQueue(id)),
    stats: ({ id }) => run((manager) => manager.getStats(id)),
    tree: ({ id }) => run((manager) => manager.getTree(id)),
    navigateTree: ({ id, entryId, summarize }) => run((manager) => manager.navigateTree(id, entryId, summarize)),
    commands: ({ id }) => run((manager) => manager.listCommands(id)),
  };
}

function makeAuthService(runtime: HostRuntime): HostTrpcServices["auth"] {
  const run = <A, E>(
    f: (auth: Context.Tag.Service<ProviderAuth>) => Effect.Effect<A, E>,
  ) => runEffectForTrpc(runtime, Effect.flatMap(ProviderAuth, f));

  return {
    providers: () => run((auth) => auth.listProviders()),
    startLogin: ({ providerId }) => run((auth) => auth.startLogin(providerId)),
    getLogin: ({ jobId }) => run((auth) => auth.getLogin(jobId)),
    submitLoginInput: ({ jobId, value }) => run((auth) => auth.submitLoginInput(jobId, value)),
    saveApiKey: ({ providerId, apiKey }) => run((auth) => auth.saveApiKey(providerId, apiKey)),
    cancelLogin: ({ jobId }) => run((auth) => auth.cancelLogin(jobId)),
  };
}

function makeContext(runtime: HostRuntime, req: Request): HostTrpcServices {
  return {
    system: makeSystemService(req),
    sessions: makeSessionService(runtime),
    auth: makeAuthService(runtime),
    commands: {
      list: async () => loadCommands(),
    },
    fs: {
      ls: async ({ path }) => listFs(path),
    },
  };
}

export function mountTrpcRoutes(app: Hono, runtime: HostRuntime): void {
  app.all("/trpc/*", (c) =>
    fetchRequestHandler({
      endpoint: "/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext: ({ req }) => makeContext(runtime, req),
    }),
  );
}

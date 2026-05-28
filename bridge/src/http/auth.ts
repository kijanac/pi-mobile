import { Effect, type ManagedRuntime } from "effect";
import type { Hono } from "hono";
import * as v from "valibot";
import { SessionManager } from "../session.ts";
import { AuthInputBody, AuthLoginBody } from "./schemas.ts";
import { runJson } from "./run.ts";

export function mountAuthRoutes(app: Hono, runtime: ManagedRuntime.ManagedRuntime<any, never>): void {
  app.get("/sessions/:id/auth/providers", async (c) => {
    const id = c.req.param("id");
    return runJson(runtime, c, Effect.flatMap(SessionManager, (m) => m.listAuthProviders(id)), "auth_providers_failed");
  });

  app.post("/sessions/:id/auth/login", async (c) => {
    const id = c.req.param("id");
    const body = v.safeParse(AuthLoginBody, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_body", issues: body.issues }, 400);
    return runJson(
      runtime,
      c,
      Effect.flatMap(SessionManager, (m) => m.startAuthLogin(id, body.output.providerId)),
      "auth_login_failed",
    );
  });

  app.get("/sessions/:id/auth/login/:jobId", async (c) => {
    const id = c.req.param("id");
    const jobId = c.req.param("jobId");
    return runJson(runtime, c, Effect.flatMap(SessionManager, (m) => m.getAuthLogin(id, jobId)), "auth_job_failed");
  });

  app.post("/sessions/:id/auth/login/:jobId/input", async (c) => {
    const id = c.req.param("id");
    const jobId = c.req.param("jobId");
    const body = v.safeParse(AuthInputBody, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_body", issues: body.issues }, 400);
    return runJson(
      runtime,
      c,
      Effect.flatMap(SessionManager, (m) => m.submitAuthLoginInput(id, jobId, body.output.value)),
      "auth_input_failed",
    );
  });

  app.post("/sessions/:id/auth/login/:jobId/cancel", async (c) => {
    const id = c.req.param("id");
    const jobId = c.req.param("jobId");
    return runJson(
      runtime,
      c,
      Effect.as(Effect.flatMap(SessionManager, (m) => m.cancelAuthLogin(id, jobId)), { ok: true }),
      "auth_cancel_failed",
    );
  });
}

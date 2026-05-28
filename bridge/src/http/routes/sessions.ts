import { Effect, type ManagedRuntime } from "effect";
import type { Hono } from "hono";
import * as v from "valibot";
import { SessionManager } from "../../session.ts";
import { CreateBody, PatchBody } from "../schemas.ts";
import { runJson, runNoContent } from "../run.ts";

export function mountSessionRoutes(app: Hono, runtime: ManagedRuntime.ManagedRuntime<any, never>): void {
  app.get("/sessions", async (c) =>
    runJson(runtime, c, Effect.flatMap(SessionManager, (m) => m.list()), "internal_error"),
  );

  app.post("/sessions", async (c) => {
    const body = v.safeParse(CreateBody, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_body", issues: body.issues }, 400);
    return runJson(
      runtime,
      c,
      Effect.flatMap(SessionManager, (m) => m.create(body.output)),
      "internal_error",
    );
  });

  app.get("/sessions/:id", async (c) => {
    const id = c.req.param("id");
    const opt = await runtime.runPromise(Effect.flatMap(SessionManager, (m) => m.get(id)));
    if (opt._tag === "None") return c.json({ error: "not_found" }, 404);
    return c.json(opt.value);
  });

  app.patch("/sessions/:id", async (c) => {
    const id = c.req.param("id");
    const body = v.safeParse(PatchBody, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_body", issues: body.issues }, 400);
    if (body.output.title === undefined && body.output.archived === undefined) {
      return c.json({ error: "empty_patch" }, 400);
    }
    return runJson(
      runtime,
      c,
      Effect.flatMap(SessionManager, (m) => m.patch(id, body.output)),
      "not_found",
    );
  });

  app.delete("/sessions/:id", async (c) => {
    const id = c.req.param("id");
    return runNoContent(
      runtime,
      c,
      Effect.flatMap(SessionManager, (m) => m.remove(id)),
      "not_found",
    );
  });
}

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ManagedRuntime } from "effect";
import { mountSystemRoutes } from "./routes/system.ts";
import { mountSessionRoutes } from "./routes/sessions.ts";
import { mountSessionActionRoutes } from "./routes/session-actions.ts";
import { mountAuthRoutes } from "./routes/auth.ts";
import { mountCommandRoutes } from "./routes/commands.ts";
import { mountFsRoutes } from "./routes/fs.ts";

export function makeHttpApp(runtime: ManagedRuntime.ManagedRuntime<any, never>): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["content-type"],
    }),
  );

  mountSystemRoutes(app);
  mountSessionRoutes(app, runtime);
  mountSessionActionRoutes(app, runtime);
  mountAuthRoutes(app, runtime);
  mountCommandRoutes(app);
  mountFsRoutes(app);

  return app;
}

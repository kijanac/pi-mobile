import type { Hono } from "hono";
import { loadCommands } from "../commands.ts";

export function mountCommandRoutes(app: Hono): void {
  app.get("/commands", (c) => c.json(loadCommands()));
}

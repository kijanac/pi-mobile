import type { Hono } from "hono";
import { handleFsLs } from "../fs.ts";

export function mountFsRoutes(app: Hono): void {
  app.get("/fs/ls", handleFsLs);
}

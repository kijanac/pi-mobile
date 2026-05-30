import type { Hono } from "hono";
import { authorizeHeaders, claimBridgeOwner } from "../auth.ts";
import {
  MIN_MOBILE_VERSION,
  PRODUCT_VERSION,
  PROTOCOL_VERSION,
  RECOMMENDED_MOBILE_VERSION,
} from "@pi-mobile/protocol";

const UPDATE_CHANNEL = "stable";

export function mountSystemRoutes(app: Hono): void {
  app.get("/healthz", (c) => c.text("ok"));

  app.get("/system/identity", (c) => {
    const result = authorizeHeaders(c.req.raw.headers);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ user: result.user, claimed: result.claimed });
  });

  app.post("/setup/claim", (c) => {
    const result = authorizeHeaders(c.req.raw.headers);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    if (!result.user) return c.json({ error: "missing_tailscale_identity" }, 401);
    try {
      return c.json(claimBridgeOwner(result.user));
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 409);
    }
  });

  app.get("/system/info", (c) =>
    c.json({
      bridgeVersion: PRODUCT_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      minMobileVersion: MIN_MOBILE_VERSION,
      recommendedMobileVersion: RECOMMENDED_MOBILE_VERSION,
      updateChannel: UPDATE_CHANNEL,
      autoUpdate: process.env.PI_BRIDGE_AUTO_UPDATE === "1",
    }),
  );
}

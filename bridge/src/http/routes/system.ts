import type { Hono } from "hono";
import {
  MIN_MOBILE_VERSION,
  PRODUCT_VERSION,
  PROTOCOL_VERSION,
  RECOMMENDED_MOBILE_VERSION,
} from "@pi-mobile/protocol";

export function mountSystemRoutes(app: Hono): void {
  app.get("/healthz", (c) => c.text("ok"));

  app.get("/system/info", (c) =>
    c.json({
      bridgeVersion: PRODUCT_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      minMobileVersion: MIN_MOBILE_VERSION,
      recommendedMobileVersion: RECOMMENDED_MOBILE_VERSION,
      updateChannel: process.env.PI_BRIDGE_UPDATE_CHANNEL ?? "manual",
      autoUpdate: process.env.PI_BRIDGE_AUTO_UPDATE === "1",
    }),
  );
}

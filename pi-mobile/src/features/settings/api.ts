import type { BridgeUpdateStatus, SystemInfo } from "@pi-mobile/protocol";
import type { BridgeIdentity } from "@/shared/lib/api-client";
import { createBridgeClient } from "@/shared/lib/bridge-client";

export type { BridgeUpdateStatus, SystemInfo } from "@pi-mobile/protocol";
export type { BridgeIdentity } from "@/shared/lib/api-client";

export function healthcheckBridgeUrl(url: string): Promise<boolean> {
  return createBridgeClient(url.trim()).healthcheck();
}

export function getSystemInfoForUrl(url: string): Promise<SystemInfo> {
  return createBridgeClient(url.trim()).getSystemInfo();
}

export function getBridgeUpdateStatusForUrl(url: string): Promise<BridgeUpdateStatus> {
  return createBridgeClient(url.trim()).getBridgeUpdateStatus();
}

export function triggerBridgeUpdateForUrl(url: string): Promise<BridgeUpdateStatus> {
  return createBridgeClient(url.trim()).triggerBridgeUpdate();
}

export function getBridgeIdentityForUrl(url: string): Promise<BridgeIdentity> {
  return createBridgeClient(url.trim()).getBridgeIdentity();
}

export async function claimBridgeForUrl(url: string): Promise<BridgeIdentity> {
  const claimed = await createBridgeClient(url.trim()).claimBridge();
  return { user: claimed.owner, claimed: true };
}

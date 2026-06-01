import { createBridgeClient } from "@/shared/lib/bridge-client";

export function healthcheckBridgeUrl(url: string): Promise<boolean> {
  return createBridgeClient(url).healthcheck();
}

export async function claimReachableBridge(url: string): Promise<void> {
  const client = createBridgeClient(url);
  const identity = await client.getBridgeIdentity();
  if (!identity.claimed) await client.claimBridge();
}

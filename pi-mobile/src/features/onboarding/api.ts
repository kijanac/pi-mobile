import { createBridgeClient, createBridgeTrpc } from "@/shared/lib/bridge-client";

export function healthcheckBridgeUrl(url: string): Promise<boolean> {
  return createBridgeClient(url).healthcheck();
}

export async function claimReachableBridge(url: string): Promise<void> {
  const trpc = createBridgeTrpc(url);
  const identity = await trpc.system.identity.query({});
  if (!identity.claimed) await trpc.system.claim.mutate({});
}

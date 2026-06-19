import { createHostClient, createHostTrpc } from "@/shared/lib/host-client";

export function healthcheckHostUrl(url: string): Promise<boolean> {
  return createHostClient(url).healthcheck();
}

export async function claimReachableHost(url: string, token?: string): Promise<void> {
  const trpc = createHostTrpc(url);
  const identity = await trpc.system.identity.query({});
  if (!identity.claimed) await trpc.system.claim.mutate(token ? { token } : {});
}

import { createHostClient, createHostTrpc } from "@/shared/lib/host-client";

export function healthcheckHostUrl(url: string): Promise<boolean> {
  return createHostClient(url.trim()).healthcheck();
}

export async function probeHostIdentity(url: string): Promise<void> {
  await createHostTrpc(url.trim()).system.identity.query({});
}

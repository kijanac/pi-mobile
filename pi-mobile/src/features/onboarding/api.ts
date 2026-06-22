import { Effect } from "effect";
import { rpc } from "@/shared/lib/rpc-client";

export { healthcheckHostUrl } from "@/shared/lib/host-http";

// Run against a specific host via runAt(url, claimReachableHost()).
export const claimReachableHost = (token?: string) =>
  rpc((c) => c.system.identity()).pipe(
    Effect.flatMap((identity) =>
      identity.claimed ? Effect.void : Effect.asVoid(rpc((c) => c.system.claim(token ? { token } : {}))),
    ),
  );

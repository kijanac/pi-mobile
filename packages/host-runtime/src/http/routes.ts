import { HttpApiBuilder } from "@effect/platform";
import { Effect } from "effect";
import { exportRoute } from "./session-actions.ts";
import { trpcRoute } from "./trpc.ts";

// Non-API (raw) routes mounted on the same HttpApiBuilder.Router that serve()
// builds: the tRPC catch-all and the streaming HTML export. Provided to the
// serve layer so they attach to the shared (memoized) router before it is read.
// These stay raw until the @effect/rpc phase retires tRPC.
export const RawRoutesLive = HttpApiBuilder.Router.use((router) =>
  Effect.gen(function* () {
    yield* router.all("/trpc/*", trpcRoute);
    yield* router.get("/sessions/:id/export.html", exportRoute);
  }),
);

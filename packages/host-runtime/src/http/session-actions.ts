import { HttpRouter, HttpServerResponse } from "@effect/platform";
import { Cause, Effect, Exit, Option, Stream } from "effect";
import { IS_PRODUCTION } from "../config.ts";
import { SessionNotFound } from "../errors.ts";
import { PiError } from "../pi.ts";
import { hostRuntime } from "../runtime.ts";
import { SessionManager } from "../session.ts";

const isDev = !IS_PRODUCTION;

// Streams the rendered HTML export. SessionManager lives in the host runtime, so
// the export effect is bridged via runPromiseExit; the resulting web stream is
// handed to HttpServerResponse.stream.
export const exportRoute = Effect.gen(function* () {
  const { id } = yield* HttpRouter.params;
  const exit = yield* Effect.promise(() =>
    hostRuntime.runPromiseExit(Effect.flatMap(SessionManager, (manager) => manager.exportHtml(id ?? ""))),
  );

  if (Exit.isSuccess(exit)) {
    const html = exit.value;
    return HttpServerResponse.stream(
      Stream.fromReadableStream({ evaluate: () => html.stream, onError: (error) => error }),
      {
        contentType: "text/html; charset=utf-8",
        headers: {
          ...(html.filename ? { "content-disposition": `attachment; filename="${html.filename}"` } : {}),
          ...(html.size !== undefined ? { "content-length": String(html.size) } : {}),
        },
      },
    );
  }

  const failure = Option.getOrUndefined(Cause.failureOption(exit.cause));

  if (failure instanceof SessionNotFound) {
    return HttpServerResponse.unsafeJson({ error: "not_found", message: "Session not found" }, { status: 404 });
  }

  if (failure instanceof PiError) {
    return HttpServerResponse.unsafeJson(
      { error: "export_failed", message: failure.message || "Request failed" },
      { status: 500 },
    );
  }

  return HttpServerResponse.unsafeJson(
    {
      error: "export_failed",
      message: "Internal server error",
      ...(isDev ? { detail: Cause.pretty(exit.cause) } : {}),
    },
    { status: 500 },
  );
});

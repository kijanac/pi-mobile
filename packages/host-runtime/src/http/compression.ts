import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { Headers, HttpApp, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect, Stream } from "effect";

const gzipAsync = promisify(gzip);

// Only text-ish payloads benefit; binary/already-compressed types do not.
const COMPRESSIBLE = /^(?:text\/|application\/(?:json|javascript|xml|wasm)|image\/svg\+xml)/i;
// Below this, gzip framing overhead outweighs the savings.
const MIN_BYTES = 1024;

const acceptsGzip = (headers: Headers.Headers): boolean =>
  (headers["accept-encoding"] ?? "").toLowerCase().includes("gzip");

const compressible = (response: HttpServerResponse.HttpServerResponse): boolean =>
  response.headers["content-encoding"] === undefined &&
  COMPRESSIBLE.test(response.headers["content-type"] ?? "");

// content-length is dropped (it described the uncompressed body); the rebuilt
// buffered body re-adds the correct one, streamed bodies go chunked.
const withGzipHeaders = (headers: Headers.Headers): Headers.Headers =>
  Headers.set(
    Headers.set(Headers.remove(headers, "content-length"), "content-encoding", "gzip"),
    "vary",
    "accept-encoding",
  );

// gzip compressible response bodies for clients that accept it. Applied via
// HttpApiBuilder.middleware so it runs INSIDE the app pipeline, before the
// response is serialized — the serve() middleware slot runs after serialization
// and so cannot rewrite the body. No @effect/platform compression exists, so
// this is a thin node:zlib / CompressionStream shim.
export const compress = (
  httpApp: HttpApp.Default,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest> =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const response = yield* httpApp;

    if (!acceptsGzip(request.headers) || !compressible(response)) return response;

    const body = response.body;
    const options = {
      status: response.status,
      statusText: response.statusText,
      cookies: response.cookies,
      headers: withGzipHeaders(response.headers),
    };

    if (body._tag === "Uint8Array") {
      if (body.body.length < MIN_BYTES) return response;
      const gzipped = yield* Effect.promise(() => gzipAsync(body.body));
      return HttpServerResponse.uint8Array(gzipped, options);
    }

    if (body._tag === "Stream") {
      // CompressionStream is the stateful gzip transform (it flushes across
      // chunks). The cast only bridges DOM vs node web-stream lib typings
      // (WritableStream<BufferSource> variance); it is structurally compatible.
      const gzip = new CompressionStream("gzip") as unknown as {
        readonly readable: ReadableStream<Uint8Array>;
        readonly writable: WritableStream<Uint8Array>;
      };
      const gzipped = Stream.fromReadableStream<Uint8Array, unknown>({
        evaluate: () => Stream.toReadableStream<Uint8Array>()(body.stream).pipeThrough(gzip),
        onError: (error) => error,
      });
      return HttpServerResponse.stream(gzipped, options);
    }

    return response;
  });

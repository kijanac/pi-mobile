import type { HostErrorCode } from "@pico/protocol";
import { hostErrorPayloadFromUnknown } from "@pico/protocol";

export class HostError extends Error {
  readonly hostErrorCode: HostErrorCode;

  constructor(hostErrorCode: HostErrorCode, message: string = hostErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = "HostError";
    this.hostErrorCode = hostErrorCode;
  }
}

export function hostErrorCodeFromUnknown(value: unknown): HostErrorCode | undefined {
  return hostErrorPayloadFromUnknown(value)?.hostErrorCode;
}

export function toHostError(value: unknown, fallback: HostErrorCode): HostError {
  if (value instanceof HostError) return value;
  return new HostError(hostErrorCodeFromUnknown(value) ?? fallback, value instanceof Error ? value.message : String(value), value instanceof Error ? { cause: value } : undefined);
}

export class SessionNotFound extends Error {
  readonly _tag = "SessionNotFound";
  constructor(readonly id: string) {
    super(`session not found: ${id}`);
  }
}

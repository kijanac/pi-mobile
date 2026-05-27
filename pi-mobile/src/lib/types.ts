/**
 * Wire protocol types. Mirror of `bridge/src/protocol.ts`.
 *
 * Treat the bridge file as the source of truth and copy here when it changes
 * (a future monorepo will let both sides import a shared package).
 */

export type SessionStatus = "idle" | "thinking" | "tool" | "waiting" | "error";
export type ToolName = "read" | "write" | "edit" | "bash";
export type PermissionChoice = "allow" | "deny" | "allow_session";

/* ── log entries ─────────────────────────────────────────────────────── */

export type MessageId = string;

export interface UserMessage {
  kind: "user";
  id: MessageId;
  at: number;
  text: string;
}

/**
 * How an assistant turn ended. Mirrors pi-ai's `StopReason`. The mobile
 * renders "stop" and "toolUse" as normal completions; the other three
 * surface an inline indicator on the assistant bubble.
 */
export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

export interface AssistantMessage {
  kind: "assistant";
  id: MessageId;
  at: number;
  text: string;
  streaming?: boolean;
  /** Populated once the assistant turn ends. Absent while streaming. */
  stopReason?: StopReason;
  /** Set when stopReason is "error" or "aborted". */
  errorMessage?: string;
}

export interface ToolCallMessage {
  kind: "tool_call";
  id: MessageId;
  at: number;
  tool: ToolName;
  args: Record<string, unknown>;
  status: "pending" | "running" | "ok" | "error";
  result?: string;
  durationMs?: number;
}

export interface PermissionRequest {
  kind: "permission";
  id: MessageId;
  at: number;
  tool: ToolName;
  args: Record<string, unknown>;
  rationale?: string;
  resolved?: PermissionChoice;
}

export type LogEntry =
  | UserMessage
  | AssistantMessage
  | ToolCallMessage
  | PermissionRequest;

/* ── session metadata ────────────────────────────────────────────────── */

export interface SessionMeta {
  id: string;
  title: string;
  cwd: string;
  branch?: string;
  status: SessionStatus;
  updatedAt: number;
  tokens: { in: number; out: number };
  costUsd: number;
  /** True when the user has archived this session. Archived sessions
   *  are excluded from the default list but the row is kept. */
  archived?: boolean;
}

/* ── wire events — server → client ──────────────────────────────────── */
// Every event carries a monotonic `seq`; clients track the max they've seen
// and pass it back as `cursor` on reconnect to replay any gap.

export type WireEvent =
  | { t: "hello"; seq: number; session: SessionMeta; cursor: number }
  | { t: "user_message"; seq: number; entry: UserMessage }
  | { t: "assistant_delta"; seq: number; id: MessageId; text: string }
  | {
      t: "assistant_end";
      seq: number;
      id: MessageId;
      stopReason?: StopReason;
      errorMessage?: string;
    }
  | { t: "tool_call"; seq: number; entry: ToolCallMessage }
  | {
      t: "tool_result";
      seq: number;
      id: MessageId;
      result: string;
      status: "ok" | "error";
      durationMs: number;
    }
  | { t: "permission"; seq: number; entry: PermissionRequest }
  | { t: "status"; seq: number; status: SessionStatus }
  | {
      t: "cost";
      seq: number;
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
    }
  | {
      t: "auto_retry_start";
      seq: number;
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      errorMessage: string;
    }
  | {
      t: "auto_retry_end";
      seq: number;
      success: boolean;
      attempt: number;
      finalError?: string;
    };

export interface ImageAttachment {
  /** Base64-encoded image payload (no data: prefix). */
  data: string;
  /** MIME type, e.g. "image/jpeg" or "image/png". */
  mimeType: string;
}

export type ClientEvent =
  | {
      t: "send";
      text: string;
      // When the agent is streaming, mode picks how to deliver:
      //   "steer"     → after the current turn's tool calls finish (default)
      //   "follow_up" → after the agent finishes all queued work
      // Ignored when the agent is idle.
      mode?: "steer" | "follow_up";
      images?: ImageAttachment[];
    }
  | { t: "permission_reply"; id: MessageId; choice: PermissionChoice }
  | { t: "interrupt" }
  | { t: "resume"; sessionId: string; cursor: number };

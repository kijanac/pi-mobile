import { createSignal, createMemo, type Accessor } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type {
  AssistantMessage,
  LogEntry,
  SessionMeta,
  WireEvent,
} from "@pi-mobile/protocol";
import * as api from "@/lib/api";

export const [sessions, setSessions] = createSignal<SessionMeta[]>([]);

export async function loadSessions(baseUrl: string): Promise<void> {
  const list = await api.listSessions(baseUrl);
  setSessions(list);
}

export function useSession(id: Accessor<string>) {
  return createMemo(() => sessions().find((s) => s.id === id()));
}

const [activeSessionId, setActiveSessionId] = createSignal<string | null>(null);

const [activeStatusSignal, setActiveStatus] =
  createSignal<SessionMeta["status"]>("idle");
export const activeStatus = activeStatusSignal;

interface RetryState {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  errorMessage: string;
}
const [activeRetry, setActiveRetry] = createSignal<RetryState | null>(null);
export { activeRetry };

interface SessionLog {
  entries: LogEntry[];
  cursor: number;
}

const [logs, setLogs] = createStore<Record<string, SessionLog>>({});
const entryIndexes = new Map<string, Map<string, number>>();
const activityVersions = new Map<string, number>();
const [activityVersionSignal, setActivityVersion] = createSignal(0);
export const activityVersion = activityVersionSignal;

const emptyLog: SessionLog = { entries: [], cursor: 0 };
const currentLog = () => {
  const id = activeSessionId();
  if (!id) return emptyLog;
  return logs[id]!;
};

export const entries = () => currentLog().entries;
export const cursor = () => currentLog().cursor;
export const cursorForSession = (sessionId: string) => {
  ensureLog(sessionId);
  return logs[sessionId]!.cursor;
};

function ensureLog(sessionId: string): void {
  if (!logs[sessionId]) setLogs(sessionId, { entries: [], cursor: 0 });
  if (!entryIndexes.has(sessionId)) entryIndexes.set(sessionId, new Map());
}

function bumpActivity(sessionId: string): void {
  const next = (activityVersions.get(sessionId) ?? 0) + 1;
  activityVersions.set(sessionId, next);
  if (activeSessionId() === sessionId) setActivityVersion(next);
}

export function resetActiveLog(sessionId: string): void {
  ensureLog(sessionId);
  setActiveSessionId(sessionId);
  const version = activityVersions.get(sessionId) ?? 0;
  setActivityVersion(version);
  setActiveStatus("idle");
  setActiveRetry(null);
}

const mutate = (sessionId: string, fn: (arr: LogEntry[]) => void): void => {
  ensureLog(sessionId);
  setLogs(sessionId, "entries", produce(fn));
};

function appendEntry(
  sessionId: string,
  arr: LogEntry[],
  entry: LogEntry,
): void {
  arr.push(entry);
  entryIndexes.get(sessionId)?.set(entry.id, arr.length - 1);
}

function findEntry(
  sessionId: string,
  arr: LogEntry[],
  id: string,
): LogEntry | undefined {
  const entryIndex = entryIndexes.get(sessionId);
  const idx = entryIndex?.get(id);
  if (idx !== undefined && arr[idx]?.id === id) return arr[idx];

  const fallback = arr.findIndex((x) => x.id === id);
  if (fallback >= 0) {
    entryIndex?.set(id, fallback);
    return arr[fallback];
  }
  return undefined;
}

type AssistantEndEvent = Extract<WireEvent, { t: "assistant_end" }>;

function applyAssistantEnd(
  message: AssistantMessage,
  event: AssistantEndEvent,
): void {
  message.streaming = false;
  if (event.stopReason) message.stopReason = event.stopReason;
  if (event.errorMessage) message.errorMessage = event.errorMessage;
  if (event.usage) message.usage = event.usage;
}

function assistantFromEnd(event: AssistantEndEvent): AssistantMessage {
  const message: AssistantMessage = {
    kind: "assistant",
    id: event.id,
    at: Date.now(),
    text: "",
    streaming: false,
  };
  applyAssistantEnd(message, event);
  return message;
}

export function applyWireEventForSession(sessionId: string, e: WireEvent): void {
  ensureLog(sessionId);
  const sessionLog = logs[sessionId]!;
  if (e.t !== "hello" && e.seq > 0 && e.seq <= sessionLog.cursor) return;

  if (e.seq > sessionLog.cursor) setLogs(sessionId, "cursor", e.seq);

  switch (e.t) {
    case "hello":
      return;

    case "user_message":
      mutate(sessionId, (arr) => appendEntry(sessionId, arr, e.entry));
      bumpActivity(sessionId);
      return;

    case "assistant_delta":
      mutate(sessionId, (arr) => {
        const existing = findEntry(sessionId, arr, e.id);
        if (existing?.kind === "assistant") {
          existing.text += e.text;
          existing.streaming = true;
        } else {
          appendEntry(sessionId, arr, {
            kind: "assistant",
            id: e.id,
            at: Date.now(),
            text: e.text,
            streaming: true,
          });
        }
      });
      bumpActivity(sessionId);
      return;

    case "assistant_end":
      mutate(sessionId, (arr) => {
        const m = findEntry(sessionId, arr, e.id);
        if (!m) {
          appendEntry(sessionId, arr, assistantFromEnd(e));
          return;
        }
        if (m.kind === "assistant") applyAssistantEnd(m, e);
      });
      bumpActivity(sessionId);
      return;

    case "tool_call":
      mutate(sessionId, (arr) => appendEntry(sessionId, arr, e.entry));
      bumpActivity(sessionId);
      return;

    case "tool_result":
      mutate(sessionId, (arr) => {
        const m = findEntry(sessionId, arr, e.id);
        if (m?.kind === "tool_call") {
          m.status = e.status;
          m.result = e.result;
          m.durationMs = e.durationMs;
        }
      });
      bumpActivity(sessionId);
      return;

    case "permission":
      mutate(sessionId, (arr) => appendEntry(sessionId, arr, e.entry));
      bumpActivity(sessionId);
      return;

    case "status":
      if (activeSessionId() === sessionId) setActiveStatus(e.status);
      return;

    case "cost":
      return;

    case "auto_retry_start":
      if (activeSessionId() === sessionId) {
        setActiveRetry({
          attempt: e.attempt,
          maxAttempts: e.maxAttempts,
          delayMs: e.delayMs,
          errorMessage: e.errorMessage,
        });
      }
      return;

    case "auto_retry_end":
      if (activeSessionId() === sessionId) setActiveRetry(null);
      return;
  }
}

export function applyWireEvent(e: WireEvent): void {
  const id = activeSessionId();
  if (!id) return;
  applyWireEventForSession(id, e);
}

export function resolvePermissionLocal(
  id: string,
  choice: "allow" | "deny" | "allow_session",
): void {
  const sessionId = activeSessionId();
  if (!sessionId) return;

  let changed = false;
  mutate(sessionId, (arr) => {
    const m = findEntry(sessionId, arr, id);
    if (m?.kind === "permission") {
      m.resolved = choice;
      changed = true;
    }
  });
  if (changed) bumpActivity(sessionId);
}

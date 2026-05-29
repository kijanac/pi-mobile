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


const [log, setLog] = createStore<{
  entries: LogEntry[];
  cursor: number;
}>({ entries: [], cursor: 0 });

export const entries = () => log.entries;
export const cursor = () => log.cursor;

const [activityVersionSignal, setActivityVersion] = createSignal(0);
export const activityVersion = activityVersionSignal;
const bumpActivity = () => setActivityVersion((n) => n + 1);

const entryIndex = new Map<string, number>();

export function resetActiveLog() {
  setLog({ entries: [], cursor: 0 });
  entryIndex.clear();
  setActivityVersion(0);
  setActiveStatus("idle");
  setActiveRetry(null);
}

const mutate = (fn: (arr: LogEntry[]) => void): void =>
  setLog("entries", produce(fn));

function appendEntry(arr: LogEntry[], entry: LogEntry): void {
  arr.push(entry);
  entryIndex.set(entry.id, arr.length - 1);
}

function findEntry(arr: LogEntry[], id: string): LogEntry | undefined {
  const idx = entryIndex.get(id);
  if (idx !== undefined && arr[idx]?.id === id) return arr[idx];

  const fallback = arr.findIndex((x) => x.id === id);
  if (fallback >= 0) {
    entryIndex.set(id, fallback);
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

export function applyWireEvent(e: WireEvent): void {
  if (e.t !== "hello" && e.seq > 0 && e.seq <= log.cursor) return;

  if (e.seq > log.cursor) setLog("cursor", e.seq);

  switch (e.t) {
    case "hello":
      return;

    case "user_message":
      mutate((arr) => appendEntry(arr, e.entry));
      bumpActivity();
      return;

    case "assistant_delta":
      mutate((arr) => {
        const existing = findEntry(arr, e.id);
        if (existing?.kind === "assistant") {
          existing.text += e.text;
          existing.streaming = true;
        } else {
          appendEntry(arr, {
            kind: "assistant",
            id: e.id,
            at: Date.now(),
            text: e.text,
            streaming: true,
          });
        }
      });
      bumpActivity();
      return;

    case "assistant_end":
      mutate((arr) => {
        const m = findEntry(arr, e.id);
        if (!m) {
          appendEntry(arr, assistantFromEnd(e));
          return;
        }
        if (m.kind === "assistant") applyAssistantEnd(m, e);
      });
      bumpActivity();
      return;

    case "tool_call":
      mutate((arr) => appendEntry(arr, e.entry));
      bumpActivity();
      return;

    case "tool_result":
      mutate((arr) => {
        const m = findEntry(arr, e.id);
        if (m?.kind === "tool_call") {
          m.status = e.status;
          m.result = e.result;
          m.durationMs = e.durationMs;
        }
      });
      bumpActivity();
      return;

    case "permission":
      mutate((arr) => appendEntry(arr, e.entry));
      bumpActivity();
      return;

    case "status":
      setActiveStatus(e.status);
      return;

    case "cost":
      return;

    case "auto_retry_start":
      setActiveRetry({
        attempt: e.attempt,
        maxAttempts: e.maxAttempts,
        delayMs: e.delayMs,
        errorMessage: e.errorMessage,
      });
      return;

    case "auto_retry_end":
      setActiveRetry(null);
      return;
  }
}

export function resolvePermissionLocal(
  id: string,
  choice: "allow" | "deny" | "allow_session",
): void {
  let changed = false;
  mutate((arr) => {
    const m = findEntry(arr, id);
    if (m?.kind === "permission") {
      m.resolved = choice;
      changed = true;
    }
  });
  if (changed) bumpActivity();
}

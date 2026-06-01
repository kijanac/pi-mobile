import type { ApiClient } from "@/shared/lib/api-client";
import type { QueueState, Commands, SessionControls, SessionStats, SessionTree } from "@pi-mobile/protocol";
import { getBridgeClient } from "@/shared/lib/bridge-client";

function client(): ApiClient {
  return getBridgeClient();
}

export function compactSession(sessionId: string, instructions?: string): Promise<void> {
  return client().compactSession(sessionId, instructions);
}

export function getSessionQueue(sessionId: string): Promise<QueueState> {
  return client().getSessionQueue(sessionId);
}

export function clearSessionQueue(sessionId: string): Promise<QueueState> {
  return client().clearSessionQueue(sessionId);
}

export function listSessionCommands(sessionId: string): Promise<Commands> {
  return client().listCommands(sessionId);
}

export function getSessionSettings(sessionId: string): Promise<SessionControls> {
  return client().getSessionSettings(sessionId);
}

export function patchSessionSetting(sessionId: string, key: string, value: string | boolean): Promise<SessionControls> {
  return client().patchSessionSetting(sessionId, key, value);
}

export function getSessionStats(sessionId: string): Promise<SessionStats> {
  return client().getSessionStats(sessionId);
}

export function sessionExportHtmlUrl(sessionId: string): string {
  return client().sessionExportHtmlUrl(sessionId);
}

export function getSessionTree(sessionId: string): Promise<SessionTree> {
  return client().getSessionTree(sessionId);
}

export function navigateSessionTree(sessionId: string, opts: { entryId: string; summarize?: boolean }): Promise<void> {
  return client().navigateSessionTree(sessionId, opts);
}

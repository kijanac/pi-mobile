import type { FsListing } from "@/shared/lib/api-client";
import type { SessionMeta } from "@pi-mobile/protocol";
import { getBridgeClient } from "@/shared/lib/bridge-client";

export interface LoadSessionListOptions {
  archived?: boolean;
}

export interface CreateSessionInput {
  cwd: string;
  title: string;
}

export function loadSessionList(opts?: LoadSessionListOptions): Promise<SessionMeta[]> {
  return getBridgeClient().listSessions(opts);
}

export function createSession(input: CreateSessionInput): Promise<SessionMeta> {
  return getBridgeClient().createSession(input);
}

export function renameSession(sessionId: string, title: string): Promise<SessionMeta> {
  return getBridgeClient().patchSession(sessionId, { title });
}

export function setSessionArchived(sessionId: string, archived: boolean): Promise<SessionMeta> {
  return getBridgeClient().patchSession(sessionId, { archived });
}

export function deleteSession(sessionId: string): Promise<void> {
  return getBridgeClient().deleteSession(sessionId);
}

export function listDirectories(path?: string): Promise<FsListing> {
  return getBridgeClient().lsFs(path);
}

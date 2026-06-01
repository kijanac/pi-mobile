import type { ApiClient, GitBranchesResult } from "@/shared/lib/api-client";
import type { SessionMeta } from "@pi-mobile/protocol";

export interface LoadSessionListOptions {
  archived?: boolean;
}

export interface CreateSessionInput {
  cwd: string;
  title: string;
  branch?: string;
}

export function loadSessionList(
  client: ApiClient,
  opts?: LoadSessionListOptions,
): Promise<SessionMeta[]> {
  return client.listSessions(opts);
}

export function createSession(
  client: ApiClient,
  input: CreateSessionInput,
): Promise<SessionMeta> {
  return client.createSession(input);
}

export function renameSession(
  client: ApiClient,
  sessionId: string,
  title: string,
): Promise<SessionMeta> {
  return client.patchSession(sessionId, { title });
}

export function setSessionArchived(
  client: ApiClient,
  sessionId: string,
  archived: boolean,
): Promise<SessionMeta> {
  return client.patchSession(sessionId, { archived });
}

export function deleteSession(
  client: ApiClient,
  sessionId: string,
): Promise<void> {
  return client.deleteSession(sessionId);
}

export function listGitBranches(client: ApiClient, cwd: string): Promise<GitBranchesResult> {
  return client.listGitBranches(cwd);
}

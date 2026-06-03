import { getBridgeTrpc } from "@/shared/lib/bridge-client";

export interface LoadSessionListOptions {
  archived?: boolean;
}

export interface CreateSessionInput {
  cwd: string;
  title: string;
}

export function loadSessionList(opts?: LoadSessionListOptions) {
  return getBridgeTrpc().sessions.list.query(opts ?? {});
}

export function createSession(input: CreateSessionInput) {
  return getBridgeTrpc().sessions.create.mutate(input);
}

export function renameSession(sessionId: string, title: string) {
  return getBridgeTrpc().sessions.patch.mutate({ id: sessionId, title });
}

export function setSessionArchived(sessionId: string, archived: boolean) {
  return getBridgeTrpc().sessions.patch.mutate({ id: sessionId, archived });
}

export function deleteSession(sessionId: string) {
  return getBridgeTrpc().sessions.remove.mutate({ id: sessionId });
}

export function listDirectories(path?: string) {
  return getBridgeTrpc().fs.ls.query({ path });
}

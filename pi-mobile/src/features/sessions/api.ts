import { getHostTrpc } from "@/shared/lib/host-client";

export interface LoadSessionListOptions {
  archived?: boolean;
}

export interface CreateSessionInput {
  cwd: string;
  title: string;
}

export function loadSessionList(opts?: LoadSessionListOptions) {
  return getHostTrpc().sessions.list.query(opts ?? {});
}

export function createSession(input: CreateSessionInput) {
  return getHostTrpc().sessions.create.mutate(input);
}

export function renameSession(sessionId: string, title: string) {
  return getHostTrpc().sessions.patch.mutate({ id: sessionId, title });
}

export function setSessionArchived(sessionId: string, archived: boolean) {
  return getHostTrpc().sessions.patch.mutate({ id: sessionId, archived });
}

export function deleteSession(sessionId: string) {
  return getHostTrpc().sessions.remove.mutate({ id: sessionId });
}

export function listDirectories(path?: string) {
  return getHostTrpc().fs.ls.query({ path });
}

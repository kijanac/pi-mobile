import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { getBridgeClient, getBridgeTrpc } from "@/shared/lib/bridge-client";

export function compactSession(sessionId: string, instructions?: string) {
  return getBridgeTrpc().sessions.compact.mutate({ id: sessionId, instructions: instructions?.trim() || undefined });
}

export function getSessionQueue(sessionId: string) {
  return getBridgeTrpc().sessions.queue.query({ id: sessionId });
}

export function clearSessionQueue(sessionId: string) {
  return getBridgeTrpc().sessions.clearQueue.mutate({ id: sessionId });
}

export function listSessionCommands(sessionId: string) {
  return getBridgeTrpc().sessions.commands.query({ id: sessionId });
}

export function getSessionSettings(sessionId: string) {
  return getBridgeTrpc().sessions.controls.query({ id: sessionId });
}

export function patchSessionSetting(sessionId: string, key: string, value: string | boolean) {
  return getBridgeTrpc().sessions.patchControl.mutate({ id: sessionId, key, value });
}

export function getSessionStats(sessionId: string) {
  return getBridgeTrpc().sessions.stats.query({ id: sessionId });
}

const safeFilenamePart = (value: string): string =>
  value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "session";

export async function exportSessionHtml(sessionId: string): Promise<boolean> {
  const url = getBridgeClient().sessionExportHtmlUrl(sessionId);
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`export failed (${response.status}): ${body.error ?? "unknown"}`);
  }

  const filename = `pi-session-${safeFilenamePart(sessionId)}.html`;
  const path = `exports/${filename}`;
  await Filesystem.writeFile({
    path,
    directory: Directory.Cache,
    data: await response.text(),
    encoding: Encoding.UTF8,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });

  try {
    await Share.share({
      title: filename,
      files: [uri],
      dialogTitle: "Export to HTML",
    });
    return true;
  } catch (error) {
    if (isShareCanceled(error)) return false;
    throw error;
  }
}

function isShareCanceled(error: unknown): boolean {
  return error instanceof Error && error.message === "Share canceled";
}

export function getSessionTree(sessionId: string) {
  return getBridgeTrpc().sessions.tree.query({ id: sessionId });
}

export function navigateSessionTree(sessionId: string, opts: { entryId: string; summarize?: boolean }) {
  return getBridgeTrpc().sessions.navigateTree.mutate({ id: sessionId, ...opts });
}

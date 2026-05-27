/**
 * Persistent settings + per-session cursor.
 *
 * Backed by @capacitor/preferences which is Keychain/Keystore-backed on
 * device and falls back to localStorage in the browser — same code, both
 * environments.
 */
import { Preferences } from "@capacitor/preferences";

const DEFAULT_BRIDGE_URL = "http://localhost:7777";

export async function getBridgeUrl(): Promise<string> {
  const { value } = await Preferences.get({ key: "bridge_url" });
  return value?.trim() || DEFAULT_BRIDGE_URL;
}

export async function setBridgeUrl(url: string): Promise<void> {
  await Preferences.set({ key: "bridge_url", value: url.trim() });
}

export async function getCursor(sessionId: string): Promise<number> {
  const { value } = await Preferences.get({ key: `cursor:${sessionId}` });
  const n = value ? Number(value) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function setCursor(sessionId: string, cursor: number): Promise<void> {
  await Preferences.set({
    key: `cursor:${sessionId}`,
    value: String(cursor),
  });
}

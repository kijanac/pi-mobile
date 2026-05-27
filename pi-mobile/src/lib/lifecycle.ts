import { createSignal } from "solid-js";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/**
 * App lifecycle wiring.
 *
 * On iOS/Android the OS may silently terminate the app's WebSocket
 * while the app is backgrounded — but the socket's onClose doesn't
 * always fire, so the auto-reconnect loop in connectStream never trips.
 * The visible symptom: user opens the app, sends a message, nothing
 * happens.
 *
 * Fix: on `App.resume`, bump `resumeTick`. Session.tsx observes the
 * signal and calls `handle.reconnect()` to force a fresh socket. The
 * partysocket library's `reconnect()` closes the existing connection
 * and immediately retries, so we don't lose the buffered cursor.
 *
 * The `pause` event is a no-op for us: every wire event is persisted to
 * IndexedDB as it arrives (via the cursor store), so background → kill
 * → relaunch already restores state from `?cursor=N` on the next open.
 */

export const [resumeTick, setResumeTick] = createSignal(0);

let installed = false;

export function installAppLifecycle(): void {
  if (installed) return;
  installed = true;
  // The App plugin's web shim is a no-throw stub that simply never
  // fires resume/pause — so we can register listeners unconditionally,
  // but we skip on web to avoid the empty Promise<PluginListenerHandle>
  // hanging around.
  if (!Capacitor.isNativePlatform()) return;

  void App.addListener("resume", () => {
    setResumeTick((n) => n + 1);
  });
  // pause/appStateChange intentionally not wired — see file comment.
}

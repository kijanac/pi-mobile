import { createSignal, onCleanup, onMount } from "solid-js";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

/**
 * Speech-to-text primitive.
 *
 * Wraps @capacitor-community/speech-recognition with a small Solid API:
 *
 *   const stt = createSpeechRecognition();
 *   stt.available()    // null while probing, then boolean
 *   stt.listening()    // boolean reflecting plugin state
 *   stt.transcript()   // current best-guess text (updated on partialResults)
 *   stt.start()        // request permission, begin listening
 *   stt.stop()         // stop and resolve final transcript
 *
 * Platform notes:
 *   - Web: the plugin's WebPlugin shim throws "not implemented" on every
 *     method, including available(). We short-circuit via Capacitor's
 *     platform detection — on web, available() resolves to false and
 *     start()/stop() are no-ops.
 *   - iOS uses SFSpeechRecognizer; Android uses the system SpeechRecognizer.
 *     Both support partialResults.
 *
 * Permission flow:
 *   - checkPermissions() returns 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'.
 *   - On first start(), if permission isn't already granted, we call
 *     requestPermissions() and bail out if the user denies.
 */
export interface SpeechRecognitionHandle {
  available: () => boolean | null;
  listening: () => boolean;
  transcript: () => string;
  start: () => Promise<void>;
  stop: () => Promise<string>;
  reset: () => void;
}

export function createSpeechRecognition(opts?: {
  language?: string;
}): SpeechRecognitionHandle {
  const language = opts?.language ?? "en-US";

  const [available, setAvailable] = createSignal<boolean | null>(null);
  const [listening, setListening] = createSignal(false);
  const [transcript, setTranscript] = createSignal("");

  let partialHandle: PluginListenerHandle | null = null;
  let stateHandle: PluginListenerHandle | null = null;
  let detached = false;

  /* ── probe availability on mount ────────────────────────────────── */
  onMount(async () => {
    if (!Capacitor.isNativePlatform()) {
      // WebPlugin throws on every method; never call into it.
      setAvailable(false);
      return;
    }
    try {
      const { available: ok } = await SpeechRecognition.available();
      if (!detached) setAvailable(!!ok);
    } catch (e) {
      console.warn("[stt] available() failed:", e);
      if (!detached) setAvailable(false);
    }
  });

  /* ── helpers ────────────────────────────────────────────────────── */
  async function ensurePermission(): Promise<boolean> {
    try {
      const status = await SpeechRecognition.checkPermissions();
      if (status.speechRecognition === "granted") return true;
      const requested = await SpeechRecognition.requestPermissions();
      return requested.speechRecognition === "granted";
    } catch (e) {
      console.warn("[stt] permission flow failed:", e);
      return false;
    }
  }

  async function attachListeners() {
    if (partialHandle) return;
    partialHandle = await SpeechRecognition.addListener(
      "partialResults",
      ({ matches }) => {
        if (matches && matches.length > 0) {
          setTranscript(matches[0]);
        }
      },
    );
    stateHandle = await SpeechRecognition.addListener(
      "listeningState",
      ({ status }) => {
        setListening(status === "started");
      },
    );
  }

  async function detachListeners() {
    try {
      await partialHandle?.remove();
    } catch {
      // Ignore — listener may already be gone after stop().
    }
    try {
      await stateHandle?.remove();
    } catch {
      /* ignore */
    }
    partialHandle = null;
    stateHandle = null;
  }

  /* ── public API ─────────────────────────────────────────────────── */
  const start: SpeechRecognitionHandle["start"] = async () => {
    if (!available()) return;
    if (listening()) return;

    const granted = await ensurePermission();
    if (!granted) return;

    setTranscript("");
    setListening(true);
    await attachListeners();

    try {
      await SpeechRecognition.start({
        language,
        partialResults: true,
        // Android-only: don't show the system dialog; we own the UI.
        popup: false,
      });
    } catch (e) {
      console.warn("[stt] start() failed:", e);
      setListening(false);
      await detachListeners();
    }
  };

  const stop: SpeechRecognitionHandle["stop"] = async () => {
    if (!listening() && !partialHandle) return transcript();
    try {
      await SpeechRecognition.stop();
    } catch (e) {
      console.warn("[stt] stop() failed:", e);
    }
    setListening(false);
    await detachListeners();
    return transcript();
  };

  const reset = () => {
    setTranscript("");
  };

  /* ── cleanup ────────────────────────────────────────────────────── */
  onCleanup(() => {
    detached = true;
    if (listening() || partialHandle) {
      void (async () => {
        try {
          await SpeechRecognition.stop();
        } catch {
          /* ignore */
        }
        await detachListeners();
      })();
    }
  });

  return { available, listening, transcript, start, stop, reset };
}

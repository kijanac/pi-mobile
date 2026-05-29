import { createSignal, onCleanup, onMount } from "solid-js";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

interface SpeechRecognitionHandle {
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

  onMount(async () => {
    if (!Capacitor.isNativePlatform()) {
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
    }
    try {
      await stateHandle?.remove();
    } catch {
    }
    partialHandle = null;
    stateHandle = null;
  }

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

  onCleanup(() => {
    detached = true;
    if (listening() || partialHandle) {
      void (async () => {
        try {
          await SpeechRecognition.stop();
        } catch {
        }
        await detachListeners();
      })();
    }
  });

  return { available, listening, transcript, start, stop, reset };
}

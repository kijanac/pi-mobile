import { createSignal } from "solid-js";
import { Capacitor } from "@capacitor/core";
import {
  Keyboard,
  KeyboardResize,
  KeyboardStyle,
} from "@capacitor/keyboard";

const [keyboardHeight, setKeyboardHeight] = createSignal(0);
export { keyboardHeight };

let initialized = false;

/**
 * Native chat-style keyboard handling.
 *
 * Capacitor's default iOS behavior resizes the whole WebView, which makes
 * `dvh` layouts and sticky app chrome jump. We keep the WebView stable and
 * expose the keyboard height so the input bar/message list can move/space
 * themselves explicitly.
 */
export function ensureKeyboardTracking(): void {
  if (initialized) return;
  initialized = true;

  if (!Capacitor.isNativePlatform()) return;

  void Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});
  void Keyboard.setStyle({ style: KeyboardStyle.Dark }).catch(() => {});

  void Keyboard.addListener("keyboardWillShow", (info) => {
    setKeyboardHeight(info.keyboardHeight ?? 0);
  });
  void Keyboard.addListener("keyboardDidShow", (info) => {
    setKeyboardHeight(info.keyboardHeight ?? 0);
  });
  void Keyboard.addListener("keyboardWillHide", () => {
    setKeyboardHeight(0);
  });
  void Keyboard.addListener("keyboardDidHide", () => {
    setKeyboardHeight(0);
  });
}

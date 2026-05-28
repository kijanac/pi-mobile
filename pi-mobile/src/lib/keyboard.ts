import { createSignal, onCleanup, onMount } from "solid-js";
import { Capacitor } from "@capacitor/core";
import {
  Keyboard,
  KeyboardResize,
  KeyboardStyle,
} from "@capacitor/keyboard";

const [keyboardHeight, setKeyboardHeight] = createSignal(0);
export { keyboardHeight };

let listenersInitialized = false;
let chatResizeLocks = 0;

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Global keyboard event tracking. This deliberately does not choose a resize
 * mode; individual screens opt into manual keyboard avoidance only while they
 * need it. Leaving resize mode at `none` globally causes normal forms/settings
 * sheets to be covered by the keyboard.
 */
export function ensureKeyboardTracking(): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  if (!isNative()) return;

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

function acquireManualResize(): void {
  ensureKeyboardTracking();
  if (!isNative()) return;
  chatResizeLocks += 1;
  if (chatResizeLocks === 1) {
    void Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});
  }
}

function releaseManualResize(): void {
  if (!isNative()) return;
  chatResizeLocks = Math.max(0, chatResizeLocks - 1);
  if (chatResizeLocks === 0) {
    setKeyboardHeight(0);
    void Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
  }
}

/** Enable chat-style manual keyboard avoidance for this component lifetime. */
export function useManualKeyboardAvoidance(): void {
  onMount(acquireManualResize);
  onCleanup(releaseManualResize);
}

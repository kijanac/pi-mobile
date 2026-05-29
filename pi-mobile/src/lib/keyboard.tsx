import { createContext, createSignal, onCleanup, onMount, useContext, type Accessor, type JSX } from "solid-js";
import { Capacitor } from "@capacitor/core";
import {
  Keyboard,
  KeyboardResize,
  KeyboardStyle,
} from "@capacitor/keyboard";

type KeyboardAvoidanceMode = "native" | "manual";

const [nativeKeyboardHeight, setNativeKeyboardHeight] = createSignal(0);
const [viewportKeyboardHeight, setViewportKeyboardHeight] = createSignal(0);
const keyboardHeight = () => Math.max(nativeKeyboardHeight(), viewportKeyboardHeight());

const KeyboardAvoidanceContext = createContext<KeyboardAvoidanceMode>("native");

let listenersInitialized = false;
let manualResizeLocks = 0;

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function updateViewportKeyboardHeight(): void {
  const vv = window.visualViewport;
  if (!vv) {
    setViewportKeyboardHeight(0);
    return;
  }

  const occluded = window.innerHeight - vv.height - vv.offsetTop;
  setViewportKeyboardHeight(Math.max(0, Math.round(occluded)));
}

function ensureKeyboardTracking(): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  window.visualViewport?.addEventListener("resize", updateViewportKeyboardHeight);
  window.visualViewport?.addEventListener("scroll", updateViewportKeyboardHeight);
  window.addEventListener("resize", updateViewportKeyboardHeight);
  updateViewportKeyboardHeight();

  if (!isNative()) return;

  void Keyboard.setStyle({ style: KeyboardStyle.Dark }).catch(() => {});

  void Keyboard.addListener("keyboardWillShow", (info) => {
    setNativeKeyboardHeight(info.keyboardHeight ?? 0);
  });
  void Keyboard.addListener("keyboardDidShow", (info) => {
    setNativeKeyboardHeight(info.keyboardHeight ?? 0);
  });
  void Keyboard.addListener("keyboardWillHide", () => {
    setNativeKeyboardHeight(0);
    updateViewportKeyboardHeight();
  });
  void Keyboard.addListener("keyboardDidHide", () => {
    setNativeKeyboardHeight(0);
    updateViewportKeyboardHeight();
  });
}

function acquireManualResize(): void {
  ensureKeyboardTracking();
  if (!isNative()) return;
  manualResizeLocks += 1;
  if (manualResizeLocks === 1) {
    void Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});
  }
}

function releaseManualResize(): void {
  if (!isNative()) return;
  manualResizeLocks = Math.max(0, manualResizeLocks - 1);
  if (manualResizeLocks === 0) {
    setNativeKeyboardHeight(0);
    setViewportKeyboardHeight(0);
    void Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
  }
}

export function KeyboardAvoidance(props: {
  mode: KeyboardAvoidanceMode;
  children: JSX.Element;
}) {
  onMount(() => {
    ensureKeyboardTracking();
    if (props.mode === "manual") acquireManualResize();
  });

  onCleanup(() => {
    if (props.mode === "manual") releaseManualResize();
  });

  return (
    <KeyboardAvoidanceContext.Provider value={props.mode}>
      <div
        class="flex h-dvh min-h-0 flex-col overflow-hidden"
        style={{ "padding-bottom": props.mode === "manual" ? `${keyboardHeight()}px` : "0px" }}
      >
        {props.children}
      </div>
    </KeyboardAvoidanceContext.Provider>
  );
}

function useKeyboardAvoidanceMode(): KeyboardAvoidanceMode {
  return useContext(KeyboardAvoidanceContext);
}

export function useKeyboardInset(options?: { enabled?: Accessor<boolean> }): Accessor<number> {
  const mode = useKeyboardAvoidanceMode();
  return () => (mode === "manual" && (options?.enabled?.() ?? true) ? keyboardHeight() : 0);
}

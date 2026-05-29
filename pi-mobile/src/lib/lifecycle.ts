import { createSignal } from "solid-js";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";


const [resumeTickSignal, setResumeTick] = createSignal(0);
export const resumeTick = resumeTickSignal;

let installed = false;

export function installAppLifecycle(): void {
  if (installed) return;
  installed = true;
  if (!Capacitor.isNativePlatform()) return;

  void App.addListener("resume", () => {
    setResumeTick((n) => n + 1);
  });
}

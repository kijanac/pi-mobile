import { createSignal } from "solid-js";
import type { ClientEvent } from "@pi-mobile/protocol";

type ConnState =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "offline"
  | "gone"
  | "error";

export const [connState, setConnState] = createSignal<ConnState>("offline");

export const [activeSend, setActiveSend] =
  createSignal<((e: ClientEvent) => void) | null>(null);

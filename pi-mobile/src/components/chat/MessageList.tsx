import { For, createEffect, on, onMount, onCleanup, type JSX } from "solid-js";
import { entries } from "~/stores/sessions";
import { ensureKeyboardTracking, keyboardHeight } from "~/lib/keyboard";
import UserMessageView from "./UserMessage";
import AssistantMessageView from "./AssistantMessage";
import ToolCallView from "./ToolCall";
import PermissionGate from "./PermissionGate";

/** Px from the bottom within which we consider the user "stuck to bottom". */
const STICK_THRESHOLD_PX = 64;

export default function MessageList(): JSX.Element {
  let scroller!: HTMLDivElement;
  let stick = true;

  ensureKeyboardTracking();

  // Track whether the user is near the bottom. If they scroll up, we stop
  // auto-scrolling so they can read past output without getting yanked.
  function onScroll() {
    const distance =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    stick = distance < STICK_THRESHOLD_PX;
  }

  onMount(() => {
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.scrollTop = scroller.scrollHeight;
  });
  onCleanup(() => scroller?.removeEventListener("scroll", onScroll));

  // Total content length is a cheap-to-compute reactive signal that captures
  // both "new entry pushed" and "streaming assistant text grew".
  const contentLength = () => {
    let n = entries().length;
    for (const e of entries()) {
      if (e.kind === "assistant") n += e.text.length;
    }
    return n;
  };

  createEffect(
    on(contentLength, () => {
      if (stick) scroller.scrollTop = scroller.scrollHeight;
    }),
  );

  return (
    <div
      ref={scroller}
      class="scroll-momentum flex-1 overflow-y-auto py-2"
      style={{ "padding-bottom": `calc(${keyboardHeight()}px + 0.5rem)` }}
    >
      <For each={entries()}>
        {(entry) => {
          switch (entry.kind) {
            case "user":
              return <UserMessageView msg={entry} />;
            case "assistant":
              return <AssistantMessageView msg={entry} />;
            case "tool_call":
              return <ToolCallView msg={entry} />;
            case "permission":
              return <PermissionGate req={entry} />;
          }
        }}
      </For>
    </div>
  );
}

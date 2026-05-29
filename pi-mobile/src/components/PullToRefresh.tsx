import {
  createSignal,
  onCleanup,
  Show,
  type JSX,
} from "solid-js";
import { Loader2 } from "lucide-solid";
import { haptic } from "@/lib/haptics";


const THRESHOLD = 64;
const MAX_PULL = 110;
const RUBBER_BAND = 0.45;

export default function PullToRefresh(props: {
  onRefresh: () => Promise<void>;
  children: JSX.Element;
  class?: string;
}) {
  const [pull, setPull] = createSignal(0);
  const [refreshing, setRefreshing] = createSignal(false);

  let container: HTMLDivElement | undefined;
  let startY: number | null = null;
  let crossed = false;

  function onTouchStart(e: TouchEvent) {
    if (refreshing()) return;
    if (e.touches.length !== 1) return;
    if ((container?.scrollTop ?? 0) > 0) {
      startY = null;
      return;
    }
    startY = e.touches[0].clientY;
    crossed = false;
  }

  function onTouchMove(e: TouchEvent) {
    if (startY === null || refreshing()) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) {
      setPull(0);
      startY = null;
      return;
    }
    const raw = dy * RUBBER_BAND;
    const eased = Math.min(MAX_PULL, raw);
    setPull(eased);
    if (eased >= THRESHOLD && !crossed) {
      crossed = true;
      haptic.light();
    } else if (eased < THRESHOLD && crossed) {
      crossed = false;
    }
  }

  function onTouchEnd() {
    if (startY === null || refreshing()) {
      setPull(0);
      startY = null;
      return;
    }
    if (pull() >= THRESHOLD) {
      setPull(THRESHOLD);
      setRefreshing(true);
      void props
        .onRefresh()
        .catch((e) => console.warn("[ptr] onRefresh threw:", e))
        .finally(() => {
          setRefreshing(false);
          setPull(0);
        });
    } else {
      setPull(0);
    }
    startY = null;
    crossed = false;
  }

  onCleanup(() => {
  });

  const progress = () => Math.min(1, pull() / THRESHOLD);

  return (
    <div
      ref={container}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      class={`relative overflow-y-auto ${props.class ?? ""}`}
      style={{ "overscroll-behavior-y": "contain" }}
    >
      <Show when={pull() > 0 || refreshing()}>
        <div
          class="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-center"
          style={{
            height: `${pull()}px`,
            transition: refreshing() ? "height 120ms ease-out" : "none",
          }}
        >
          <Loader2
            size={16}
            class="text-[color:var(--color-fg-muted)]"
            style={{
              opacity: refreshing() ? 1 : progress(),
              transform: refreshing()
                ? undefined
                : `rotate(${progress() * 360}deg)`,
              animation: refreshing() ? "spin 1s linear infinite" : "none",
            }}
          />
        </div>
      </Show>

      <div
        style={{
          transform: `translateY(${pull()}px)`,
          transition:
            pull() === 0 || refreshing() ? "transform 120ms ease-out" : "none",
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

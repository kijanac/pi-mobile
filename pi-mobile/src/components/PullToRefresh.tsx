import {
  createSignal,
  onCleanup,
  Show,
  type JSX,
} from "solid-js";
import { Loader2 } from "lucide-solid";
import { haptic } from "~/lib/haptics";

/**
 * Pull-to-refresh, mobile-first.
 *
 * Wraps a scrollable region. When the user pulls down from scrollTop=0,
 * an indicator slides in proportional to the pull distance with a soft
 * rubber-band curve. Past `THRESHOLD` the user feels a haptic tick and
 * releasing fires `onRefresh`; the spinner stays visible until the
 * returned promise resolves.
 *
 * Why roll our own:
 *   - @capacitor/refresher is Ionic-component-shaped and we're not on
 *     Ionic. The math is ~30 lines and the visual ~30 more.
 *   - Pull from anywhere except scrollTop=0 is left to the browser, so
 *     normal scrolling is undisturbed.
 *   - We use only passive touch listeners; no preventDefault, no
 *     scrolling lockout. The pull animation overlays content.
 *
 * Container layout: the component owns the scroll. Pass children that
 * fill the viewport — it'll mount them inside an `overflow-y-auto`
 * div with `overscroll-behavior: contain` (kills the iOS rubber-band
 * conflict).
 */

const THRESHOLD = 64; // px the user must pull to trigger refresh
const MAX_PULL = 110; // visual cap so the indicator doesn't fly off
const RUBBER_BAND = 0.45; // 1.0 = follow finger; <1 = soft resistance

export default function PullToRefresh(props: {
  onRefresh: () => Promise<void>;
  children: JSX.Element;
  /** Extra classes for the scroll container (e.g. flex-1). */
  class?: string;
}): JSX.Element {
  const [pull, setPull] = createSignal(0); // current visible pull distance, px
  const [refreshing, setRefreshing] = createSignal(false);

  let container: HTMLDivElement | undefined;
  let startY: number | null = null;
  let crossed = false; // armed once we cross the threshold while pulling

  function onTouchStart(e: TouchEvent) {
    if (refreshing()) return;
    if (e.touches.length !== 1) return;
    // Only start tracking when we're already at the top — otherwise
    // the user is just scrolling.
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
      // User reversed direction (scrolling up) — disengage.
      setPull(0);
      startY = null;
      return;
    }
    // Soft rubber-band: each pixel of finger movement counts for less
    // as we approach MAX_PULL.
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
      // Snap to a stable resting position while the refresh runs.
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
    // No window-level listeners to detach — touchstart/move/end are on
    // the container, which Solid removes naturally.
  });

  // Progress for the indicator: 0..1 toward threshold, beyond stays 1.
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
      {/* Indicator: positioned absolutely above the content, slides
          down with the pull and stays visible during refresh. */}
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

      {/* Content is pushed down by the pull so the indicator sits above
          it without overlap. translateY is GPU-accelerated; cheap. */}
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

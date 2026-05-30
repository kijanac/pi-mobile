import { createSignal, type JSX } from "solid-js";
import { haptic } from "@/lib/haptics";

const SWIPE_THRESHOLD_PX = 44;
const AXIS_LOCK_PX = 10;
const VERTICAL_CANCEL_PX = 48;

export default function SwipeActionRow(props: {
  open: boolean;
  actionWidth: number;
  actionCount: number;
  actions: JSX.Element;
  children: JSX.Element;
  onOpen: () => void;
  onClose: () => void;
}) {
  let startX = 0;
  let startY = 0;
  let startOpen = false;
  let tracking = false;
  let dragging = false;
  let suppressClick = false;
  const [dragOffset, setDragOffset] = createSignal<number | null>(null);

  const actionsWidth = () => props.actionWidth * props.actionCount;
  const offset = () => dragOffset() ?? (props.open ? actionsWidth() : 0);

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (!touch) return;

    startX = touch.clientX;
    startY = touch.clientY;
    startOpen = props.open;
    tracking = true;
    dragging = false;
    suppressClick = false;
    if (!startOpen) props.onClose();
    setDragOffset(startOpen ? actionsWidth() : 0);
  }

  function onTouchMove(e: TouchEvent) {
    if (!tracking || e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (!dragging) {
      if (absDx < AXIS_LOCK_PX && absDy < AXIS_LOCK_PX) return;
      if (absDx <= absDy || absDy > VERTICAL_CANCEL_PX) {
        tracking = false;
        setDragOffset(null);
        if (startOpen) props.onClose();
        return;
      }
      dragging = true;
      suppressClick = true;
    }

    e.preventDefault();
    const next = Math.max(0, Math.min(actionsWidth(), (startOpen ? actionsWidth() : 0) - dx));
    setDragOffset(next);
  }

  function finishSwipe(commitAllowed = true) {
    if (!tracking && dragOffset() === null) return;
    const nextOpen = commitAllowed && offset() > SWIPE_THRESHOLD_PX;
    const buzz = nextOpen && !startOpen;

    tracking = false;
    dragging = false;
    setDragOffset(null);

    if (nextOpen) {
      if (buzz) haptic.medium();
      props.onOpen();
    } else {
      props.onClose();
    }
  }

  function onClick(e: MouseEvent) {
    if (!suppressClick && !props.open) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick = false;
    if (props.open) props.onClose();
  }

  return (
    <div data-swipe-action-row="" class="hairline-b relative overflow-hidden bg-[color:var(--color-bg)]">
      <div class="absolute inset-y-0 right-0 flex">{props.actions}</div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => finishSwipe()}
        onTouchCancel={() => finishSwipe(false)}
        onClick={onClick}
        class="bg-[color:var(--color-bg)]"
        style={{
          transform: `translateX(-${offset()}px)`,
          transition: dragOffset() === null ? "transform 160ms ease-out" : "none",
          "touch-action": "pan-y",
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

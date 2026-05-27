import { Show, type JSX } from "solid-js";
import { Loader2 } from "lucide-solid";
import { activeRetry } from "~/stores/sessions";

/**
 * Transient banner that appears while pi is in an auto-retry window
 * (between `auto_retry_start` and `auto_retry_end` wire events).
 *
 * Without this, the user sees the assistant streaming, then a silent
 * pause of `delayMs`, then either streaming resumes or an error
 * banner appears on the bubble. The pause is unexplained. The banner
 * fills the gap with "retrying N of M — <reason>".
 *
 * Renders nothing when `activeRetry()` is null, so it's safe to mount
 * unconditionally near the top of the chat view.
 */
export default function RetryBanner(): JSX.Element {
  return (
    <Show when={activeRetry()}>
      {(r) => (
        <div
          class="hairline-b flex items-center gap-2 px-3 py-1.5 text-[11px] text-[color:var(--color-warning,#d97706)]"
          role="status"
          aria-live="polite"
        >
          <Loader2 size={12} class="shrink-0 animate-spin" />
          <span class="font-medium tabular-nums">
            retrying {r().attempt} of {r().maxAttempts}
          </span>
          <span class="min-w-0 flex-1 truncate text-[color:var(--color-fg-muted)]">
            — {r().errorMessage}
          </span>
        </div>
      )}
    </Show>
  );
}

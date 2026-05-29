import { Show } from "solid-js";
import { Loader2 } from "lucide-solid";
import { activeRetry } from "@/stores/sessions";

export default function RetryBanner() {
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

import { createSignal, createEffect, on, Show, type JSX } from "solid-js";
import { X, Check } from "lucide-solid";

/**
 * Single-field rename sheet. Pre-fills with `initialTitle` and emits
 * `onSave(newTitle)` on commit. The caller wires the API call and is
 * responsible for closing the sheet on completion or error.
 *
 *   <RenameSheet
 *     open={renameOpen()}
 *     initialTitle={session().title}
 *     onCancel={...}
 *     onSave={async (t) => { await patchSession(...); close(); }} />
 */
export default function RenameSheet(props: {
  open: boolean;
  initialTitle: string;
  saving?: boolean;
  onCancel: () => void;
  onSave: (newTitle: string) => void;
}): JSX.Element {
  const [value, setValue] = createSignal("");

  // Reset to the initial title every time the sheet opens. We track
  // `open` rather than `initialTitle` so reopening for the same
  // session doesn't surprise the user with stale edits.
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) setValue(props.initialTitle);
      },
    ),
  );

  function commit() {
    const v = value().trim();
    if (v.length === 0 || props.saving) return;
    props.onSave(v);
  }

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 bg-[color:var(--color-bg)]/60 backdrop-blur-sm">
        <div
          class="absolute inset-x-0 bottom-0 flex flex-col rounded-t-[12px] border-t border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)]"
          style={{
            "padding-bottom":
              "calc(env(safe-area-inset-bottom) + 0.5rem)",
          }}
        >
          <div class="flex justify-center py-2">
            <div class="h-1 w-9 rounded-full bg-[color:var(--color-border-strong)]" />
          </div>

          <div class="hairline-b flex items-center justify-between px-3 pb-2">
            <span class="text-[13px] font-medium">Rename session</span>
            <button
              type="button"
              onClick={props.onCancel}
              class="flex h-8 w-8 items-center justify-center text-[color:var(--color-fg-muted)] active:bg-[color:var(--color-surface)]"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>

          <div class="px-3 pt-3 pb-2">
            <input
              autofocus
              type="text"
              value={value()}
              onInput={(e) => setValue(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              placeholder="session title"
              class="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:border-[color:var(--color-border-strong)] focus:outline-none"
            />
          </div>

          <div class="flex gap-2 px-3 pb-2 pt-1">
            <button
              type="button"
              onClick={props.onCancel}
              class="flex-1 rounded-[var(--radius-md)] border border-[color:var(--color-border)] py-2 text-[12px] active:bg-[color:var(--color-surface)]"
            >
              cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={
                props.saving ||
                value().trim().length === 0 ||
                value().trim() === props.initialTitle
              }
              class="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[color:var(--color-fg)] py-2 text-[12px] text-[color:var(--color-bg)] active:opacity-80 disabled:opacity-40"
            >
              <Check size={12} />
              {props.saving ? "saving…" : "save"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

import { createSignal, Show, type JSX } from "solid-js";
import { X, Folder, GitBranch, Plus } from "lucide-solid";
import CwdPicker from "./CwdPicker";

/**
 * New session sheet.
 *
 * Slides up from the bottom; covers the whole screen at >80% height so it
 * reads as a primary surface (not a quick popup). Form is just three
 * fields:
 *   - title       (free text, prefilled from cwd basename)
 *   - cwd         (chip that opens CwdPicker)
 *   - branch      (free text, optional)
 *
 * The "create" button is disabled until cwd is set. Title falls back to
 * the cwd basename if blank.
 */
interface Props {
  /** Whether the sheet is open. Parent controls visibility. */
  open: boolean;
  onCancel: () => void;
  onCreate: (opts: { cwd: string; title: string; branch?: string }) => void;
  /** Disable the create button while the parent is in-flight. */
  creating?: boolean;
}

function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

export default function NewSessionSheet(props: Props): JSX.Element {
  const [cwd, setCwd] = createSignal<string | null>(null);
  const [title, setTitle] = createSignal("");
  const [branch, setBranch] = createSignal("");
  const [pickerOpen, setPickerOpen] = createSignal(false);
  // Whether the title has been edited by the user — once they touch it,
  // we stop auto-filling from cwd basename.
  const [titleTouched, setTitleTouched] = createSignal(false);

  const effectiveTitle = () => {
    const t = title().trim();
    if (t.length > 0) return t;
    const c = cwd();
    return c ? basename(c) : "";
  };

  const canCreate = () =>
    cwd() !== null && cwd()!.length > 0 && !props.creating;

  function handleCreate() {
    const c = cwd();
    if (!c) return;
    props.onCreate({
      cwd: c,
      title: effectiveTitle(),
      branch: branch().trim() || undefined,
    });
  }

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-40 bg-[color:var(--color-bg)]/60 backdrop-blur-sm">
        {/* Sheet */}
        <div
          class="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[12px] border-t border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)]"
          style={{
            "padding-bottom": "calc(env(safe-area-inset-bottom) + 0.5rem)",
          }}
        >
          {/* drag handle */}
          <div class="flex justify-center py-2">
            <div class="h-1 w-9 rounded-full bg-[color:var(--color-border-strong)]" />
          </div>

          {/* header */}
          <div class="flex items-center justify-between px-3 pb-2">
            <span class="text-[13px] font-medium">new session</span>
            <button
              type="button"
              onClick={props.onCancel}
              class="flex h-8 w-8 items-center justify-center text-[color:var(--color-fg-muted)] active:bg-[color:var(--color-surface)]"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* fields */}
          <div class="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
            {/* cwd */}
            <Field label="cwd">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                class="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-left active:bg-[color:var(--color-surface-2)]"
              >
                <Folder
                  size={13}
                  class="shrink-0 text-[color:var(--color-fg-muted)]"
                />
                <Show
                  when={cwd()}
                  fallback={
                    <span class="text-[12.5px] text-[color:var(--color-fg-faint)]">
                      choose a directory…
                    </span>
                  }
                >
                  <span class="min-w-0 flex-1 truncate text-[12.5px]">
                    {cwd()}
                  </span>
                </Show>
              </button>
            </Field>

            {/* title */}
            <Field label="title">
              <input
                type="text"
                value={title()}
                onInput={(e) => {
                  setTitle(e.currentTarget.value);
                  if (!titleTouched()) setTitleTouched(true);
                }}
                placeholder={cwd() ? basename(cwd()!) : "session title"}
                class="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-[12.5px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:border-[color:var(--color-border-strong)] focus:outline-none"
              />
            </Field>

            {/* branch */}
            <Field label="branch (optional)">
              <div class="flex items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-0.5 focus-within:border-[color:var(--color-border-strong)]">
                <GitBranch
                  size={12}
                  class="shrink-0 text-[color:var(--color-fg-muted)]"
                />
                <input
                  type="text"
                  value={branch()}
                  onInput={(e) => setBranch(e.currentTarget.value)}
                  placeholder="main"
                  class="w-full bg-transparent py-2 text-[12.5px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none"
                />
              </div>
            </Field>
          </div>

          {/* create */}
          <div class="px-3 pt-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate()}
              class="flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[color:var(--color-accent)] text-[12px] font-medium text-[color:var(--color-bg)] active:opacity-80 disabled:opacity-40"
            >
              <Plus size={14} strokeWidth={2.5} />
              {props.creating ? "creating…" : "create session"}
            </button>
          </div>
        </div>

        {/* cwd picker overlays the sheet */}
        <Show when={pickerOpen()}>
          <CwdPicker
            initial={cwd() ?? undefined}
            onSelect={(p) => {
              setCwd(p);
              setPickerOpen(false);
            }}
            onCancel={() => setPickerOpen(false)}
          />
        </Show>
      </div>
    </Show>
  );
}

/* ── primitive ───────────────────────────────────────────────────────── */

function Field(props: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <label class="block">
      <div class="label mb-1.5">{props.label}</div>
      {props.children}
    </label>
  );
}

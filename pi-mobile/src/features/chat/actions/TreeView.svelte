<script lang="ts">
  import { Loader2 } from "@lucide/svelte";
  import type { TreeEntry, SessionTree } from "@pi-mobile/protocol";
  import type { ActionErrorHandler } from "./types";
  import { getSessionTree, navigateSessionTree } from "@/features/chat/api";

  let { sessionId, onDone, onError }: { sessionId: string; onDone: () => void; onError: ActionErrorHandler } = $props();

  let jumping = $state<string | null>(null);
  let summarize = $state(false);
  let tree = $state<SessionTree | null>(null);
  let loading = $state(false);

  $effect(() => {
    void loadTree();
  });

  async function loadTree(): Promise<void> {
    loading = true;
    try {
      tree = await getSessionTree(sessionId);
    } catch (error) {
      onError(String(error));
    } finally {
      loading = false;
    }
  }

  async function jump(entry: TreeEntry): Promise<void> {
    if (jumping || entry.current) return;
    jumping = entry.id;
    onError(null);
    try {
      await navigateSessionTree(sessionId, { entryId: entry.id, summarize });
      onDone();
    } catch (error) {
      onError(String(error));
      await loadTree();
    } finally {
      jumping = null;
    }
  }
</script>

<div class="flex-1 overflow-y-auto py-2">
  <div class="px-3 pb-2">
    <button type="button" disabled={jumping !== null} onclick={() => (summarize = !summarize)} class="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-3 text-left active:bg-[color:var(--color-surface-2)] disabled:opacity-70">
      <span class="text-[12.5px] font-medium">summarize abandoned branch</span>
      <span class={summarize ? "text-[12px] text-[color:var(--color-accent)]" : "text-[12px] text-[color:var(--color-fg-faint)]"}>{summarize ? "on" : "off"}</span>
    </button>
  </div>
  {#if loading}<div class="px-3 py-3 text-[12px] text-[color:var(--color-fg-faint)]">loading tree…</div>{/if}
  {#if (tree?.entries.length ?? 0) === 0 && !loading}<div class="px-3 py-6 text-center text-[12px] text-[color:var(--color-fg-faint)]">no persisted tree entries yet</div>{/if}
  {#each tree?.entries ?? [] as entry (entry.id)}
    <button type="button" onclick={() => jump(entry)} disabled={jumping !== null || entry.current} class="hairline-b flex w-full items-start gap-2 px-3 py-2 text-left active:bg-[color:var(--color-surface)] disabled:opacity-75">
      <span class="pt-0.5 font-mono text-[10px] text-[color:var(--color-fg-faint)]" style:width={`${Math.max(0, entry.depth) * 12 + 12}px`}>{entry.childCount > 1 ? "├" : "│"}</span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-fg-faint)]">
          <span>{entry.role ?? entry.type}</span>
          {#if entry.current}<span class="text-[color:var(--color-accent)]">current</span>{/if}
          {#if entry.onCurrentPath && !entry.current}<span>path</span>{/if}
        </span>
        <span class="mt-0.5 line-clamp-2 block text-[12.5px] text-[color:var(--color-fg)]">{entry.label ? `${entry.label}: ` : ""}{entry.text || "—"}</span>
      </span>
      {#if jumping === entry.id}<Loader2 class="mt-1 size-3.5 animate-spin text-[color:var(--color-fg-muted)]" />{/if}
    </button>
  {/each}
</div>

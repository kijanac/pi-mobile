<script lang="ts">
  import { Check, Loader2, X } from "@lucide/svelte";
  import type { CompactionEntry } from "@pi-mobile/protocol";
  import { formatTokens } from "@/shared/lib/format";

  let { msg }: { msg: CompactionEntry } = $props();

  const isAuto = $derived(msg.reason === "threshold" || msg.reason === "overflow");
  const title = $derived.by(() => {
    if (msg.status === "running") return isAuto ? "auto compacting context…" : "compacting context…";
    if (msg.status === "success") return msg.willRetry ? "context compacted · retrying" : "context compacted";
    if (msg.status === "aborted") return "compaction cancelled";
    return "compaction failed";
  });
  const detail = $derived.by(() => {
    if (msg.errorMessage) return msg.errorMessage;
    if (msg.tokensBefore !== undefined) return `${formatTokens(msg.tokensBefore)} before compaction`;
    return undefined;
  });
</script>

<div class="px-3 py-1">
  <div class="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-[12px]">
    <span class="flex h-4 w-4 items-center justify-center">
      {#if msg.status === "running"}
        <Loader2 class="size-3 animate-spin text-[color:var(--color-accent)]" />
      {:else if msg.status === "success"}
        <Check class="size-3 text-[color:var(--color-fg-faint)]" />
      {:else}
        <X class="size-3 text-[color:var(--color-danger)]" />
      {/if}
    </span>
    <span class="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-fg-faint)]">context</span>
    <span class="min-w-0 flex-1 truncate text-[color:var(--color-fg)]">{title}</span>
    {#if detail}
      <span class="hidden max-w-[42%] truncate text-[10px] text-[color:var(--color-fg-faint)] tabular-nums min-[380px]:block">{detail}</span>
    {/if}
  </div>
</div>

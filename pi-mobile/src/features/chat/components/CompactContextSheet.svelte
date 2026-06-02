<script lang="ts">
  import CompactContextForm from "@/features/chat/components/CompactContextForm.svelte";
  import { haptics } from "@/shared/mobile/haptics";
  import * as Sheet from "@/shared/ui/sheet";

  let { open = $bindable(false), sessionId }: { open: boolean; sessionId: string } = $props();

  let error = $state<string | null>(null);

  function done(): void {
    haptics.success();
    open = false;
    error = null;
  }

  function reset(open: boolean): void {
    if (!open) error = null;
  }

  function setError(message: string | null): void {
    error = message;
  }
</script>

<Sheet.Root bind:open={() => open, (next) => {
  open = next;
  reset(next);
}}>
  <Sheet.Content side="bottom" class="flex flex-col gap-0 overflow-hidden rounded-t-[12px] border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] p-0 text-[color:var(--color-fg)] shadow-none" style="padding-bottom: calc(env(safe-area-inset-bottom) + 0.5rem)">
    <Sheet.Header class="hairline-b space-y-0 px-3 py-3 pr-12 text-left">
      <Sheet.Title class="min-w-0 flex-1 px-1 text-[13px] font-medium">compact context</Sheet.Title>
    </Sheet.Header>
    {#if error}
      <div class="mx-3 mt-3 rounded-[var(--radius-md)] border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/10 px-3 py-2 text-[11px] text-[color:var(--color-danger)]">
        {error}
      </div>
    {/if}
    <CompactContextForm {sessionId} onDone={done} onError={setError} />
  </Sheet.Content>
</Sheet.Root>

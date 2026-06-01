<script lang="ts">
  import { Loader2 } from "@lucide/svelte";
  import type { ActionErrorHandler } from "./types";
  import { getBridgeClient } from "@/shared/lib/bridge-client";
  import { Button } from "@/shared/ui/button";
  import { Textarea } from "@/shared/ui/textarea";

  let { sessionId, onDone, onError }: { sessionId: string; onDone: () => void; onError: ActionErrorHandler } = $props();

  let instructions = $state("");
  let running = $state(false);

  async function compact(): Promise<void> {
    if (running) return;
    running = true;
    onError(null);
    try {
      await getBridgeClient().compactSession(sessionId, instructions);
      onDone();
    } catch (error) {
      onError(String(error));
    } finally {
      running = false;
    }
  }
</script>

<div class="space-y-3 px-3 py-3">
  <p class="text-[11px] leading-relaxed text-[color:var(--color-fg-muted)]">
    Compaction summarizes older context for future model turns. The full session history stays on disk, but future prompts use the compacted summary to save context.
  </p>
  <label class="block">
    <span class="label mb-1.5 block">optional instructions</span>
    <Textarea bind:value={instructions} rows={4} placeholder="Preserve decisions, TODOs, file paths, and open questions…" class="text-[12.5px]" />
  </label>
  <Button type="button" variant="default" onclick={compact} disabled={running} class="w-full bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:bg-[color:var(--color-accent)] active:opacity-80">
    {#if running}<Loader2 class="size-3.5 animate-spin" />{/if}
    {running ? "compacting…" : "compact now"}
  </Button>
</div>

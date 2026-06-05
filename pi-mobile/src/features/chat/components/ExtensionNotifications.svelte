<script lang="ts">
  import { X } from "@lucide/svelte";
  import { Button } from "@/shared/ui/button";
  import { activeSessionState } from "@/features/chat/model/active-session.state.svelte";
</script>

{#if activeSessionState.extensionUiNotifications.length > 0}
  <div class="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+72px)] z-40 space-y-2">
    {#each activeSessionState.extensionUiNotifications as notice (notice.id)}
      <div class="pointer-events-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-3 shadow-lg">
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <div class="type-label uppercase tracking-[0.08em] text-[color:var(--color-fg-faint)]">extension {notice.level}</div>
            <div class="type-copy mt-1 whitespace-pre-wrap text-[color:var(--color-fg)]">{notice.message}</div>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss" onclick={() => activeSessionState.dismissExtensionNotification(notice.id)}>
            <X class="size-3.5" />
          </Button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<script lang="ts">
  import { MoreHorizontal } from "@lucide/svelte";
  import { haptics } from "@/shared/mobile/haptics";
  import AgentActionSheet from "@/features/chat/actions/AgentActionSheet.svelte";
  import AuthView from "@/features/chat/actions/AuthView.svelte";
  import CompactView from "@/features/chat/actions/CompactView.svelte";
  import MenuView from "@/features/chat/actions/MenuView.svelte";
  import SessionInfoView from "@/features/chat/actions/SessionInfoView.svelte";
  import SessionSettingsView from "@/features/chat/actions/SessionSettingsView.svelte";
  import TreeView from "@/features/chat/actions/TreeView.svelte";
  import type { AgentActionView } from "@/features/chat/actions/types";

  let { sessionId }: { sessionId: string } = $props();

  let open = $state(false);
  let view = $state<AgentActionView>("menu");
  let error = $state<string | null>(null);

  function close(): void {
    open = false;
    view = "menu";
    error = null;
  }

  function back(): void {
    view = "menu";
    error = null;
  }

  function done(): void {
    haptics.success();
    close();
  }
</script>

<button
  type="button"
  onclick={() => (open = true)}
  class="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-fg-muted)] active:bg-[color:var(--color-surface)]"
  aria-label="Agent actions"
  title="Agent actions"
>
  <MoreHorizontal class="size-4" />
</button>

{#if open}
  <AgentActionSheet bind:open {view} {error} onBack={back}>
    {#if view === "menu"}
      <MenuView
        onModels={() => (view = "models")}
        onCompact={() => (view = "compact")}
        onSettings={() => (view = "settings")}
        onTree={() => (view = "tree")}
        onInfo={() => (view = "info")}
        onAuth={() => (view = "auth")}
      />
    {:else if view === "models"}
      <SessionSettingsView {sessionId} onError={(message) => (error = message)} filterKeys={["model"]} />
    {:else if view === "compact"}
      <CompactView {sessionId} onDone={done} onError={(message) => (error = message)} />
    {:else if view === "settings"}
      <SessionSettingsView {sessionId} onError={(message) => (error = message)} />
    {:else if view === "tree"}
      <TreeView {sessionId} onDone={done} onError={(message) => (error = message)} />
    {:else if view === "info"}
      <SessionInfoView {sessionId} />
    {:else if view === "auth"}
      <AuthView onError={(message) => (error = message)} />
    {/if}
  </AgentActionSheet>
{/if}

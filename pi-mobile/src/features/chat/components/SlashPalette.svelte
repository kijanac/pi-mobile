<script lang="ts">
  import { onDestroy } from "svelte";
  import { FileText, Hash, Search, Sparkles } from "@lucide/svelte";
  import type { CommandEntry, Commands } from "@/shared/lib/api-client";
  import { getBridgeClient } from "@/shared/lib/bridge-client";
  import { Input } from "@/shared/ui/input";
  import * as Sheet from "@/shared/ui/sheet";

  let {
    open = $bindable(false),
    sessionId,
    onPick,
  }: {
    open: boolean;
    sessionId: string;
    onPick: (text: string) => void;
  } = $props();

  let query = $state("");
  let commands = $state<Commands | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let loadToken = 0;

  const builtins = $derived(matches(commands?.builtins));
  const prompts = $derived(matches(commands?.prompts));
  const skills = $derived(matches(commands?.skills));
  const total = $derived(builtins.length + prompts.length + skills.length);

  $effect(() => {
    if (!open) return;
    query = "";
    void loadCommands();
  });

  $effect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") open = false;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  onDestroy(() => {
    loadToken += 1;
  });

  async function loadCommands(): Promise<void> {
    const token = ++loadToken;
    loading = true;
    error = null;
    try {
      const client = getBridgeClient();
      const next = await client.listCommands(sessionId);
      if (token !== loadToken) return;
      commands = next;
    } catch (caught) {
      if (token !== loadToken) return;
      error = String(caught);
    } finally {
      if (token === loadToken) loading = false;
    }
  }

  function matches(entries: CommandEntry[] | undefined): CommandEntry[] {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    if (q.length === 0) return entries;
    return entries.filter((entry) => `${entry.name} ${entry.description}`.toLowerCase().includes(q));
  }

  function commandLabel(command: CommandEntry): string {
    return command.kind === "skill" ? command.name : `/${command.name}`;
  }

  function commandInsertion(command: CommandEntry): string {
    if (command.kind === "skill") return `/${command.name} `;
    return `/${command.name}${command.takesArgs ? " " : ""}`;
  }

  function pick(command: CommandEntry): void {
    onPick(commandInsertion(command));
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content side="bottom" class="flex max-h-[80dvh] flex-col gap-0 overflow-hidden rounded-t-[12px] border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] p-0 text-[color:var(--color-fg)] shadow-none" style="padding-bottom: calc(env(safe-area-inset-bottom) + var(--keyboard-bottom-inset, 0px) + 0.5rem)">
    <Sheet.Header class="hairline-b space-y-0 px-3 py-3 pr-12 text-left">
      <Sheet.Title class="min-w-0 flex-1 px-1 text-[13px] font-medium">commands</Sheet.Title>
    </Sheet.Header>

    <div class="hairline-b px-2 pb-2">
      <div class="flex items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-2 focus-within:border-[color:var(--color-border-strong)]">
        <Search class="size-3 shrink-0 text-[color:var(--color-fg-muted)]" />
        <Input autofocus type="text" bind:value={query} placeholder="search…" class="h-auto border-0 bg-transparent px-0 py-0 focus:border-0 focus-visible:border-0" />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="px-3 py-3 text-[12px] text-[color:var(--color-fg-faint)]">loading…</div>
      {/if}
      {#if error}
        <div class="px-3 py-3 text-[12px] text-[color:var(--color-danger)]">{error}</div>
      {/if}
      {#if commands && total > 0}
        {@render Section("built-in", "hash", builtins, pick)}
        {@render Section("prompts", "file", prompts, pick)}
        {@render Section("skills", "sparkles", skills, pick)}
      {:else if commands && total === 0}
        <div class="px-3 py-6 text-center text-[12px] text-[color:var(--color-fg-faint)]">no matches</div>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>

{#snippet Section(label: string, icon: "hash" | "file" | "sparkles", entries: CommandEntry[], onPick: (command: CommandEntry) => void)}
  {#if entries.length > 0}
    <div class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/95 px-3 py-1 backdrop-blur-md">
      <span class="text-[color:var(--color-fg-faint)]">
        {#if icon === "hash"}<Hash class="size-3" />{:else if icon === "file"}<FileText class="size-3" />{:else}<Sparkles class="size-3" />{/if}
      </span>
      <span class="label">{label}</span>
    </div>
    {#each entries as entry (entry.kind + entry.name)}
      <button type="button" onclick={() => onPick(entry)} class="hairline-b flex w-full items-start gap-3 px-3 py-2.5 text-left active:bg-[color:var(--color-surface)]">
        <span class="mt-0.5 w-28 shrink-0 truncate text-[12px] text-[color:var(--color-fg)]">{commandLabel(entry)}</span>
        <span class="min-w-0 flex-1 text-[11px] leading-relaxed text-[color:var(--color-fg-muted)]">{entry.description}</span>
      </button>
    {/each}
  {/if}
{/snippet}

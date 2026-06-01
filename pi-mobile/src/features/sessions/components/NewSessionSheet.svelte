<script lang="ts">
  import { ChevronLeft, Folder, GitBranch, Plus } from "@lucide/svelte";
  import type { GitBranchInfo, GitBranchesResult } from "@/shared/lib/api-client";
  import { getBridgeClient } from "@/shared/lib/bridge-client";
  import { listGitBranches } from "@/features/sessions/api";
  import CwdPicker from "@/features/sessions/components/CwdPicker.svelte";
  import { Button } from "@/shared/ui/button";
  import { Input } from "@/shared/ui/input";
  import * as Sheet from "@/shared/ui/sheet";

  let {
    open = $bindable(false),
    creating = false,
    onCreate,
  }: {
    open: boolean;
    creating?: boolean;
    onCreate: (opts: { cwd: string; title: string; branch?: string }) => void;
  } = $props();

  let cwd = $state<string | undefined>();
  let title = $state("");
  let branch = $state<string | undefined>();
  let pickerOpen = $state(false);
  let gitInfo = $state<GitBranchesResult | undefined>();
  let gitLoading = $state(false);
  let gitError = $state<string | null>(null);
  let branchRequestId = 0;

  const effectiveTitle = $derived.by(() => {
    const trimmed = title.trim();
    if (trimmed.length > 0) return trimmed;
    return cwd ? basename(cwd) : "";
  });

  const canCreate = $derived(!!cwd && !creating && (!gitInfo?.isRepo || !!branch));

  $effect(() => {
    if (!cwd) {
      gitInfo = undefined;
      branch = undefined;
      return;
    }
    void loadBranches(cwd);
  });

  async function loadBranches(path: string): Promise<void> {
    const requestId = ++branchRequestId;
    gitLoading = true;
    gitError = null;
    try {
      const client = getBridgeClient();
      const info = await listGitBranches(client, path);
      if (requestId !== branchRequestId || path !== cwd) return;

      gitInfo = info;
      if (!info.isRepo) {
        branch = undefined;
      } else if (!branch || !info.branches.some((candidate: GitBranchInfo) => candidate.name === branch)) {
        branch = info.current;
      }
    } catch (error) {
      if (requestId !== branchRequestId || path !== cwd) return;
      gitError = String(error);
      gitInfo = { isRepo: false, branches: [] };
      branch = undefined;
    } finally {
      if (requestId === branchRequestId) gitLoading = false;
    }
  }

  function handleCreate(): void {
    if (!cwd || !canCreate) return;
    onCreate({
      cwd,
      title: effectiveTitle,
      branch: gitInfo?.isRepo ? branch : undefined,
    });
  }

  function branchLabel(candidate: GitBranchInfo): string {
    return candidate.kind === "remote" ? `${candidate.name} (remote)` : candidate.name;
  }

  function basename(path: string): string {
    const trimmed = path.replace(/\/+$/, "");
    const index = trimmed.lastIndexOf("/");
    return index >= 0 ? trimmed.slice(index + 1) : trimmed;
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content
    side="bottom"
    class="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[12px] border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] p-0 text-[color:var(--color-fg)] shadow-none"
    style="padding-bottom: calc(env(safe-area-inset-bottom) + var(--keyboard-bottom-inset, 0px) + 0.5rem)"
  >
    <Sheet.Header class="hairline-b flex-row items-center gap-1 space-y-0 px-2 py-2 pr-12 text-left">
      {#if pickerOpen}
        <Button type="button" variant="ghost" size="icon" onclick={() => (pickerOpen = false)} aria-label="Back">
          <ChevronLeft class="size-4" />
        </Button>
      {:else}
        <div class="h-9 w-9"></div>
      {/if}
      <Sheet.Title class="min-w-0 flex-1 px-1 text-[13px] font-medium">
        {pickerOpen ? "choose directory" : "new session"}
      </Sheet.Title>
    </Sheet.Header>

    {#if pickerOpen}
      <CwdPicker
        initial={cwd}
        onSelect={(path) => {
          cwd = path;
          pickerOpen = false;
        }}
      />
    {:else}
      <div class="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        <label class="block">
          <div class="label mb-1.5">cwd</div>
          <button
            type="button"
            onclick={() => (pickerOpen = true)}
            class="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-left active:bg-[color:var(--color-surface-2)]"
          >
            <Folder class="size-3.5 shrink-0 text-[color:var(--color-fg-muted)]" />
            {#if cwd}
              <span class="min-w-0 flex-1 truncate text-[12.5px]">{cwd}</span>
            {:else}
              <span class="text-[12.5px] text-[color:var(--color-fg-faint)]">choose a directory…</span>
            {/if}
          </button>
        </label>

        <div>
          <label class="label mb-1.5 block" for="session_title">title</label>
          <Input id="session_title" type="text" bind:value={title} placeholder={cwd ? basename(cwd) : "session title"} class="h-10" />
        </div>

        {#if gitLoading}
          <div class="text-[11px] text-[color:var(--color-fg-faint)]">loading branches…</div>
        {/if}
        {#if gitError}
          <div class="text-[11px] text-[color:var(--color-danger)]">{gitError}</div>
        {/if}
        {#if gitInfo?.isRepo && gitInfo.branches.length > 0}
          <label class="block">
            <div class="label mb-1.5">branch</div>
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-[12.5px]">
                <GitBranch class="size-3 shrink-0 text-[color:var(--color-fg-muted)]" />
                <span class="min-w-0 flex-1 truncate">{branch ?? "choose a branch"}</span>
              </div>
              <div class="max-h-40 overflow-y-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
                {#each gitInfo.branches as candidate (candidate.name)}
                  <button type="button" onclick={() => (branch = candidate.name)} class="hairline-b flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] active:bg-[color:var(--color-surface-2)]">
                    <span class="min-w-0 flex-1 truncate">{branchLabel(candidate)}</span>
                    {#if candidate.kind === "local" && candidate.current}
                      <span class="text-[11px] text-[color:var(--color-fg-faint)]">current</span>
                    {/if}
                    {#if branch === candidate.name}
                      <span class="text-[color:var(--color-accent)]">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>
              <p class="px-1 text-[11px] leading-4 text-[color:var(--color-fg-faint)]">
                A per-session branch and git worktree will be created from this branch.
              </p>
            </div>
          </label>
        {/if}
      </div>

      <div class="px-3 pt-2">
        <Button type="button" disabled={!canCreate} class="h-10 w-full" onclick={handleCreate}>
          <Plus class="size-3.5" />
          {creating ? "creating…" : "create session"}
        </Button>
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>

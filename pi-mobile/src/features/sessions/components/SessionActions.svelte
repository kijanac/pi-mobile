<script lang="ts">
  import { Archive, ArchiveRestore, Pencil, Trash2 } from "@lucide/svelte";
  import type { SessionMeta } from "@pi-mobile/protocol";
  import { Button } from "@/shared/ui/button";
  import * as DropdownMenu from "@/shared/ui/dropdown-menu";

  let {
    session,
    onRename,
    onToggleArchive,
    onDelete,
  }: {
    session: SessionMeta;
    onRename: (session: SessionMeta) => void;
    onToggleArchive: (session: SessionMeta) => void;
    onDelete: (session: SessionMeta) => void;
  } = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Session actions" {...props}>⋯</Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="min-w-40">
    <DropdownMenu.Item onclick={() => onRename(session)}>
      <Pencil class="size-3.5" />
      rename
    </DropdownMenu.Item>
    <DropdownMenu.Item onclick={() => onToggleArchive(session)}>
      {#if session.archived}
        <ArchiveRestore class="size-3.5" />
        unarchive
      {:else}
        <Archive class="size-3.5" />
        archive
      {/if}
    </DropdownMenu.Item>
    <DropdownMenu.Item onclick={() => onDelete(session)} class="text-[color:var(--color-danger)]">
      <Trash2 class="size-3.5" />
      delete
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>

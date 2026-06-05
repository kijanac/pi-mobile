<script lang="ts">
  import * as Sheet from "@/shared/ui/sheet";
  import { Button } from "@/shared/ui/button";
  import { activeSessionState } from "@/features/chat/model/active-session.state.svelte";

  let textValue = $state("");
  let sheetOpen = $state(false);
  let activeRequestId = $state<string | null>(null);
  const request = $derived(activeSessionState.extensionUiRequests[0]);

  $effect(() => {
    const nextId = request?.id ?? null;
    if (nextId === activeRequestId) return;
    activeRequestId = nextId;
    sheetOpen = Boolean(request);
    textValue = request?.kind === "input" ? (request.initialValue ?? "") : "";
  });

  $effect(() => {
    if (request && activeRequestId === request.id && !sheetOpen) respond(null);
  });

  function respond(value: string | boolean | null): void {
    if (!request) return;
    activeSessionState.respondToExtensionUi(request.id, value);
  }
</script>

<Sheet.Root bind:open={sheetOpen}>
  <Sheet.BottomContent class="max-h-[82dvh]">
    {#if request}
      <Sheet.Header class="hairline-b space-y-1 px-3 py-3 pr-12 text-left">
        <Sheet.Title class="type-title min-w-0 flex-1 px-1 font-medium">{request.title}</Sheet.Title>
        <Sheet.Description class="type-copy px-1 text-[color:var(--color-fg-muted)]">
          Pi extension request
        </Sheet.Description>
      </Sheet.Header>

      <div class="space-y-3 overflow-y-auto p-3">
        {#if request.kind === "confirm"}
          <p class="type-copy whitespace-pre-wrap text-[color:var(--color-fg)]">{request.message}</p>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <Button type="button" variant="outline" onclick={() => respond(false)}>deny</Button>
            <Button type="button" onclick={() => respond(true)}>allow</Button>
          </div>
        {:else if request.kind === "select"}
          <div class="space-y-2">
            {#each request.options as option}
              <Button type="button" variant="outline" class="w-full justify-start" onclick={() => respond(option)}>{option}</Button>
            {/each}
          </div>
          <Button type="button" variant="ghost" class="w-full" onclick={() => respond(null)}>cancel</Button>
        {:else if request.kind === "input"}
          {#if request.multiline}
            <textarea
              class="type-copy min-h-36 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-3 outline-none focus:border-[color:var(--color-accent)]"
              placeholder={request.placeholder ?? ""}
              bind:value={textValue}
            ></textarea>
          {:else}
            <input
              class="type-copy w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-3 outline-none focus:border-[color:var(--color-accent)]"
              placeholder={request.placeholder ?? ""}
              bind:value={textValue}
            />
          {/if}
          <div class="grid grid-cols-2 gap-2 pt-1">
            <Button type="button" variant="outline" onclick={() => respond(null)}>cancel</Button>
            <Button type="button" onclick={() => respond(textValue)}>submit</Button>
          </div>
        {/if}
      </div>
    {/if}
  </Sheet.BottomContent>
</Sheet.Root>

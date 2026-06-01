<script lang="ts">
  import { Check, Loader2, X } from "@lucide/svelte";
  import { createBridgeConnectionState } from "@/features/settings/bridge-connection.state.svelte";
  import { settingsState } from "@/features/settings/settings.state.svelte";
  import { Button } from "@/shared/ui/button";
  import { Input } from "@/shared/ui/input";

  let { url = $bindable(settingsState.bridgeUrl) }: { url: string } = $props();

  const connection = createBridgeConnectionState();
</script>

<section class="space-y-4">
  <div>
    <label class="label mb-1.5 block" for="bridge_url">bridge url</label>
    <div class="flex items-stretch gap-1.5">
      <Input
        id="bridge_url"
        type="url"
        inputmode="url"
        autocapitalize="none"
        autocorrect="off"
        spellcheck={false}
        bind:value={url}
        oninput={connection.resetForUrlInput}
        placeholder="http://localhost:7777"
        class="h-10 text-[13px]"
      />
      <Button
        type="button"
        variant="outline"
        class="h-10 w-12 px-0"
        aria-label="Test connection"
        onclick={() => connection.test(url)}
      >
        {#if connection.probe === "checking"}
          <Loader2 class="size-3.5 animate-spin text-[color:var(--color-fg-muted)]" />
        {:else if connection.probe === "ok"}
          <Check class="size-3.5 text-[color:var(--color-accent)]" />
        {:else if connection.probe === "fail"}
          <X class="size-3.5 text-[color:var(--color-danger)]" />
        {:else}
          <span class="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-fg-muted)]">test</span>
        {/if}
      </Button>
    </div>

    <p class="mt-2 text-[11px] leading-relaxed text-[color:var(--color-fg-faint)]">
      on tailscale, this will look like
      <span class="text-[color:var(--color-fg-muted)]"> https://agent.tail-xxxx.ts.net</span>.
      for local dev, the default
      <span class="text-[color:var(--color-fg-muted)]"> http://localhost:7777</span> works.
    </p>
  </div>

  {#if connection.systemInfo}
    <div class="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-[11px] leading-relaxed text-[color:var(--color-fg-muted)]">
      <div class="flex items-center justify-between gap-2">
        <span>bridge {connection.systemInfo.bridgeVersion}</span>
        <span
          class={connection.compatibility?.level === "danger"
            ? "text-[color:var(--color-danger)]"
            : connection.compatibility?.level === "warn"
              ? "text-[color:var(--color-warning,#d97706)]"
              : "text-[color:var(--color-accent)]"}
        >
          {connection.compatibility?.text}
        </span>
      </div>
      <div class="mt-1">
        protocol {connection.systemInfo.protocolVersion} · updates {connection.systemInfo.autoUpdate ? "on" : "off"} · {connection.systemInfo.updateChannel}
      </div>

      {#if connection.bridgeUpdateStatus}
        <div class="mt-2 flex items-center justify-between gap-2">
          <span>
            manual update {connection.bridgeUpdateStatus.manualUpdate ? "available" : "unavailable"}
            {#if connection.bridgeUpdateStatus.failure}
              · last failed {connection.bridgeUpdateStatus.failure.version}
            {/if}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={!connection.bridgeUpdateStatus.manualUpdate || connection.bridgeUpdateBusy}
            onclick={() => connection.updateBridgeNow(url)}
          >
            {connection.bridgeUpdateBusy ? "requesting" : "update now"}
          </Button>
        </div>
      {/if}

      {#if connection.bridgeUpdateMessage}
        <div class="mt-1 text-[color:var(--color-fg-faint)]">{connection.bridgeUpdateMessage}</div>
      {/if}
      {#if connection.bridgeIdentity}
        <div class="mt-1">
          tailscale owner {connection.bridgeIdentity.user} · {connection.bridgeIdentity.claimed ? "claimed" : "unclaimed"}
        </div>
      {/if}
    </div>
  {/if}

  {#if connection.systemInfoError}
    <div class="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-[11px] leading-relaxed text-[color:var(--color-fg-faint)]">
      bridge is reachable, but does not expose system info yet. likely an older bridge.
    </div>
  {/if}

  <Button type="button" class="h-10 w-full" onclick={() => connection.save(url)}>
    {connection.saved ? "saved ✓" : "save"}
  </Button>
</section>

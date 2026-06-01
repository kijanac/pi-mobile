<script lang="ts">
  import { Check, Loader2, X } from "@lucide/svelte";
  import { PRODUCT_VERSION, PROTOCOL_VERSION } from "@pi-mobile/protocol";
  import { claimBridgeForUrl, getBridgeIdentityForUrl, getBridgeUpdateStatusForUrl, getSystemInfoForUrl, healthcheckBridgeUrl, triggerBridgeUpdateForUrl, type BridgeIdentity, type BridgeUpdateStatus, type SystemInfo } from "@/features/settings/api";
  import { settingsState } from "@/features/settings/settings.state.svelte";
  import { Button } from "@/shared/ui/button";
  import { Input } from "@/shared/ui/input";

  type Probe = "idle" | "checking" | "ok" | "fail";

  let { url = $bindable(settingsState.bridgeUrl) }: { url: string } = $props();

  let saved = $state(false);
  let probe = $state<Probe>("idle");
  let systemInfo = $state<SystemInfo | null>(null);
  let systemInfoError = $state<string | null>(null);
  let bridgeIdentity = $state<BridgeIdentity | null>(null);
  let bridgeUpdateStatus = $state<BridgeUpdateStatus | null>(null);
  let bridgeUpdateMessage = $state<string | null>(null);
  let bridgeUpdateBusy = $state(false);

  const compatibility = $derived.by(() => {
    if (!systemInfo) return null;
    if (systemInfo.protocolVersion !== PROTOCOL_VERSION) {
      return {
        level: "danger" as const,
        text: `protocol mismatch: mobile ${PROTOCOL_VERSION}, bridge ${systemInfo.protocolVersion}`,
      };
    }
    if (compareVersion(PRODUCT_VERSION, systemInfo.minMobileVersion) < 0) {
      return {
        level: "danger" as const,
        text: `mobile ${PRODUCT_VERSION} is too old for this bridge`,
      };
    }
    if (compareVersion(PRODUCT_VERSION, systemInfo.recommendedMobileVersion) < 0) {
      return {
        level: "warn" as const,
        text: `mobile update recommended: ${systemInfo.recommendedMobileVersion}`,
      };
    }
    return { level: "ok" as const, text: "compatible" };
  });

  async function test(): Promise<void> {
    probe = "checking";
    systemInfo = null;
    systemInfoError = null;
    bridgeIdentity = null;
    bridgeUpdateStatus = null;
    bridgeUpdateMessage = null;

    const ok = await healthcheckBridgeUrl(url);
    probe = ok ? "ok" : "fail";
    if (!ok) return;

    try {
      systemInfo = await getSystemInfoForUrl(url);
      bridgeUpdateStatus = await getBridgeUpdateStatusForUrl(url);
      const identity = await getBridgeIdentityForUrl(url);
      bridgeIdentity = identity.claimed ? identity : await claimBridgeForUrl(url);
    } catch (error) {
      systemInfoError = error instanceof Error ? error.message : String(error);
    }
  }

  async function save(): Promise<void> {
    await settingsState.setBridgeUrl(url);
    saved = true;
    window.setTimeout(() => {
      saved = false;
    }, 1200);
  }

  async function updateBridgeNow(): Promise<void> {
    if (bridgeUpdateBusy) return;
    bridgeUpdateBusy = true;
    bridgeUpdateMessage = null;
    try {
      bridgeUpdateStatus = await triggerBridgeUpdateForUrl(url);
      bridgeUpdateMessage = "bridge update requested; it may restart if a newer release is available";
    } catch (error) {
      bridgeUpdateMessage = String(error);
    } finally {
      bridgeUpdateBusy = false;
    }
  }

  function onUrlInput(): void {
    probe = "idle";
    saved = false;
    systemInfo = null;
    systemInfoError = null;
    bridgeIdentity = null;
    bridgeUpdateStatus = null;
    bridgeUpdateMessage = null;
  }

  function compareVersion(a: string, b: string): number {
    const aa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
    const bb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
    for (let index = 0; index < Math.max(aa.length, bb.length); index += 1) {
      const diff = (aa[index] ?? 0) - (bb[index] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }
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
        oninput={onUrlInput}
        placeholder="http://localhost:7777"
        class="h-10 text-[13px]"
      />
      <Button
        type="button"
        variant="outline"
        class="h-10 w-12 px-0"
        aria-label="Test connection"
        onclick={test}
      >
        {#if probe === "checking"}
          <Loader2 class="size-3.5 animate-spin text-[color:var(--color-fg-muted)]" />
        {:else if probe === "ok"}
          <Check class="size-3.5 text-[color:var(--color-accent)]" />
        {:else if probe === "fail"}
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

  {#if systemInfo}
    <div class="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-[11px] leading-relaxed text-[color:var(--color-fg-muted)]">
      <div class="flex items-center justify-between gap-2">
        <span>bridge {systemInfo.bridgeVersion}</span>
        <span
          class={compatibility?.level === "danger"
            ? "text-[color:var(--color-danger)]"
            : compatibility?.level === "warn"
              ? "text-[color:var(--color-warning,#d97706)]"
              : "text-[color:var(--color-accent)]"}
        >
          {compatibility?.text}
        </span>
      </div>
      <div class="mt-1">
        protocol {systemInfo.protocolVersion} · updates {systemInfo.autoUpdate ? "on" : "off"} · {systemInfo.updateChannel}
      </div>

      {#if bridgeUpdateStatus}
        <div class="mt-2 flex items-center justify-between gap-2">
          <span>
            manual update {bridgeUpdateStatus.manualUpdate ? "available" : "unavailable"}
            {#if bridgeUpdateStatus.failure}
              · last failed {bridgeUpdateStatus.failure.version}
            {/if}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={!bridgeUpdateStatus.manualUpdate || bridgeUpdateBusy}
            onclick={updateBridgeNow}
          >
            {bridgeUpdateBusy ? "requesting" : "update now"}
          </Button>
        </div>
      {/if}

      {#if bridgeUpdateMessage}
        <div class="mt-1 text-[color:var(--color-fg-faint)]">{bridgeUpdateMessage}</div>
      {/if}
      {#if bridgeIdentity}
        <div class="mt-1">
          tailscale owner {bridgeIdentity.user} · {bridgeIdentity.claimed ? "claimed" : "unclaimed"}
        </div>
      {/if}
    </div>
  {/if}

  {#if systemInfoError}
    <div class="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-[11px] leading-relaxed text-[color:var(--color-fg-faint)]">
      bridge is reachable, but does not expose system info yet. likely an older bridge.
    </div>
  {/if}

  <Button type="button" class="h-10 w-full" onclick={save}>
    {saved ? "saved ✓" : "save"}
  </Button>
</section>

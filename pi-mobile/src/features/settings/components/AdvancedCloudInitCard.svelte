<script lang="ts">
  import { Copy } from "@lucide/svelte";
  import { renderBridgeCloudInit } from "@pi-mobile/protocol";
  import { Button } from "@/shared/ui/button";
  import { Textarea } from "@/shared/ui/textarea";
  import SettingsField from "@/features/settings/components/SettingsField.svelte";

  let { onUseBridgeUrl }: { onUseBridgeUrl: (url: string) => void } = $props();

  let tsAuthKey = $state("");
  let bridgeHostname = $state(randomBridgeHostname());
  let tailnet = $state("");
  let copied = $state<string | null>(null);

  const computedBridgeUrl = $derived.by(() => {
    const host = bridgeHostname.trim();
    const suffix = tailnet.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    return host && suffix ? `https://${host}.${suffix}` : "";
  });

  const cloudInit = $derived(
    renderBridgeCloudInit({
      tsAuthKey,
      bridgeHostname,
    }),
  );

  async function copy(text: string, label: string): Promise<void> {
    await navigator.clipboard?.writeText(text);
    copied = label;
    window.setTimeout(() => {
      copied = null;
    }, 1200);
  }

  function randomBridgeHostname(): string {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    return `pi-bridge-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
</script>

<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
  <div class="mb-3">
    <h2 class="text-[13px] font-medium text-[color:var(--color-fg)]">advanced cloud-init bridge setup</h2>
    <p class="mt-1 text-[11px] leading-relaxed text-[color:var(--color-fg-faint)]">
      create a single-use, preauthorized Tailscale auth key, paste it here, then paste the generated cloud-init into your VPS provider.
    </p>
  </div>

  <div class="space-y-3">
    <SettingsField
      id="ts_auth_key"
      label="tailscale auth key"
      bind:value={tsAuthKey}
      placeholder="tskey-auth-..."
      secret
    />
    <SettingsField
      id="bridge_hostname"
      label="bridge hostname"
      bind:value={bridgeHostname}
      placeholder="pi-bridge-ab12cd"
    />
    <SettingsField
      id="tailnet"
      label="tailnet dns suffix"
      bind:value={tailnet}
      placeholder="tail-xxxx.ts.net"
    />
  </div>

  {#if computedBridgeUrl}
    <div class="mt-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-2 text-[11px] text-[color:var(--color-fg-muted)]">
      bridge URL: {computedBridgeUrl}
      <button
        type="button"
        onclick={() => onUseBridgeUrl(computedBridgeUrl)}
        class="ml-2 text-[color:var(--color-accent)] active:opacity-70"
      >
        use
      </button>
    </div>
  {/if}

  <div class="mt-4">
    <label class="label mb-1.5 block" for="cloud_init">cloud-init</label>
    <Textarea
      id="cloud_init"
      readonly
      value={cloudInit}
      rows={13}
      class="min-h-0 resize-none bg-[color:var(--color-bg)] font-mono text-[10.5px] leading-relaxed"
    />
  </div>

  <Button
    type="button"
    variant="outline"
    onclick={() => copy(cloudInit, "cloud-init")}
    class="mt-2 h-10 w-full"
  >
    <Copy class="size-3.5" />
    {copied === "cloud-init" ? "copied ✓" : "copy cloud-init"}
  </Button>
</section>


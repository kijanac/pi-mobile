<script lang="ts">
  import { onMount } from "svelte";
  import { Check, Copy, Loader2 } from "@lucide/svelte";
  import { renderBridgeCloudInit } from "@pi-mobile/protocol";
  import { navigateTo, routePaths } from "@/app/routes";
  import { settingsState } from "@/features/settings/settings.state.svelte";
  import { ApiClient } from "@/shared/lib/api-client";
  import SettingsField from "@/features/settings/components/SettingsField.svelte";
  import ProviderSignIn from "@/features/onboarding/components/ProviderSignIn.svelte";
  import OnboardingPanel from "@/features/onboarding/components/OnboardingPanel.svelte";
  import Checklist from "@/features/onboarding/components/Checklist.svelte";
  import ExternalLinkButton from "@/features/onboarding/components/ExternalLinkButton.svelte";
  import InfoRow from "@/features/onboarding/components/InfoRow.svelte";
  import { haptics } from "@/shared/mobile/haptics";
  import { Button } from "@/shared/ui/button";
  import { Textarea } from "@/shared/ui/textarea";
  import { Carousel, CarouselContent, CarouselItem } from "@/shared/ui/carousel";
  import EdgeSwipeBack from "@/shared/components/EdgeSwipeBack.svelte";
  import SessionsPreview from "@/features/sessions/components/SessionsPreview.svelte";
  import type { CarouselAPI } from "@/shared/ui/carousel/context";

  const steps = ["tailscale", "keys", "cloud-init", "connect", "providers", "done"] as const;
  type ConnectState = "idle" | "polling" | "reachable" | "claimed" | "failed";

  let loaded = $state(false);
  let currentIndex = $state(0);
  let carouselApi = $state<CarouselAPI | undefined>();
  let tsAuthKey = $state("");
  let tailnet = $state("");
  let bridgeHostname = $state(randomBridgeHostname());
  let showAdvanced = $state(false);
  let copied = $state<string | null>(null);
  let connectState = $state<ConnectState>("idle");
  let connectMessage = $state("Paste the cloud-init into your provider, boot the box, then start waiting here.");
  let authError = $state<string | null>(null);
  let providerConfigured = $state(false);

  const tailnetDns = $derived(normalizeTailnet(tailnet));
  const bridgeUrl = $derived.by(() => {
    const host = bridgeHostname.trim().toLowerCase();
    return host && tailnetDns ? `https://${host}.${tailnetDns}` : "";
  });
  const cloudInit = $derived(renderBridgeCloudInit({ tsAuthKey, bridgeHostname }));
  const hasSetupInputs = $derived(tsAuthKey.trim().startsWith("tskey-auth-") && tailnetDns.endsWith(".ts.net"));
  const maxAllowedIndex = $derived.by(() => {
    if (providerConfigured) return 5;
    if (connectState === "claimed") return 4;
    if (hasSetupInputs) return 3;
    return 1;
  });

  onMount(() => {
    void (async () => {
      await settingsState.load();
      tsAuthKey = settingsState.onboardingDraft.tsAuthKey ?? "";
      tailnet = settingsState.onboardingDraft.tailnet ?? "";
      bridgeHostname = settingsState.onboardingDraft.bridgeHostname ?? bridgeHostname;
      loaded = true;
    })();
  });

  $effect(() => {
    if (!loaded) return;
    void settingsState.setOnboardingDraft({ tsAuthKey, tailnet, bridgeHostname });
  });

  $effect(() => {
    carouselApi?.scrollTo(currentIndex);
  });

  $effect(() => {
    const api = carouselApi;
    if (!api) return;

    const onSelect = () => {
      const selected = api.selectedScrollSnap();
      if (selected > maxAllowedIndex) {
        api.scrollTo(currentIndex);
        return;
      }
      currentIndex = selected;
    };

    api.on("select", onSelect);
    return () => api.off("select", onSelect);
  });

  function go(index: number): void {
    currentIndex = Math.min(index, maxAllowedIndex);
  }

  function back(): void {
    currentIndex = Math.max(0, currentIndex - 1);
  }

  function next(): void {
    currentIndex = Math.min(maxAllowedIndex, currentIndex + 1);
  }

  async function copy(text: string, label: string): Promise<void> {
    await navigator.clipboard?.writeText(text);
    copied = label;
    window.setTimeout(() => {
      copied = null;
    }, 1200);
  }

  async function waitForBridge(): Promise<void> {
    if (!bridgeUrl || connectState === "polling") return;

    connectState = "polling";
    connectMessage = "Waiting for the bridge HTTPS endpoint to come online. This can take a few minutes on first boot…";
    const client = new ApiClient(bridgeUrl);

    for (let attempt = 1; attempt <= 60; attempt += 1) {
      if (await client.healthcheck()) {
        connectState = "reachable";
        connectMessage = "Bridge is reachable. Saving URL and claiming it with your Tailscale identity…";
        await settingsState.setBridgeUrl(bridgeUrl);
        try {
          const identity = await client.getBridgeIdentity();
          if (!identity.claimed) await client.claimBridge();
          connectState = "claimed";
          connectMessage = "Bridge connected and claimed. You’re ready to continue.";
          await settingsState.clearOnboardingDraft();
          haptics.success();
          currentIndex = 4;
        } catch (error) {
          connectState = "failed";
          connectMessage = setupErrorMessage(error);
        }
        return;
      }
      connectMessage = `Still waiting for ${bridgeUrl}… (${attempt}/60)`;
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
    }

    connectState = "failed";
    connectMessage = "Timed out. Check VPS cloud-init logs and make sure Tailscale is connected on this phone.";
  }

  function normalizeTailnet(value: string): string {
    return value.trim().replace(/^https?:\/\//, "").replace(/^\.+/, "").replace(/\/+$/, "").toLowerCase();
  }

  function setupErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("missing_tailscale_identity")) return "Tailscale identity missing. Connect Tailscale on this phone and try again.";
    if (message.includes("tailscale_user_not_bridge_owner")) return "This bridge is claimed by another Tailscale user.";
    if (message.includes("bridge is already claimed")) return "This bridge is already claimed.";
    return "Bridge is reachable, but claim failed. Check Tailscale and try again.";
  }

  function randomBridgeHostname(): string {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    return `pi-bridge-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
</script>

{#if !loaded}
  <main class="flex flex-1 items-center justify-center p-4 text-[12px] text-[color:var(--color-fg-muted)]">
    loading onboarding…
  </main>
{:else}
  <EdgeSwipeBack href="/settings">
    {#snippet preview()}
      <SessionsPreview />
    {/snippet}

  <main class="flex min-h-0 flex-1 flex-col">
    <header class="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-3 py-[calc(env(safe-area-inset-top)+12px)] pb-3">
      <Button type="button" variant="ghost" size="sm" onclick={() => navigateTo(routePaths.settings)}>back</Button>
      <h1 class="text-[13px] font-medium">bridge onboarding</h1>
      <div class="w-12" aria-hidden="true"></div>
    </header>

    <div class="flex min-h-0 flex-1 flex-col px-3 pt-4" style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
      <div class="mb-4 flex items-center gap-1.5">
        {#each steps as _step, index}
          <button
            type="button"
            onclick={() => go(index)}
            class={`h-1.5 flex-1 rounded-full ${index <= currentIndex ? "bg-[color:var(--color-accent)]" : "bg-[color:var(--color-border)]"}`}
            aria-label={`Go to step ${index + 1}`}
          ></button>
        {/each}
      </div>

      <Carousel setApi={(api) => (carouselApi = api)} opts={{ align: "start", containScroll: "trimSnaps" }} class="min-h-0 flex-1">
        <CarouselContent class="h-full -ml-3">
          <CarouselItem class="min-h-0 overflow-y-auto pl-3">
            <OnboardingPanel eyebrow="step 1" title="before you start">
              <p class="text-[12px] leading-relaxed text-[color:var(--color-fg-muted)]">
                pi-mobile will generate cloud-init for a fresh Linux box. The box will install pi-bridge, join your Tailscale tailnet, and expose HTTPS through Tailscale Serve.
              </p>
              <Checklist items={["Tailscale is installed and signed in on this phone", "You can create a VPS with cloud-init/user-data", "You can access Tailscale admin in a browser"]} />
              <ExternalLinkButton href="https://login.tailscale.com/admin/settings/keys">open Tailscale admin</ExternalLinkButton>
            </OnboardingPanel>
          </CarouselItem>

          <CarouselItem class="min-h-0 overflow-y-auto pl-3">
            <OnboardingPanel eyebrow="step 2" title="tailscale setup">
              <p class="text-[12px] leading-relaxed text-[color:var(--color-fg-muted)]">
                Create a single-use, preauthorized auth key, then copy your tailnet DNS name from the DNS page. The bridge hostname is generated for you.
              </p>
              <div class="grid grid-cols-2 gap-2">
                <ExternalLinkButton href="https://login.tailscale.com/admin/settings/keys">keys</ExternalLinkButton>
                <ExternalLinkButton href="https://login.tailscale.com/admin/dns">dns</ExternalLinkButton>
              </div>
              <div class="space-y-3">
                <SettingsField id="ts_auth_key" label="tailscale auth key" bind:value={tsAuthKey} placeholder="tskey-auth-..." secret />
                <SettingsField id="tailnet" label="tailnet DNS name" bind:value={tailnet} placeholder="tailabc123.ts.net" />
              </div>
              <button type="button" onclick={() => (showAdvanced = !showAdvanced)} class="text-left text-[11px] text-[color:var(--color-accent)] active:opacity-70">
                {showAdvanced ? "hide" : "show"} advanced hostname
              </button>
              {#if showAdvanced}
                <SettingsField id="bridge_hostname" label="bridge hostname" bind:value={bridgeHostname} placeholder="pi-bridge-ab12cd" />
              {/if}
              {#if bridgeUrl}
                <InfoRow label="bridge URL will be" value={bridgeUrl} />
              {/if}
            </OnboardingPanel>
          </CarouselItem>

          <CarouselItem class="min-h-0 overflow-y-auto pl-3">
            <OnboardingPanel eyebrow="step 3" title="copy cloud-init">
              <p class="text-[12px] leading-relaxed text-[color:var(--color-fg-muted)]">
                Paste this into your cloud provider’s user-data/cloud-init field when creating the VPS. Use a fresh box.
              </p>
              <div>
                <label class="label mb-1.5 block" for="cloud_init">cloud-init</label>
                <Textarea id="cloud_init" readonly value={cloudInit} rows={15} class="min-h-0 resize-none bg-[color:var(--color-bg)] font-mono text-[10.5px] leading-relaxed" />
              </div>
              <Button type="button" variant="outline" onclick={() => copy(cloudInit, "cloud-init")} class="w-full">
                <Copy class="size-3.5" /> {copied === "cloud-init" ? "copied ✓" : "copy cloud-init"}
              </Button>
            </OnboardingPanel>
          </CarouselItem>

          <CarouselItem class="min-h-0 overflow-y-auto pl-3">
            <OnboardingPanel eyebrow="step 4" title="wait for bridge">
              <p class="text-[12px] leading-relaxed text-[color:var(--color-fg-muted)]">
                After the VPS starts, pi-mobile will poll the Tailscale HTTPS URL. Keep the Tailscale app connected on this phone.
              </p>
              <InfoRow label="bridge url" value={bridgeUrl} />
              <div class="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-[12px] leading-relaxed text-[color:var(--color-fg-muted)]">
                <div class="mb-1 flex items-center gap-2 text-[color:var(--color-fg)]">
                  {#if connectState === "polling"}<Loader2 class="size-3.5 animate-spin" />{/if}
                  {#if connectState === "claimed"}<Check class="size-3.5 text-[color:var(--color-accent)]" />{/if}
                  <span>{connectState}</span>
                </div>
                {connectMessage}
              </div>
              <Button type="button" disabled={!bridgeUrl || connectState === "polling"} onclick={waitForBridge} class="w-full">
                {connectState === "polling" ? "waiting…" : "wait for bridge"}
              </Button>
            </OnboardingPanel>
          </CarouselItem>

          <CarouselItem class="min-h-0 overflow-y-auto pl-3">
            <OnboardingPanel eyebrow="step 5" title="provider sign-in">
              <p class="text-[12px] leading-relaxed text-[color:var(--color-fg-muted)]">
                Sign in to at least one provider so new sessions can use a model.
              </p>
              {#if authError}
                <p class="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-2 text-[11px] text-[color:var(--color-danger)]">{authError}</p>
              {/if}
              <ProviderSignIn onError={(message) => (authError = message)} onConfigured={() => (providerConfigured = true)} />
            </OnboardingPanel>
          </CarouselItem>

          <CarouselItem class="min-h-0 overflow-y-auto pl-3">
            <OnboardingPanel eyebrow="done" title="bridge ready">
              <div class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-center">
                <Check class="mx-auto mb-2 size-6 text-[color:var(--color-accent)]" />
                <p class="text-[13px] font-medium">pi-mobile is connected to your bridge.</p>
                <p class="mt-1 text-[11px] leading-relaxed text-[color:var(--color-fg-muted)]">Provider sign-in is available from a session’s action menu when you’re ready.</p>
              </div>
              <Button type="button" class="w-full" onclick={() => navigateTo(routePaths.sessions)}>go to sessions</Button>
            </OnboardingPanel>
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      <div class="mt-4 flex items-center gap-2">
        <Button type="button" variant="outline" onclick={back} disabled={currentIndex === 0} class="flex-1">back</Button>
        <Button type="button" onclick={next} disabled={currentIndex >= maxAllowedIndex || currentIndex === steps.length - 1} class="flex-1">next</Button>
      </div>
    </div>
  </main>
  </EdgeSwipeBack>
{/if}


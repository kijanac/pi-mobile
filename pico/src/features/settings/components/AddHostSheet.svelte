<script lang="ts">
  import { Check, Loader2, ScanLine, X } from "@lucide/svelte";
  import { connectAndClaimHost } from "@/features/onboarding/api";
  import SettingsField from "@/features/settings/components/SettingsField.svelte";
  import { settingsState } from "@/features/settings/settings.state.svelte";
  import HostIssuePanel from "@/shared/components/HostIssuePanel.svelte";
  import { classifyHostIssue, type HostIssue } from "@/shared/lib/host-issues";
  import { runAt } from "@/shared/lib/rpc-client";
  import { scanQrCode } from "@/shared/mobile/barcode";
  import { haptics } from "@/shared/mobile/haptics";
  import { Button } from "@/shared/ui/button";
  import * as Sheet from "@/shared/ui/sheet";

  type ConnectState = "idle" | "connecting" | "connected" | "failed";

  let { open = $bindable(false) }: { open: boolean } = $props();

  let hostUrl = $state("");
  let pairingToken = $state("");
  let connectState = $state<ConnectState>("idle");
  let message = $state("Scan the QR from `pico pair`, or enter the host details manually.");
  let issue = $state<HostIssue | null>(null);
  let scanError = $state(false);

  const canConnect = $derived(hostUrl.trim().length > 0 && connectState !== "connecting");

  function normalizeCandidate(raw: string): string {
    const trimmed = raw.trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  function resetForm(): void {
    hostUrl = "";
    pairingToken = "";
    connectState = "idle";
    message = "Scan the QR from `pico pair`, or enter the host details manually.";
    issue = null;
    scanError = false;
  }

  async function connectHost(url: string, token?: string): Promise<void> {
    const normalized = normalizeCandidate(url);
    if (!normalized || connectState === "connecting") return;

    connectState = "connecting";
    message = `Checking ${normalized}…`;
    issue = null;
    scanError = false;

    try {
      if (!settingsState.loaded) await settingsState.load();
      message = "Claiming Pico host with your Tailscale identity…";
      await runAt(normalized, connectAndClaimHost(normalized, token));

      connectState = "connected";
      message = "Pico host connected.";
      haptics.success();
      window.setTimeout(() => {
        open = false;
        resetForm();
      }, 700);
    } catch (error) {
      connectState = "failed";
      issue = classifyHostIssue(error, { url: normalized });
      message = issue.message;
    }
  }

  async function scanToConnect(): Promise<void> {
    scanError = false;
    const scanned = await scanQrCode();
    if (!scanned) return;

    try {
      const parsed = new URL(scanned);
      const url = parsed.searchParams.get("url")?.trim();
      const token = parsed.searchParams.get("claim")?.trim() || parsed.searchParams.get("token")?.trim() || undefined;
      if (!url) {
        scanError = true;
        return;
      }
      await connectHost(url, token);
    } catch {
      scanError = true;
    }
  }

  function connectManual(): void {
    void connectHost(hostUrl, pairingToken.trim() || undefined);
  }
</script>

<Sheet.Root bind:open>
  <Sheet.BottomContent class="max-h-[86dvh]">
    <Sheet.Header class="hairline-b flex-row items-center gap-1 space-y-0 px-3 py-2 pr-12 text-left">
      <Sheet.Title class="type-title min-w-0 flex-1 font-medium">add Pico host</Sheet.Title>
    </Sheet.Header>

    <div class="flex-1 space-y-4 overflow-y-auto px-3 py-3">
      <div class="space-y-2">
        <p class="type-copy text-[color:var(--color-fg-muted)]">
          Run <code class="type-code">pico pair</code> on the machine you want Pico to control, then scan its QR code.
        </p>
        <Button type="button" class="h-11 w-full" disabled={connectState === "connecting"} onclick={() => void scanToConnect()}>
          {#if connectState === "connecting"}
            <Loader2 class="size-4 animate-spin" /> connecting…
          {:else}
            <ScanLine class="size-4" /> scan QR code
          {/if}
        </Button>
        {#if scanError}
          <p class="type-meta text-center text-[color:var(--color-danger)]">That QR isn’t a Pico pairing code.</p>
        {/if}
      </div>

      <div class="space-y-3 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
        <div>
          <h3 class="type-title font-medium text-[color:var(--color-fg)]">manual</h3>
          <p class="type-copy mt-1 text-[color:var(--color-fg-muted)]">Use this if the QR scanner is unavailable.</p>
        </div>

        <SettingsField id="add_host_url" label="host URL" value={hostUrl} onValue={(value) => (hostUrl = value)} placeholder="pico-host.tailnet.ts.net" />
        <SettingsField id="add_host_pairing_token" label="pairing token" value={pairingToken} onValue={(value) => (pairingToken = value)} placeholder="printed by pico pair" secret />

        {#if connectState === "failed" && issue}
          <HostIssuePanel issue={issue} />
        {:else}
          <div class={`type-meta flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-2 ${connectState === "failed" ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-fg-muted)]"}`}>
            {#if connectState === "connecting"}<Loader2 class="mt-0.5 size-3.5 shrink-0 animate-spin" />{/if}
            {#if connectState === "connected"}<Check class="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-accent)]" />{/if}
            {#if connectState === "failed"}<X class="mt-0.5 size-3.5 shrink-0" />{/if}
            <span>{message}</span>
          </div>
        {/if}

        <Button type="button" class="h-10 w-full" disabled={!canConnect} onclick={connectManual}>
          {connectState === "connecting" ? "connecting…" : "connect host"}
        </Button>
      </div>
    </div>
  </Sheet.BottomContent>
</Sheet.Root>

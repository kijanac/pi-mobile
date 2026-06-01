<script lang="ts">
  import { onDestroy } from "svelte";
  import { Check, Loader2 } from "@lucide/svelte";
  import type { AuthLoginJob, AuthProvider } from "@pi-mobile/protocol";
  import type { ActionErrorHandler } from "./types";
  import { getBridgeClient } from "@/shared/lib/bridge-client";
  import { haptics } from "@/shared/mobile/haptics";
  import { Button } from "@/shared/ui/button";
  import { Textarea } from "@/shared/ui/textarea";

  let { onError, onConfigured }: { onError: ActionErrorHandler; onConfigured?: () => void } = $props();

  let job = $state<AuthLoginJob | null>(null);
  let input = $state("");
  let starting = $state<string | null>(null);
  let providers = $state<AuthProvider[]>([]);
  let providersLoading = $state(false);
  let interval: ReturnType<typeof setInterval> | undefined;

  $effect(() => {
    void loadProviders();
  });

  $effect(() => {
    if (interval) clearInterval(interval);
    if (job && !["success", "failed", "cancelled", "prompt", "manual"].includes(job.status)) {
      interval = setInterval(() => void refreshJob(), 1200);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  async function loadProviders(): Promise<void> {
    providersLoading = true;
    try {
      providers = (await getBridgeClient().listAuthProviders()).providers;
    } catch (error) {
      onError(String(error));
    } finally {
      providersLoading = false;
    }
  }

  async function start(provider: AuthProvider): Promise<void> {
    if (starting) return;
    starting = provider.id;
    onError(null);
    try {
      job = await getBridgeClient().startAuthLogin(provider.id);
    } catch (error) {
      onError(String(error));
    } finally {
      starting = null;
    }
  }

  async function refreshJob(): Promise<void> {
    if (!job) return;
    const next = await getBridgeClient().getAuthLoginJob(job.id);
    job = next;
    if (next.status === "success") {
      haptics.success();
      await loadProviders();
      onConfigured?.();
    }
  }

  async function submit(): Promise<void> {
    if (!job) return;
    job = await getBridgeClient().submitAuthLoginInput(job.id, input);
    input = "";
  }

  async function cancel(): Promise<void> {
    if (!job) return;
    await getBridgeClient().cancelAuthLogin(job.id);
    job = null;
  }
</script>

<div class="flex-1 overflow-y-auto px-3 py-3">
  {#if !job}
    <div class="space-y-2">
      {#if providersLoading}<div class="text-[12px] text-[color:var(--color-fg-faint)]">loading providers…</div>{/if}
      {#each providers as provider (provider.id)}
        <button type="button" onclick={() => start(provider)} disabled={starting !== null} class="hairline-b flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-3 text-left active:bg-[color:var(--color-surface-2)] disabled:opacity-70">
          <span class="min-w-0 flex-1">
            <span class="block text-[12.5px] font-medium">{provider.name}</span>
            <span class="block text-[11px] text-[color:var(--color-fg-muted)]">{provider.configured ? `configured${provider.source ? ` via ${provider.source}` : ""}` : "not configured"}</span>
          </span>
          {#if provider.configured}<Check class="size-3.5 text-[color:var(--color-accent)]" />{/if}
          {#if starting === provider.id}<Loader2 class="size-3.5 animate-spin" />{/if}
        </button>
      {/each}
    </div>
  {:else}
    <div class="space-y-3 text-[12px]">
      {@render InfoRow("provider", job.providerName ?? job.providerId)}
      {@render InfoRow("status", job.status)}
      {#if job.authUrl}<a class="block rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-3 text-center font-medium text-[color:var(--color-bg)]" href={job.authUrl} target="_blank" rel="noreferrer">open sign-in page</a>{/if}
      {#if job.verificationUri}<a class="block rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-3 text-center font-medium text-[color:var(--color-bg)]" href={job.verificationUri} target="_blank" rel="noreferrer">open verification page</a>{/if}
      {#if job.userCode}{@render InfoRow("device code", job.userCode)}{/if}
      {#if job.instructions}<p class="text-[11px] leading-relaxed text-[color:var(--color-fg-muted)]">{job.instructions}</p>{/if}
      {#if job.progress}<p class="text-[11px] text-[color:var(--color-fg-muted)]">{job.progress}</p>{/if}
      {#if job.error}<p class="text-[11px] text-[color:var(--color-danger)]">{job.error}</p>{/if}
      {#if job.status === "prompt" || job.status === "manual"}
        <label class="block">
          <span class="label mb-1.5 block">{job.promptMessage ?? "input"}</span>
          <Textarea rows={3} bind:value={input} placeholder={job.promptPlaceholder ?? "paste code or redirect URL"} class="min-h-0 text-[12px]" />
        </label>
        <Button type="button" variant="default" onclick={submit} class="w-full bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:bg-[color:var(--color-accent)] active:opacity-80">submit</Button>
      {/if}
      <button type="button" onclick={refreshJob} class="h-9 w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] text-[12px]">refresh</button>
      <button type="button" onclick={cancel} class="h-9 w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] text-[12px] text-[color:var(--color-fg-muted)]">cancel</button>
    </div>
  {/if}
</div>

{#snippet InfoRow(label: string, value: string)}
  <div class="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2">
    <div class="label">{label}</div>
    <div class="mt-1 break-words text-[12px] text-[color:var(--color-fg)]">{value}</div>
  </div>
{/snippet}

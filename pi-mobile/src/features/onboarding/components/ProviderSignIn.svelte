<script lang="ts">
  import { onMount } from "svelte";
  import { Check, Loader2 } from "@lucide/svelte";
  import type { AuthLoginJob, AuthProvider } from "@pi-mobile/protocol";
  import { settingsState } from "@/features/settings/settings.state.svelte";
  import { getBridgeClient } from "@/shared/lib/bridge-client";
  import { haptics } from "@/shared/mobile/haptics";
  import { Button } from "@/shared/ui/button";
  import { Textarea } from "@/shared/ui/textarea";
  import AuthInfoRow from "@/features/onboarding/components/AuthInfoRow.svelte";

  let {
    onError,
    onConfigured,
  }: {
    onError: (message: string | null) => void;
    onConfigured?: () => void;
  } = $props();

  let providers = $state<AuthProvider[]>([]);
  let loading = $state(false);
  let job = $state<AuthLoginJob | null>(null);
  let input = $state("");
  let starting = $state<string | null>(null);

  onMount(() => {
    void loadProviders();
  });

  $effect(() => {
    if (!job || ["success", "failed", "cancelled", "prompt", "manual"].includes(job.status)) return;
    const interval = window.setInterval(() => {
      void refreshJob();
    }, 1200);
    return () => window.clearInterval(interval);
  });

  async function loadProviders(): Promise<void> {
    loading = true;
    try {
      if (!settingsState.loaded) await settingsState.load();
      const client = getBridgeClient();
      providers = (await client.listAuthProviders()).providers;
      onError(null);
    } catch (error) {
      onError(String(error));
    } finally {
      loading = false;
    }
  }

  async function start(provider: AuthProvider): Promise<void> {
    if (starting) return;
    starting = provider.id;
    onError(null);
    try {
      const client = getBridgeClient();
      job = await client.startAuthLogin(provider.id);
    } catch (error) {
      onError(String(error));
    } finally {
      starting = null;
    }
  }

  async function refreshJob(): Promise<void> {
    if (!job) return;
    const client = getBridgeClient();
    const next = await client.getAuthLoginJob(job.id);
    job = next;
    if (next.status === "success") {
      haptics.success();
      await loadProviders();
      onConfigured?.();
    }
  }

  async function submit(): Promise<void> {
    if (!job) return;
    const client = getBridgeClient();
    job = await client.submitAuthLoginInput(job.id, input);
    input = "";
  }

  async function cancel(): Promise<void> {
    if (!job) return;
    const client = getBridgeClient();
    await client.cancelAuthLogin(job.id);
    job = null;
  }
</script>

<div class="flex-1 overflow-y-auto py-1">
  {#if !job}
    <div class="space-y-2">
      {#if loading}
        <div class="text-[12px] text-[color:var(--color-fg-faint)]">loading providers…</div>
      {/if}

      {#each providers as provider (provider.id)}
        <button
          type="button"
          onclick={() => start(provider)}
          disabled={starting !== null}
          class="hairline-b flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-3 text-left active:bg-[color:var(--color-surface-2)] disabled:opacity-70"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-[12.5px] font-medium">{provider.name}</span>
            <span class="block text-[11px] text-[color:var(--color-fg-muted)]">
              {provider.configured ? `configured${provider.source ? ` via ${provider.source}` : ""}` : "not configured"}
            </span>
          </span>
          {#if provider.configured}
            <Check class="size-3.5 text-[color:var(--color-accent)]" />
          {/if}
          {#if starting === provider.id}
            <Loader2 class="size-3.5 animate-spin" />
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <div class="space-y-3 text-[12px]">
      <AuthInfoRow label="provider" value={job.providerName ?? job.providerId} />
      <AuthInfoRow label="status" value={job.status} />

      {#if job.authUrl}
        <a class="block rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-3 text-center font-medium text-[color:var(--color-bg)]" href={job.authUrl} target="_blank" rel="noreferrer">open sign-in page</a>
      {/if}
      {#if job.verificationUri}
        <a class="block rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-3 text-center font-medium text-[color:var(--color-bg)]" href={job.verificationUri} target="_blank" rel="noreferrer">open verification page</a>
      {/if}
      {#if job.userCode}
        <AuthInfoRow label="device code" value={job.userCode} />
      {/if}
      {#if job.instructions}
        <p class="text-[11px] leading-relaxed text-[color:var(--color-fg-muted)]">{job.instructions}</p>
      {/if}
      {#if job.progress}
        <p class="text-[11px] text-[color:var(--color-fg-muted)]">{job.progress}</p>
      {/if}
      {#if job.error}
        <p class="text-[11px] text-[color:var(--color-danger)]">{job.error}</p>
      {/if}

      {#if job.status === "prompt" || job.status === "manual"}
        <div>
          <label class="label mb-1.5 block" for="auth_input">{job.promptMessage ?? "input"}</label>
          <Textarea id="auth_input" rows={3} bind:value={input} placeholder={job.promptPlaceholder ?? "paste code or redirect URL"} class="min-h-0 text-[12px]" />
        </div>
        <Button type="button" class="w-full" onclick={submit}>submit</Button>
      {/if}

      <Button type="button" variant="outline" class="w-full" onclick={refreshJob}>refresh</Button>
      <Button type="button" variant="outline" class="w-full text-[color:var(--color-fg-muted)]" onclick={cancel}>cancel</Button>
    </div>
  {/if}
</div>


<script lang="ts">
  import { onMount } from "svelte";
  import { Check, Loader2 } from "@lucide/svelte";
  import { authJobShouldPoll, createProviderAuthState } from "@/features/auth/provider-auth.state.svelte";
  import { Button } from "@/shared/ui/button";
  import { Textarea } from "@/shared/ui/textarea";

  let {
    onError,
    onConfigured,
    class: className = "",
  }: {
    onError: (message: string | null) => void;
    onConfigured?: () => void;
    class?: string;
  } = $props();

  // These callbacks are intentionally captured for the lifetime of this view instance.
  // svelte-ignore state_referenced_locally
  const auth = createProviderAuthState({ onError, onConfigured });

  onMount(() => {
    void auth.loadProviders();
  });

  $effect(() => {
    if (!authJobShouldPoll(auth.job)) return;
    const interval = window.setInterval(() => {
      void auth.refreshJob();
    }, 1200);
    return () => window.clearInterval(interval);
  });
</script>

<div class={`flex-1 overflow-y-auto ${className}`}>
  {#if !auth.job}
    <div class="space-y-2">
      {#if auth.loading}
        <div class="text-[12px] text-[color:var(--color-fg-faint)]">loading providers…</div>
      {/if}

      {#each auth.providers as provider (provider.id)}
        <button
          type="button"
          onclick={() => auth.start(provider)}
          disabled={auth.startingProviderId !== null}
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
          {#if auth.startingProviderId === provider.id}
            <Loader2 class="size-3.5 animate-spin" />
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <div class="space-y-3 text-[12px]">
      {@render InfoRow("provider", auth.job.providerName ?? auth.job.providerId)}
      {@render InfoRow("status", auth.job.status)}

      {#if auth.job.authUrl}
        <a class="block rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-3 text-center font-medium text-[color:var(--color-bg)]" href={auth.job.authUrl} target="_blank" rel="noreferrer">open sign-in page</a>
      {/if}
      {#if auth.job.verificationUri}
        <a class="block rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-3 text-center font-medium text-[color:var(--color-bg)]" href={auth.job.verificationUri} target="_blank" rel="noreferrer">open verification page</a>
      {/if}
      {#if auth.job.userCode}
        {@render InfoRow("device code", auth.job.userCode)}
      {/if}
      {#if auth.job.instructions}
        <p class="text-[11px] leading-relaxed text-[color:var(--color-fg-muted)]">{auth.job.instructions}</p>
      {/if}
      {#if auth.job.progress}
        <p class="text-[11px] text-[color:var(--color-fg-muted)]">{auth.job.progress}</p>
      {/if}
      {#if auth.job.error}
        <p class="text-[11px] text-[color:var(--color-danger)]">{auth.job.error}</p>
      {/if}

      {#if auth.job.status === "prompt" || auth.job.status === "manual"}
        <div>
          <label class="label mb-1.5 block" for="auth_input">{auth.job.promptMessage ?? "input"}</label>
          <Textarea
            id="auth_input"
            rows={3}
            value={auth.input}
            oninput={(event) => auth.setInput(event.currentTarget.value)}
            placeholder={auth.job.promptPlaceholder ?? "paste code or redirect URL"}
            class="min-h-0 text-[12px]"
          />
        </div>
        <Button type="button" class="w-full" onclick={() => auth.submit()}>submit</Button>
      {/if}

      <Button type="button" variant="outline" class="w-full" onclick={() => auth.refreshJob()}>refresh</Button>
      <Button type="button" variant="outline" class="w-full text-[color:var(--color-fg-muted)]" onclick={() => auth.cancel()}>cancel</Button>
    </div>
  {/if}
</div>

{#snippet InfoRow(label: string, value: string)}
  <div class="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2">
    <div class="label">{label}</div>
    <div class="mt-1 break-words text-[12px] text-[color:var(--color-fg)]">{value}</div>
  </div>
{/snippet}

import type { AuthLoginJob, AuthProvider } from "@pi-mobile/protocol";
import { settingsState } from "@/features/settings/settings.state.svelte";
import { cancelAuthLogin, getAuthLoginJob, listAuthProviders, startAuthLogin, submitAuthLoginInput } from "@/features/auth/api";
import { haptics } from "@/shared/mobile/haptics";

export interface ProviderAuthStateOptions {
  onError: (message: string | null) => void;
  onConfigured?: () => void;
}

export interface ProviderAuthState {
  readonly providers: AuthProvider[];
  readonly loading: boolean;
  readonly job: AuthLoginJob | null;
  readonly input: string;
  readonly startingProviderId: string | null;
  setInput(value: string): void;
  loadProviders(): Promise<void>;
  start(provider: AuthProvider): Promise<void>;
  refreshJob(): Promise<void>;
  submit(): Promise<void>;
  cancel(): Promise<void>;
}

export function createProviderAuthState(opts: ProviderAuthStateOptions): ProviderAuthState {
  let providers = $state<AuthProvider[]>([]);
  let loading = $state(false);
  let job = $state<AuthLoginJob | null>(null);
  let input = $state("");
  let startingProviderId = $state<string | null>(null);

  async function loadProviders(): Promise<void> {
    loading = true;
    try {
      if (!settingsState.loaded) await settingsState.load();
      providers = (await listAuthProviders()).providers;
      opts.onError(null);
    } catch (error) {
      opts.onError(String(error));
    } finally {
      loading = false;
    }
  }

  async function start(provider: AuthProvider): Promise<void> {
    if (startingProviderId) return;
    startingProviderId = provider.id;
    opts.onError(null);
    try {
      job = await startAuthLogin(provider.id);
    } catch (error) {
      opts.onError(String(error));
    } finally {
      startingProviderId = null;
    }
  }

  async function refreshJob(): Promise<void> {
    if (!job) return;
    const next = await getAuthLoginJob(job.id);
    job = next;
    if (next.status === "success") {
      haptics.success();
      await loadProviders();
      opts.onConfigured?.();
    }
  }

  async function submit(): Promise<void> {
    if (!job) return;
    job = await submitAuthLoginInput(job.id, input);
    input = "";
  }

  async function cancel(): Promise<void> {
    if (!job) return;
    await cancelAuthLogin(job.id);
    job = null;
  }

  return {
    get providers() {
      return providers;
    },
    get loading() {
      return loading;
    },
    get job() {
      return job;
    },
    get input() {
      return input;
    },
    get startingProviderId() {
      return startingProviderId;
    },
    setInput(value: string) {
      input = value;
    },
    loadProviders,
    start,
    refreshJob,
    submit,
    cancel,
  };
}

export function authJobShouldPoll(job: AuthLoginJob | null): boolean {
  return !!job && !["success", "failed", "cancelled", "prompt", "manual"].includes(job.status);
}

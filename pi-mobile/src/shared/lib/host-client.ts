import { settingsState } from "@/features/settings/settings.state.svelte";
import { ApiClient } from "@/shared/lib/api-client";
import { createHostTrpcClient } from "@/shared/lib/trpc-client";

export function getHostClient(): ApiClient {
  return createHostClient(settingsState.hostUrl);
}

export function createHostClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}

export function getHostTrpc() {
  return createHostTrpc(settingsState.hostUrl);
}

export function createHostTrpc(baseUrl: string) {
  return createHostTrpcClient(baseUrl);
}

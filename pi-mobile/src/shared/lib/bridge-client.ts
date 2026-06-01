import { settingsState } from "@/features/settings/settings.state.svelte";
import { ApiClient } from "@/shared/lib/api-client";

export function getBridgeClient(): ApiClient {
  return createBridgeClient(settingsState.bridgeUrl);
}

export function createBridgeClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}

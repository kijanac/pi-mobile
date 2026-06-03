import { settingsState } from "@/features/settings/settings.state.svelte";
import { ApiClient } from "@/shared/lib/api-client";
import { createBridgeTrpcClient } from "@/shared/lib/trpc-client";

export function getBridgeClient(): ApiClient {
  return createBridgeClient(settingsState.bridgeUrl);
}

export function createBridgeClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}

export function getBridgeTrpc() {
  return createBridgeTrpc(settingsState.bridgeUrl);
}

export function createBridgeTrpc(baseUrl: string) {
  return createBridgeTrpcClient(baseUrl);
}

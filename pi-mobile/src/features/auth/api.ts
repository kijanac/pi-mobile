import { getBridgeTrpc } from "@/shared/lib/bridge-client";

export function listAuthProviders() {
  return getBridgeTrpc().auth.providers.query({});
}

export function startAuthLogin(providerId: string) {
  return getBridgeTrpc().auth.startLogin.mutate({ providerId });
}

export function getAuthLoginJob(jobId: string) {
  return getBridgeTrpc().auth.getLogin.query({ jobId });
}

export function submitAuthLoginInput(jobId: string, value: string) {
  return getBridgeTrpc().auth.submitLoginInput.mutate({ jobId, value });
}

export function saveAuthApiKey(providerId: string, apiKey: string) {
  return getBridgeTrpc().auth.saveApiKey.mutate({ providerId, apiKey });
}

export function cancelAuthLogin(jobId: string) {
  return getBridgeTrpc().auth.cancelLogin.mutate({ jobId });
}

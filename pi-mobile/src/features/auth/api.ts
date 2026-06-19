import { getHostTrpc } from "@/shared/lib/host-client";

export function listAuthProviders() {
  return getHostTrpc().auth.providers.query({});
}

export function startAuthLogin(providerId: string) {
  return getHostTrpc().auth.startLogin.mutate({ providerId });
}

export function getAuthLoginJob(jobId: string) {
  return getHostTrpc().auth.getLogin.query({ jobId });
}

export function submitAuthLoginInput(jobId: string, value: string) {
  return getHostTrpc().auth.submitLoginInput.mutate({ jobId, value });
}

export function saveAuthApiKey(providerId: string, apiKey: string) {
  return getHostTrpc().auth.saveApiKey.mutate({ providerId, apiKey });
}

export function cancelAuthLogin(jobId: string) {
  return getHostTrpc().auth.cancelLogin.mutate({ jobId });
}

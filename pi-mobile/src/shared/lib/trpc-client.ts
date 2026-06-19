import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@pico/protocol/trpc";

type HostTrpcClient = ReturnType<typeof createTRPCClient<AppRouter>>;

const clients = new Map<string, HostTrpcClient>();

export function createHostTrpcClient(baseUrl: string): HostTrpcClient {
  const cached = clients.get(baseUrl);
  if (cached) return cached;

  const client = createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: `${baseUrl}/trpc`,
      }),
    ],
  });
  clients.set(baseUrl, client);
  return client;
}

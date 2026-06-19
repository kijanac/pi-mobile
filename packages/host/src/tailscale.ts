import { commandExists, run } from "./exec.ts";

export interface TailscaleStatus {
  readonly backendState?: string;
  readonly dnsName?: string;
  readonly hostName?: string;
  readonly ips: string[];
}

export function hasTailscale(): boolean {
  return commandExists("tailscale", ["version"]);
}

export function tailscaleStatus(): TailscaleStatus | undefined {
  const result = run("tailscale", ["status", "--json"], { timeoutMs: 8_000 });
  if (result.status !== 0) return undefined;

  try {
    const status = JSON.parse(result.stdout) as {
      BackendState?: string;
      Self?: { DNSName?: string; HostName?: string; TailscaleIPs?: string[] };
      TailscaleIPs?: string[];
    };
    return {
      backendState: status.BackendState,
      dnsName: status.Self?.DNSName?.replace(/\.$/, "") || undefined,
      hostName: status.Self?.HostName,
      ips: status.Self?.TailscaleIPs ?? status.TailscaleIPs ?? [],
    };
  } catch {
    return undefined;
  }
}

export function tailscaleDnsName(): string | undefined {
  return tailscaleStatus()?.dnsName;
}

export function tailscaleHttpsUrl(): string | undefined {
  const dnsName = tailscaleDnsName();
  return dnsName ? `https://${dnsName}` : undefined;
}

export function tailscaleServeStatus(): string | undefined {
  const result = run("tailscale", ["serve", "status"], { timeoutMs: 8_000 });
  if (result.status !== 0) return undefined;
  return result.stdout.trim() || undefined;
}

export function tailscaleServeUrlForPort(port: number): string | undefined {
  const status = tailscaleServeStatus();
  if (!status?.includes(`http://localhost:${port}`)) return undefined;
  return tailscaleHttpsUrl();
}

export function configureTailscaleServe(port: number): string | undefined {
  if (!hasTailscale()) {
    console.warn("\nWARNING: tailscale CLI not found; Pico host is running locally but cannot be paired from mobile yet.");
    return undefined;
  }

  const serveSkipped = process.env.PICO_SKIP_TAILSCALE_SERVE === "1";
  if (!serveSkipped) {
    const serve = run("tailscale", ["serve", "--bg", "--https=443", `http://localhost:${port}`], {
      stdio: "inherit",
      timeoutMs: 30_000,
    });
    if (serve.status !== 0) {
      console.warn("\nWARNING: tailscale serve failed; run this manually after fixing Tailscale:");
      console.warn(`  tailscale serve --bg --https=443 http://localhost:${port}`);
    }
  }

  return tailscaleServeUrlForPort(port) ?? (serveSkipped ? undefined : tailscaleHttpsUrl());
}

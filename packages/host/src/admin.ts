import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type PicoHostPaths, picoHostPathsFromEnv } from "./paths.ts";

export interface LocalAdminStatus {
  readonly ok: true;
  readonly pid: number;
  readonly uptimeSeconds: number;
  readonly cwd: string;
  readonly dataDir: string;
  readonly dbPath: string;
  readonly workspacesDir: string;
  readonly claimed: boolean;
  readonly owners: string[];
  readonly pairingTokenConfigured: boolean;
  readonly system?: {
    readonly hostVersion: string;
    readonly protocolVersion: number;
    readonly minMobileVersion: string;
    readonly recommendedMobileVersion: string;
    readonly updateChannel: string;
    readonly autoUpdate: boolean;
  };
}

export interface LocalAdminPairing extends LocalAdminStatus {
  readonly token?: string;
  readonly tokenConfigured: boolean;
}

export function localAdminTokenPath(dataDir: string): string {
  return join(dataDir, "admin-token");
}

export function readLocalAdminToken(dataDir: string): string | undefined {
  const path = localAdminTokenPath(dataDir);
  if (!existsSync(path)) return undefined;
  const token = readFileSync(path, "utf8").trim();
  return token || undefined;
}

async function localAdminFetch<T>(path: string, opts: { readonly paths?: PicoHostPaths; readonly method?: "GET" | "POST" } = {}): Promise<T> {
  const paths = opts.paths ?? picoHostPathsFromEnv();
  const token = readLocalAdminToken(paths.dataDir);
  if (!token) throw new Error(`local admin token not found at ${localAdminTokenPath(paths.dataDir)}`);

  const response = await fetch(`http://${paths.host}:${paths.port}${path}`, {
    method: opts.method ?? "GET",
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`local admin ${path} failed: ${response.status}${text ? ` ${text}` : ""}`);
  }
  return await response.json() as T;
}

export function getLocalAdminStatus(paths?: PicoHostPaths): Promise<LocalAdminStatus> {
  return localAdminFetch<LocalAdminStatus>("/admin/status", { paths });
}

export function getLocalAdminPairing(paths?: PicoHostPaths): Promise<LocalAdminPairing> {
  return localAdminFetch<LocalAdminPairing>("/admin/pairing", { paths });
}

export function rotateLocalAdminPairingToken(paths?: PicoHostPaths): Promise<LocalAdminPairing> {
  return localAdminFetch<LocalAdminPairing>("/admin/pairing/rotate", { paths, method: "POST" });
}

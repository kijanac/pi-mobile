import { mkdirSync } from "node:fs";
import type { PicoHostHandle } from "@pico/host-runtime/host";
import { startPicoHost } from "@pico/host-runtime/host";
import { getLocalAdminPairing, rotateLocalAdminPairingToken, type LocalAdminPairing } from "./admin.ts";
import { PicoSetupError, type Diagnostic } from "./errors.ts";
import { healthcheck, portIsOpen } from "./network.ts";
import { getOrCreatePairingToken, readPairingToken, rotatePairingToken } from "./pairing.ts";
import { picoHostPathsFromEnv, type PicoHostPaths } from "./paths.ts";
import { ensureTailscaleServe } from "./tailscale.ts";

export interface PreparePairingOptions {
  readonly paths?: PicoHostPaths;
  readonly rotate?: boolean;
  readonly startHost?: boolean;
  readonly configureServe?: boolean;
  readonly inheritTailscaleStdio?: boolean;
}

export interface PairingPlan {
  readonly existing: boolean;
  readonly foregroundHostStarted: boolean;
  readonly host?: PicoHostHandle;
  readonly hostUrl?: string;
  readonly token?: string;
  readonly workspacesDir: string;
  readonly dataDir: string;
  readonly port: number;
  readonly diagnostics: readonly Diagnostic[];
  readonly rotationUnavailable: boolean;
}

export interface PrepareServingOptions {
  readonly paths?: PicoHostPaths;
  readonly configureServe?: boolean;
  readonly inheritTailscaleStdio?: boolean;
}

export interface ServingPlan {
  readonly host: PicoHostHandle;
  readonly hostUrl?: string;
  readonly localUrl: string;
  readonly workspacesDir: string;
  readonly dataDir: string;
  readonly diagnostics: readonly Diagnostic[];
}

export async function preparePairing(options: PreparePairingOptions = {}): Promise<PairingPlan> {
  const paths = options.paths ?? picoHostPathsFromEnv();
  const diagnostics: Diagnostic[] = [];
  ensurePicoHostDirectories(paths);

  const existing = await portIsOpen(paths.host, paths.port);
  const adminPairing = existing ? await readRunningHostPairing(paths, Boolean(options.rotate), diagnostics) : undefined;
  const token = pairingTokenForPlan(paths, existing, adminPairing, Boolean(options.rotate));

  let host: PicoHostHandle | undefined;
  let foregroundHostStarted = false;
  if (!existing && options.startHost) {
    host = await startHost(paths, token);
    foregroundHostStarted = true;
    try {
      await waitForPicoHostHealth(paths);
    } catch (error) {
      await host.close().catch(() => {});
      throw error;
    }
  }

  const tailscale = await ensureTailscaleServe(paths.port, {
    configure: Boolean(options.configureServe),
    inheritStdio: options.inheritTailscaleStdio,
  });
  diagnostics.push(...tailscale.diagnostics.filter((diagnostic) => diagnostic.level !== "ok"));

  return {
    existing,
    foregroundHostStarted,
    host,
    hostUrl: tailscale.serveUrl,
    token,
    workspacesDir: paths.workspacesDir,
    dataDir: paths.dataDir,
    port: paths.port,
    diagnostics,
    rotationUnavailable: Boolean(options.rotate && existing && !adminPairing),
  };
}

export async function prepareServing(options: PrepareServingOptions = {}): Promise<ServingPlan> {
  const paths = options.paths ?? picoHostPathsFromEnv();
  ensurePicoHostDirectories(paths);

  if (await portIsOpen(paths.host, paths.port)) {
    throw new PicoSetupError({
      code: "host_port_in_use",
      message: `Port ${paths.host}:${paths.port} is already in use`,
      detail: `${paths.host}:${paths.port}`,
      fix: "Stop the existing Pico host process, or set PICO_HOST_PORT.",
    });
  }

  const token = getOrCreatePairingTokenSafe(paths);
  const host = await startHost(paths, token);
  try {
    await waitForPicoHostHealth(paths);
    const tailscale = await ensureTailscaleServe(paths.port, {
      configure: Boolean(options.configureServe),
      inheritStdio: options.inheritTailscaleStdio,
    });

    return {
      host,
      hostUrl: tailscale.serveUrl,
      localUrl: `http://${paths.host}:${paths.port}`,
      workspacesDir: paths.workspacesDir,
      dataDir: paths.dataDir,
      diagnostics: tailscale.diagnostics.filter((diagnostic) => diagnostic.level !== "ok"),
    };
  } catch (error) {
    await host.close().catch(() => {});
    throw error;
  }
}

function ensurePicoHostDirectories(paths: PicoHostPaths): void {
  try {
    mkdirSync(paths.dataDir, { recursive: true });
    mkdirSync(paths.workspacesDir, { recursive: true });
  } catch (cause) {
    throw new PicoSetupError({
      code: "path_not_writable",
      message: "Could not prepare Pico host directories",
      detail: cause instanceof Error ? cause.message : String(cause),
      fix: "Check directory permissions or set PICO_HOST_DATA_DIR/PICO_WORKSPACES_DIR.",
      cause,
    });
  }
}

function getOrCreatePairingTokenSafe(paths: PicoHostPaths): string {
  try {
    return getOrCreatePairingToken(paths.dataDir);
  } catch (cause) {
    throw new PicoSetupError({
      code: "path_not_writable",
      message: "Could not create Pico pairing token",
      detail: cause instanceof Error ? cause.message : String(cause),
      fix: `Check write access to ${paths.dataDir}.`,
      cause,
    });
  }
}

function rotatePairingTokenSafe(paths: PicoHostPaths): string {
  try {
    return rotatePairingToken(paths.dataDir);
  } catch (cause) {
    throw new PicoSetupError({
      code: "path_not_writable",
      message: "Could not rotate Pico pairing token",
      detail: cause instanceof Error ? cause.message : String(cause),
      fix: `Check write access to ${paths.dataDir}.`,
      cause,
    });
  }
}

async function startHost(paths: PicoHostPaths, token: string | undefined): Promise<PicoHostHandle> {
  try {
    return await startPicoHost({
      dbPath: paths.dbPath,
      workspacesDir: paths.workspacesDir,
      pairingToken: token,
      host: paths.host,
      port: paths.port,
      nodeEnv: process.env.NODE_ENV || "production",
    });
  } catch (cause) {
    throw new PicoSetupError({
      code: "host_start_failed",
      message: "Could not start Pico host",
      detail: cause instanceof Error ? cause.message : String(cause),
      fix: "Run `pico doctor` for details, or set PICO_HOST_PORT if the port is occupied.",
      cause,
    });
  }
}

async function waitForPicoHostHealth(paths: PicoHostPaths, timeoutMs = 15_000): Promise<void> {
  const localUrl = `http://${paths.host}:${paths.port}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await healthcheck(localUrl, 1_000)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new PicoSetupError({
    code: "host_health_timeout",
    message: "Timed out waiting for Pico host /healthz",
    detail: localUrl,
    fix: "Check `pico logs` or run `pico serve` in the foreground.",
  });
}

async function readRunningHostPairing(paths: PicoHostPaths, rotate: boolean, diagnostics: Diagnostic[]): Promise<LocalAdminPairing | undefined> {
  try {
    return rotate ? await rotateLocalAdminPairingToken(paths) : await getLocalAdminPairing(paths);
  } catch (error) {
    if (rotate) {
      diagnostics.push({
        level: "warn",
        code: "local_admin_unavailable",
        label: "Local admin",
        detail: error instanceof Error ? error.message : String(error),
        fix: "Restart the host with the current Pico CLI if pairing token rotation/status is unavailable.",
      });
    }
    return undefined;
  }
}

function pairingTokenForPlan(
  paths: PicoHostPaths,
  existing: boolean,
  adminPairing: LocalAdminPairing | undefined,
  rotate: boolean,
): string | undefined {
  if (existing) return adminPairing?.token || process.env.PICO_PAIRING_TOKEN?.trim() || readPairingToken(paths.dataDir);
  return rotate ? rotatePairingTokenSafe(paths) : getOrCreatePairingTokenSafe(paths);
}

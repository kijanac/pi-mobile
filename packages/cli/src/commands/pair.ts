import { mkdirSync } from "node:fs";
import {
  configureTailscaleServe,
  getLocalAdminPairing,
  getOrCreatePairingToken,
  healthcheck,
  makePairingDeepLink,
  picoHostPathsFromEnv,
  portIsOpen,
  readPairingToken,
  rotateLocalAdminPairingToken,
  rotatePairingToken,
  startPicoHost,
  tailscaleServeUrlForPort,
  type PicoHostHandle,
} from "@pico/host";
import { terminalQr } from "../lib/terminal.ts";

async function waitForHealth(host: string, port: number): Promise<void> {
  const deadline = Date.now() + 15_000;
  const url = `http://${host}:${port}`;
  while (Date.now() < deadline) {
    if (await healthcheck(url, 1_000)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Timed out waiting for Pico host /healthz");
}

export async function printPairingInfo(options: {
  readonly hostUrl: string | undefined;
  readonly token?: string;
  readonly workspacesDir: string;
  readonly dataDir: string;
  readonly port: number;
  readonly existing?: boolean;
  readonly foreground?: boolean;
}): Promise<void> {
  console.log(`\n\x1b[1;36mPico host ${options.existing ? "is already running" : "is running"}\x1b[0m`);
  console.log(`  workspaces: ${options.workspacesDir}`);
  console.log(`  data:       ${options.dataDir}`);

  if (!options.hostUrl) {
    console.log("\nNo Tailscale HTTPS URL was detected yet.");
    console.log(`After Tailscale is connected, run: tailscale serve --bg --https=443 http://localhost:${options.port}`);
    console.log("Then enter the resulting https://…ts.net URL in Pico Settings.");
    return;
  }

  const connectUrl = makePairingDeepLink({ hostUrl: options.hostUrl, token: options.token });
  console.log(`  url:        ${options.hostUrl}`);
  console.log("\nScan this QR with your phone camera, or open the link below:");
  const qr = await terminalQr(connectUrl);
  if (qr) console.log(qr);
  console.log(`  ${connectUrl}`);
  console.log("\nManual fallback:");
  console.log(`  Pico host URL: ${options.hostUrl}`);
  if (options.token) {
    console.log(`  Pairing token: ${options.token}`);
  } else {
    console.log("  Pairing token: not included (host may already be claimed)");
  }
  if (options.foreground) console.log("\nPress Ctrl+C to stop this foreground host.");
}

async function waitUntilStopped(host: PicoHostHandle): Promise<void> {
  let stopping = false;
  await new Promise<void>((resolveStopped) => {
    const stop = () => {
      if (stopping) return;
      stopping = true;
      void host.close().finally(resolveStopped);
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

function pairingHostUrl(port: number, configureServe: boolean): string | undefined {
  if (process.env.PICO_HOST_URL?.trim()) return process.env.PICO_HOST_URL.trim();
  return configureServe ? configureTailscaleServe(port) : tailscaleServeUrlForPort(port);
}

export async function pairCommand(): Promise<void> {
  const paths = picoHostPathsFromEnv();

  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.workspacesDir, { recursive: true });

  if (await portIsOpen(paths.host, paths.port)) {
    const adminPairing = await getLocalAdminPairing(paths).catch(() => undefined);
    const token = adminPairing?.token || process.env.PICO_PAIRING_TOKEN?.trim() || readPairingToken(paths.dataDir);
    const hostUrl = pairingHostUrl(paths.port, true);
    await printPairingInfo({
      hostUrl,
      token,
      workspacesDir: paths.workspacesDir,
      dataDir: paths.dataDir,
      port: paths.port,
      existing: true,
      foreground: false,
    });
    if (!token) {
      console.log("\nNo local pairing token file was found for the running host. If it is unclaimed, restart it with `pico serve` or `pico pair` to load a stored token.");
    }
    return;
  }

  const token = getOrCreatePairingToken(paths.dataDir);

  const host = await startPicoHost({
    dbPath: paths.dbPath,
    workspacesDir: paths.workspacesDir,
    pairingToken: token,
    host: paths.host,
    port: paths.port,
    nodeEnv: process.env.NODE_ENV || "production",
  });

  try {
    await waitForHealth(paths.host, paths.port);
    const hostUrl = pairingHostUrl(paths.port, true);
    await printPairingInfo({ hostUrl, token, workspacesDir: paths.workspacesDir, dataDir: paths.dataDir, port: paths.port, foreground: true });
    await waitUntilStopped(host);
  } catch (error) {
    await host.close();
    throw error;
  }
}

export async function pairCodeCommand(options: { readonly rotate?: boolean } = {}): Promise<void> {
  const paths = picoHostPathsFromEnv();
  const existing = await portIsOpen(paths.host, paths.port);
  const adminPairing = existing
    ? options.rotate
      ? await rotateLocalAdminPairingToken(paths).catch(() => undefined)
      : await getLocalAdminPairing(paths).catch(() => undefined)
    : undefined;
  const token = existing
    ? adminPairing?.token || process.env.PICO_PAIRING_TOKEN?.trim() || readPairingToken(paths.dataDir)
    : options.rotate
      ? rotatePairingToken(paths.dataDir)
      : getOrCreatePairingToken(paths.dataDir);
  const hostUrl = pairingHostUrl(paths.port, false) ?? pairingHostUrl(paths.port, true);
  await printPairingInfo({
    hostUrl,
    token,
    workspacesDir: paths.workspacesDir,
    dataDir: paths.dataDir,
    port: paths.port,
    existing,
    foreground: false,
  });
  if (options.rotate && existing && !adminPairing) {
    console.log("\nCould not rotate the running host token through local admin. Restart it with the current `pico serve`/`pico pair` first.");
  }
  if (existing && !token) {
    console.log("\nNo local pairing token file was found for the running host. If it is unclaimed, restart it with `pico serve` or `pico pair` to load a stored token.");
  }
}

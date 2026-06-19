import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

export interface PairingLinkOptions {
  readonly hostUrl: string;
  readonly token?: string;
}

export function pairingTokenPath(dataDir: string): string {
  return join(dataDir, "pairing-token");
}

export function makePairingToken(): string {
  return randomBytes(24).toString("base64url");
}

export function readPairingToken(dataDir: string): string | undefined {
  const path = pairingTokenPath(dataDir);
  if (!existsSync(path)) return undefined;
  const token = readFileSync(path, "utf8").trim();
  return token || undefined;
}

export function writePairingToken(dataDir: string, token: string): string {
  mkdirSync(dataDir, { recursive: true });
  const path = pairingTokenPath(dataDir);
  writeFileSync(path, `${token.trim()}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return token.trim();
}

export function getOrCreatePairingToken(dataDir: string, opts: { readonly rotate?: boolean } = {}): string {
  const envToken = process.env.PICO_PAIRING_TOKEN?.trim();
  if (envToken) return envToken;
  const existing = opts.rotate ? undefined : readPairingToken(dataDir);
  return existing ?? writePairingToken(dataDir, makePairingToken());
}

export function rotatePairingToken(dataDir: string): string {
  return writePairingToken(dataDir, makePairingToken());
}

export function makePairingDeepLink(options: PairingLinkOptions): string {
  const url = new URL("pico://connect");
  url.searchParams.set("url", options.hostUrl);
  if (options.token) url.searchParams.set("claim", options.token);
  return url.toString();
}

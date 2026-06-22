import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOST_DATA_DIR, DB_PATH, WORKSPACES_DIR } from "./config.ts";
import { currentPairingToken, headerValue, picoHostOwnerLogins, setPairingToken, type HeaderSource } from "./auth.ts";
import { hostSystemInfo } from "./http/system.ts";
import type { LocalAdminPairingData, LocalAdminStatusData } from "./http/api.ts";

const ADMIN_TOKEN_FILE = "admin-token";
const PAIRING_TOKEN_FILE = "pairing-token";

function secureWrite(path: string, value: string): void {
  writeFileSync(path, `${value}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function localAdminTokenPath(): string {
  return join(HOST_DATA_DIR, ADMIN_TOKEN_FILE);
}

export function pairingTokenPath(): string {
  return join(HOST_DATA_DIR, PAIRING_TOKEN_FILE);
}

export function ensureLocalAdminToken(): string {
  mkdirSync(HOST_DATA_DIR, { recursive: true });
  const path = localAdminTokenPath();
  if (existsSync(path)) {
    const existing = readFileSync(path, "utf8").trim();
    if (existing) return existing;
  }
  const token = randomBytes(32).toString("base64url");
  secureWrite(path, token);
  return token;
}

function writePairingToken(token: string): string {
  mkdirSync(HOST_DATA_DIR, { recursive: true });
  secureWrite(pairingTokenPath(), token.trim());
  setPairingToken(token.trim());
  return token.trim();
}

function readAuthToken(headers: HeaderSource): string | undefined {
  const bearer = headerValue(headers, "authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || headerValue(headers, "x-pico-admin-token")?.trim() || undefined;
}

export function adminTokenAuthorized(headers: HeaderSource): boolean {
  const expected = ensureLocalAdminToken();
  const actual = readAuthToken(headers);
  return Boolean(actual && actual === expected);
}

export function adminStatus(): LocalAdminStatusData {
  const owners = picoHostOwnerLogins();
  return {
    ok: true,
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    cwd: process.cwd(),
    dataDir: HOST_DATA_DIR,
    dbPath: DB_PATH,
    workspacesDir: WORKSPACES_DIR,
    system: hostSystemInfo(),
    owners,
    claimed: owners.length > 0,
    pairingTokenConfigured: Boolean(currentPairingToken()),
  };
}

export function adminPairing(): LocalAdminPairingData {
  return {
    token: currentPairingToken(),
    tokenConfigured: Boolean(currentPairingToken()),
    ...adminStatus(),
  };
}

export function rotatePairing(): LocalAdminPairingData {
  const token = writePairingToken(randomBytes(24).toString("base64url"));
  return { token, tokenConfigured: true, ...adminStatus() };
}

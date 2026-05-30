import { dirname, resolve } from "node:path";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const DB_PATH = requiredEnv("BRIDGE_DB");
export const BRIDGE_DATA_DIR = dirname(resolve(DB_PATH));
export const WORKSPACES_DIR = requiredEnv("PI_WORKSPACES_DIR");

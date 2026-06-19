import { dirname, resolve } from "node:path";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const DB_PATH = requiredEnv("PICO_HOST_DB");
export const HOST_DATA_DIR = dirname(resolve(DB_PATH));
export const WORKSPACES_DIR = requiredEnv("PICO_WORKSPACES_DIR");

import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export interface RunOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly stdio?: "pipe" | "inherit";
}

export function run(command: string, args: readonly string[], options: RunOptions = {}): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    timeout: options.timeoutMs,
  });
}

export function commandExists(command: string, args: readonly string[] = ["--version"]): boolean {
  return run(command, args, { timeoutMs: 5_000 }).status === 0;
}

export function commandLine(command: string, args: readonly string[]): string {
  return [command, ...args].map(shellQuote).join(" ");
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_/:=-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

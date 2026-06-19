import { accessSync, constants, existsSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@pico/protocol/trpc";
import { getBundledPiSdkVersion } from "@pico/host-runtime/host";
import { commandExists, run } from "./exec.ts";
import { healthcheck, portIsOpen } from "./network.ts";
import { picoHostPathsFromEnv } from "./paths.ts";
import { hasTailscale, tailscaleHttpsUrl, tailscaleServeStatus, tailscaleStatus } from "./tailscale.ts";

const MIN_NODE_MAJOR = 26;
const MIN_NODE_MINOR = 1;
const PI_MODEL_LIST_TIMEOUT_MS = 15_000;

export interface CheckResult {
  readonly level: "ok" | "warn" | "fail";
  readonly label: string;
  readonly detail?: string;
  readonly fix?: string;
}

function nodeVersionOk(): boolean {
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  return major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR);
}

function canAccess(path: string, mode: number): boolean {
  try {
    accessSync(path, mode);
    return true;
  } catch {
    return false;
  }
}

function pathCheck(label: string, path: string, opts?: { createHint?: boolean }): CheckResult {
  if (!existsSync(path)) {
    return {
      level: opts?.createHint ? "warn" : "fail",
      label,
      detail: path,
      fix: opts?.createHint ? "pico pair will create this directory." : "Create this directory or choose a different path.",
    };
  }
  if (!canAccess(path, constants.R_OK | constants.W_OK)) {
    return { level: "fail", label, detail: path, fix: "Grant read/write access or choose a different path." };
  }
  return { level: "ok", label, detail: path };
}

function providerAuthSummary(): CheckResult {
  const authFile = join(homedir(), ".pi/agent/auth.json");
  const envKeys = [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_OAUTH_TOKEN",
    "OPENAI_API_KEY",
    "AZURE_OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "OPENROUTER_API_KEY",
    "AI_GATEWAY_API_KEY",
    "DEEPSEEK_API_KEY",
    "GROQ_API_KEY",
    "CEREBRAS_API_KEY",
    "XAI_API_KEY",
    "FIREWORKS_API_KEY",
    "TOGETHER_AI_API_KEY",
    "ZAI_API_KEY",
    "MISTRAL_API_KEY",
    "AWS_PROFILE",
  ].filter((key) => Boolean(process.env[key]?.trim()));

  if (existsSync(authFile)) {
    return { level: "ok", label: "Pi auth", detail: authFile };
  }
  if (envKeys.length > 0) {
    return { level: "ok", label: "Pi auth", detail: `provider env set: ${envKeys.join(", ")}` };
  }
  return {
    level: "warn",
    label: "Pi auth",
    detail: "no ~/.pi/agent/auth.json or common provider API key env found",
    fix: "Run `pi /login`, export a provider API key, or sign in through Pico provider auth after pairing.",
  };
}

function piCliVersionCheck(): CheckResult {
  const result = run("pi", ["--version"], { timeoutMs: 5_000 });
  if (result.status === 0) {
    return { level: "ok", label: "Installed pi CLI", detail: result.stdout.trim() || result.stderr.trim() || "available" };
  }
  return {
    level: "fail",
    label: "Installed pi CLI",
    detail: result.error ? result.error.message : "not found",
    fix: "Install Pi and make sure `pi --version` works for this OS user.",
  };
}

function sdkVersionChecks(): CheckResult[] {
  const bundledVersion = getBundledPiSdkVersion();
  const cliVersionResult = run("pi", ["--version"], { timeoutMs: 5_000 });
  const cliVersion = cliVersionResult.stdout.trim() || cliVersionResult.stderr.trim();
  const checks: CheckResult[] = [
    bundledVersion
      ? { level: "ok", label: "Embedded Pi SDK", detail: bundledVersion }
      : { level: "warn", label: "Embedded Pi SDK", detail: "version unavailable" },
  ];

  if (bundledVersion && cliVersion && bundledVersion !== cliVersion) {
    checks.push({
      level: "warn",
      label: "Pi version skew",
      detail: `embedded SDK ${bundledVersion} != installed CLI ${cliVersion}`,
      fix: "Pico uses its embedded SDK but reads the same ~/.pi/agent state. Upgrade Pico if CLI behavior differs.",
    });
  }

  return checks;
}

function projectContextCheck(workspacesDir: string): CheckResult {
  const interesting = [
    "AGENTS.md",
    "CLAUDE.md",
    ".pi/settings.json",
    ".pi/SYSTEM.md",
    ".pi/APPEND_SYSTEM.md",
    ".pi/extensions",
    ".pi/skills",
    ".pi/prompt-templates",
  ].filter((path) => existsSync(join(workspacesDir, path)));

  if (interesting.length > 0) {
    return { level: "ok", label: "Pi project context", detail: interesting.join(", ") };
  }

  return {
    level: "warn",
    label: "Pi project context",
    detail: "no AGENTS.md, CLAUDE.md, or .pi/ config found at the workspace root",
    fix: "This is fine for a blank project. Add AGENTS.md or .pi/settings.json if Pi needs project-specific instructions/settings.",
  };
}

function piModelRegistryCheck(workspacesDir: string): CheckResult {
  if (!commandExists("pi", ["--version"])) {
    return {
      level: "warn",
      label: "Pi model registry",
      detail: "skipped because `pi` is not available",
      fix: "Install Pi and rerun `pico doctor`.",
    };
  }

  const result = run("pi", ["--offline", "--list-models"], {
    cwd: workspacesDir,
    timeoutMs: PI_MODEL_LIST_TIMEOUT_MS,
  });

  if (result.status === 0) {
    const lines = (result.stdout || result.stderr).split(/\r?\n/).filter((line) => line.trim());
    const modelCount = Math.max(0, lines.length - 1);
    return {
      level: "ok",
      label: "Pi model registry",
      detail: `${modelCount} model${modelCount === 1 ? "" : "s"} visible from ${workspacesDir}`,
    };
  }

  const timedOut = result.error && "code" in result.error && result.error.code === "ETIMEDOUT";
  return {
    level: "fail",
    label: "Pi model registry",
    detail: timedOut ? `timed out after ${PI_MODEL_LIST_TIMEOUT_MS / 1000}s` : (result.stderr.trim() || result.error?.message || "pi --offline --list-models failed"),
    fix: "Run `pi --offline --list-models` in this directory and fix any Pi settings/extension errors first.",
  };
}

function inferredTailnetUrl(port: number): string | undefined {
  const serveTarget = `http://localhost:${port}`;
  const serveStatus = hasTailscale() ? tailscaleServeStatus() : undefined;
  return process.env.PICO_HOST_URL?.trim() || (serveStatus?.includes(serveTarget) ? tailscaleHttpsUrl() : undefined);
}

function trpcClientForHost(hostUrl: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: `${hostUrl.replace(/\/+$/, "")}/trpc`,
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }),
      }),
    ],
  });
}

async function tailscaleIdentityCheck(options: { readonly portOpen: boolean; readonly port: number }): Promise<CheckResult> {
  const serveTarget = `http://localhost:${options.port}`;
  const inferredUrl = inferredTailnetUrl(options.port);

  if (!inferredUrl) {
    return {
      level: "warn",
      label: "Tailscale identity",
      detail: "not checked; no Tailscale Serve URL detected",
      fix: `Start a host with \`pico pair\` or run: tailscale serve --bg --https=443 ${serveTarget}`,
    };
  }

  if (!options.portOpen) {
    return {
      level: "warn",
      label: "Tailscale identity",
      detail: `${inferredUrl} detected, but local host port is not listening`,
      fix: "Start the Pico host, then rerun `pico doctor`.",
    };
  }

  if (!(await healthcheck(inferredUrl))) {
    return {
      level: "fail",
      label: "Tailscale identity",
      detail: `${inferredUrl}/healthz is not reachable`,
      fix: "Check Tailscale, Serve, and that your phone/host are in the same tailnet.",
    };
  }

  try {
    const client = trpcClientForHost(inferredUrl);
    const identity = await client.system.identity.query({});
    if (!identity.user) {
      return {
        level: "warn",
        label: "Tailscale identity",
        detail: "system.identity succeeded without a Tailscale user (auth may be disabled)",
      };
    }
    return {
      level: "ok",
      label: "Tailscale identity",
      detail: `${identity.user} (${identity.claimed ? "claimed" : "unclaimed"})`,
    };
  } catch (error) {
    return {
      level: "fail",
      label: "Tailscale identity",
      detail: error instanceof Error ? error.message : String(error),
      fix: "Call the host through the https://*.ts.net Serve URL so Tailscale can inject identity headers.",
    };
  }
}

async function hostProviderAuthCheck(options: { readonly portOpen: boolean; readonly port: number }): Promise<CheckResult | undefined> {
  const inferredUrl = inferredTailnetUrl(options.port);
  if (!options.portOpen || !inferredUrl) return undefined;

  try {
    const auth = await trpcClientForHost(inferredUrl).auth.providers.query({});
    const configured = auth.providers.filter((provider) => provider.configured).length;
    const total = auth.providers.length;
    return configured > 0
      ? { level: "ok", label: "Host provider auth", detail: `${configured}/${total} provider${total === 1 ? "" : "s"} configured` }
      : {
          level: "warn",
          label: "Host provider auth",
          detail: `${total} provider${total === 1 ? "" : "s"} listed, none configured`,
          fix: "Run `pi /login`, export an API key, or use Pico provider auth after pairing.",
        };
  } catch (error) {
    return {
      level: "warn",
      label: "Host provider auth",
      detail: error instanceof Error ? error.message : String(error),
      fix: "This check requires a running, claimed host reachable through Tailscale Serve.",
    };
  }
}

export async function collectDoctorChecks(): Promise<CheckResult[]> {
  const paths = picoHostPathsFromEnv();
  const tsStatus = hasTailscale() ? tailscaleStatus() : undefined;
  const serveStatus = hasTailscale() ? tailscaleServeStatus() : undefined;
  const serveTarget = `http://localhost:${paths.port}`;
  const portOpen = await portIsOpen(paths.host, paths.port);

  const checks: CheckResult[] = [
    nodeVersionOk()
      ? { level: "ok", label: "Node", detail: process.version }
      : { level: "fail", label: "Node", detail: process.version, fix: "Install Node.js 26.1 or newer." },
    { level: "ok", label: "User", detail: `${userInfo().username} (${homedir()})` },
    ...sdkVersionChecks(),
    piCliVersionCheck(),
    pathCheck("Workspace root", paths.workspacesDir, { createHint: true }),
    pathCheck("Host data dir", paths.dataDir, { createHint: true }),
    projectContextCheck(paths.workspacesDir),
    piModelRegistryCheck(paths.workspacesDir),
    portOpen
      ? {
          level: "warn",
          label: "Host port",
          detail: `${paths.host}:${paths.port} is already listening`,
          fix: "This is OK if it is your Pico host. Stop it before running a new foreground `pico pair`, or set PICO_HOST_PORT.",
        }
      : { level: "ok", label: "Host port", detail: `${paths.host}:${paths.port} is free` },
    hasTailscale()
      ? { level: "ok", label: "Tailscale CLI", detail: "installed" }
      : { level: "fail", label: "Tailscale CLI", detail: "not found", fix: "Install Tailscale and sign in on this host." },
  ];

  if (hasTailscale()) {
    checks.push(
      tsStatus?.backendState === "Running" && tsStatus.dnsName
        ? { level: "ok", label: "Tailscale node", detail: `${tsStatus.dnsName}${tsStatus.ips.length ? ` (${tsStatus.ips.join(", ")})` : ""}` }
        : {
            level: "fail",
            label: "Tailscale node",
            detail: tsStatus?.backendState ? `state=${tsStatus.backendState}` : "not signed in or status unavailable",
            fix: "Run `tailscale up` and make sure this machine is in your tailnet.",
          },
      serveStatus?.includes(serveTarget)
        ? { level: "ok", label: "Tailscale Serve", detail: serveTarget }
        : {
            level: "warn",
            label: "Tailscale Serve",
            detail: `no route to ${serveTarget} detected`,
            fix: `pico pair will run: tailscale serve --bg --https=443 ${serveTarget}`,
          },
    );
  }

  checks.push(await tailscaleIdentityCheck({ portOpen, port: paths.port }));
  const hostProviderAuth = await hostProviderAuthCheck({ portOpen, port: paths.port });
  if (hostProviderAuth) checks.push(hostProviderAuth);
  checks.push(providerAuthSummary());
  return checks;
}

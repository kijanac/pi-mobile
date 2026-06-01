import { WebSocket as ReconnectingWS } from "partysocket";
import {
  decodeWireEvent,
  parseCommands,
  parseGitBranchesResponse,
  parseQueueState,
  parseSessionStats,
} from "@pi-mobile/protocol";
import type {
  AuthLoginJob,
  AuthProviders,
  BridgeUpdateStatus,
  ClientEvent,
  Commands,
  GitBranch,
  GitBranchesResponse,
  QueueState,
  SessionControls,
  SessionMeta,
  SessionStats,
  SessionTree,
  SystemInfo,
  WireEvent,
} from "@pi-mobile/protocol";

export type { CommandEntry, Commands } from "@pi-mobile/protocol";

export type GitBranchInfo = GitBranch;
export type GitBranchesResult = GitBranchesResponse;

export interface BridgeIdentity {
  readonly user?: string;
  readonly claimed: boolean;
}

export interface FsListing {
  path: string;
  parent: string | null;
  home: string;
  entries: Array<{ name: string; hidden: boolean }>;
}

export interface StreamHandlers {
  onOpen?: () => void;
  onClose?: (code: number, reason: string, terminal: boolean) => void;
  onError?: () => void;
  onEvent: (event: WireEvent) => void;
}

export interface StreamHandle {
  send: (event: ClientEvent) => void;
  reconnect: () => void;
  close: () => void;
}

export class BridgeHttpError extends Error {
  constructor(
    readonly label: string,
    readonly status: number,
    readonly responseMessage: string,
  ) {
    super(`${label} ${status}: ${responseMessage}`);
    this.name = "BridgeHttpError";
  }
}

const TERMINAL_CLOSE_CODES = new Set<number>([4004]);

type JsonObject = Record<string, unknown>;

async function readErrorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({ error: res.statusText }))) as JsonObject;
  const error = body.error;
  return typeof error === "string" ? error : "unknown";
}

async function requestJson<T>(label: string, input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new BridgeHttpError(label, res.status, await readErrorMessage(res));
  return (await res.json()) as T;
}

async function requestVoid(label: string, input: RequestInfo | URL, init?: RequestInit): Promise<void> {
  const res = await fetch(input, init);
  if (!res.ok) throw new BridgeHttpError(label, res.status, await readErrorMessage(res));
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function sessionUrl(baseUrl: string, id: string, suffix = ""): string {
  return `${baseUrl}/sessions/${encodeURIComponent(id)}${suffix}`;
}

function wsBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/^http/, "ws");
}

export class ApiClient {
  constructor(readonly baseUrl: string) {}

  async healthcheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/healthz`, {
        signal: AbortSignal.timeout(2500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  listSessions(opts?: { archived?: boolean }): Promise<SessionMeta[]> {
    const url = new URL(`${this.baseUrl}/sessions`);
    if (opts?.archived) url.searchParams.set("archived", "1");
    return requestJson("listSessions", url);
  }

  createSession(opts: { cwd: string; title: string; branch?: string }): Promise<SessionMeta> {
    return requestJson("createSession", `${this.baseUrl}/sessions`, jsonInit("POST", opts));
  }

  patchSession(id: string, patch: { title?: string; archived?: boolean }): Promise<SessionMeta> {
    return requestJson("patchSession", sessionUrl(this.baseUrl, id), jsonInit("PATCH", patch));
  }

  deleteSession(id: string): Promise<void> {
    return requestVoid("deleteSession", sessionUrl(this.baseUrl, id), { method: "DELETE" });
  }

  async listGitBranches(cwd: string): Promise<GitBranchesResult> {
    const url = new URL(`${this.baseUrl}/git/branches`);
    url.searchParams.set("cwd", cwd);
    return parseGitBranchesResponse(await requestJson("listGitBranches", url));
  }

  getSystemInfo(): Promise<SystemInfo> {
    return requestJson("getSystemInfo", `${this.baseUrl}/system/info`);
  }

  getBridgeIdentity(): Promise<BridgeIdentity> {
    return requestJson("getBridgeIdentity", `${this.baseUrl}/system/identity`);
  }

  getBridgeUpdateStatus(): Promise<BridgeUpdateStatus> {
    return requestJson("getBridgeUpdateStatus", `${this.baseUrl}/system/update`);
  }

  triggerBridgeUpdate(): Promise<BridgeUpdateStatus> {
    return requestJson("triggerBridgeUpdate", `${this.baseUrl}/system/update`, { method: "POST" });
  }

  claimBridge(): Promise<{ claimed: true; owner: string }> {
    return requestJson("claimBridge", `${this.baseUrl}/setup/claim`, { method: "POST" });
  }

  compactSession(id: string, instructions?: string): Promise<void> {
    return requestVoid(
      "compactSession",
      sessionUrl(this.baseUrl, id, "/compact"),
      jsonInit("POST", { instructions: instructions?.trim() || undefined }),
    );
  }

  sessionExportHtmlUrl(id: string): string {
    return sessionUrl(this.baseUrl, id, "/export.html");
  }

  async getSessionQueue(id: string): Promise<QueueState> {
    return parseQueueState(await requestJson("getSessionQueue", sessionUrl(this.baseUrl, id, "/queue")));
  }

  async clearSessionQueue(id: string): Promise<QueueState> {
    return parseQueueState(
      await requestJson("clearSessionQueue", sessionUrl(this.baseUrl, id, "/queue"), { method: "DELETE" }),
    );
  }

  listAuthProviders(): Promise<AuthProviders> {
    return requestJson("listAuthProviders", `${this.baseUrl}/providers`);
  }

  startAuthLogin(providerId: string): Promise<AuthLoginJob> {
    return requestJson(
      "startAuthLogin",
      `${this.baseUrl}/providers/${encodeURIComponent(providerId)}/login`,
      jsonInit("POST"),
    );
  }

  getAuthLoginJob(jobId: string): Promise<AuthLoginJob> {
    return requestJson("getAuthLoginJob", `${this.baseUrl}/provider-logins/${encodeURIComponent(jobId)}`);
  }

  submitAuthLoginInput(jobId: string, value: string): Promise<AuthLoginJob> {
    return requestJson(
      "submitAuthLoginInput",
      `${this.baseUrl}/provider-logins/${encodeURIComponent(jobId)}/input`,
      jsonInit("POST", { value }),
    );
  }

  cancelAuthLogin(jobId: string): Promise<void> {
    return requestVoid(
      "cancelAuthLogin",
      `${this.baseUrl}/provider-logins/${encodeURIComponent(jobId)}/cancel`,
      jsonInit("POST"),
    );
  }

  getSessionSettings(id: string): Promise<SessionControls> {
    return requestJson("getSessionSettings", sessionUrl(this.baseUrl, id, "/settings"));
  }

  patchSessionSetting(id: string, key: string, value: string | boolean): Promise<SessionControls> {
    return requestJson(
      "patchSessionSetting",
      sessionUrl(this.baseUrl, id, `/settings/${encodeURIComponent(key)}`),
      jsonInit("PATCH", { value }),
    );
  }

  async getSessionStats(id: string): Promise<SessionStats> {
    return parseSessionStats(await requestJson("getSessionStats", sessionUrl(this.baseUrl, id, "/stats")));
  }

  getSessionTree(id: string): Promise<SessionTree> {
    return requestJson("getSessionTree", sessionUrl(this.baseUrl, id, "/tree"));
  }

  navigateSessionTree(id: string, opts: { entryId: string; summarize?: boolean }): Promise<void> {
    return requestVoid("navigateSessionTree", sessionUrl(this.baseUrl, id, "/tree/jump"), jsonInit("POST", opts));
  }

  lsFs(path?: string): Promise<FsListing> {
    const url = new URL(`${this.baseUrl}/fs/ls`);
    if (path !== undefined) url.searchParams.set("path", path);
    return requestJson("lsFs", url);
  }

  async listCommands(sessionId?: string): Promise<Commands> {
    return parseCommands(
      await requestJson(
        "listCommands",
        sessionId === undefined
          ? `${this.baseUrl}/commands`
          : sessionUrl(this.baseUrl, sessionId, "/commands"),
      ),
    );
  }

  connectSessionStream(
    sessionId: string,
    cursor: number | (() => number),
    handlers: StreamHandlers,
  ): StreamHandle {
    const currentCursor = () => (typeof cursor === "function" ? cursor() : cursor);
    const url = () => `${wsBaseUrl(this.baseUrl)}/ws?session=${encodeURIComponent(sessionId)}&cursor=${currentCursor()}`;

    const ws = new ReconnectingWS(url, [], {
      minReconnectionDelay: 500,
      maxReconnectionDelay: 10_000,
      reconnectionDelayGrowFactor: 1.5,
      connectionTimeout: 5_000,
      maxRetries: Infinity,
    });

    ws.addEventListener("open", () => handlers.onOpen?.());
    ws.addEventListener("close", (event: CloseEvent) => {
      const terminal = TERMINAL_CLOSE_CODES.has(event.code);
      if (terminal) ws.close();
      handlers.onClose?.(event.code, event.reason, terminal);
    });
    ws.addEventListener("error", () => handlers.onError?.());
    ws.addEventListener("message", (event: MessageEvent<string>) => {
      try {
        const result = decodeWireEvent(JSON.parse(event.data));
        if (result.success) handlers.onEvent(result.output);
        else console.error("invalid wire event:", result.issues);
      } catch (error) {
        console.error("invalid wire event:", error);
      }
    });

    return {
      send: (event: ClientEvent) => ws.send(JSON.stringify(event)),
      reconnect: () => ws.reconnect(),
      close: () => ws.close(),
    };
  }
}

export const routePaths = {
  sessions: "/",
  session: (id: string) => `/s/${encodeURIComponent(id)}`,
  settings: "/settings",
  onboarding: "/onboarding",
  welcome: "/welcome",
} as const;

export type RouteId = "sessions" | "session" | "settings" | "onboarding" | "welcome" | "not-found";

export type RouteMatch =
  | { id: "sessions"; params: Record<string, never> }
  | { id: "session"; params: { id: string } }
  | { id: "settings"; params: Record<string, never> }
  | { id: "onboarding"; params: Record<string, never> }
  | { id: "welcome"; params: Record<string, never> }
  | { id: "not-found"; params: { path: string } };

export function currentPath(): string {
  return window.location.pathname || "/";
}

export function matchRoute(path: string): RouteMatch {
  if (path === "/") return { id: "sessions", params: {} };
  if (path === "/settings") return { id: "settings", params: {} };
  if (path === "/onboarding") return { id: "onboarding", params: {} };
  if (path === "/welcome") return { id: "welcome", params: {} };

  const sessionMatch = /^\/s\/([^/]+)$/.exec(path);
  if (sessionMatch) {
    return {
      id: "session",
      params: { id: decodeURIComponent(sessionMatch[1] ?? "") },
    };
  }

  return { id: "not-found", params: { path } };
}

/**
 * push/pop pick the screen transition direction; replace swaps instantly
 * (e.g. finishing onboarding); swipe means a gesture already animated the
 * change, so the transition layer must not animate again.
 */
export type NavKind = "push" | "pop" | "replace" | "swipe";

let pendingNavKind: NavKind | null = null;

/** One-shot: a popstate with no recorded kind is a real browser/system back. */
export function consumeNavKind(): NavKind {
  const kind = pendingNavKind ?? "pop";
  pendingNavKind = null;
  return kind;
}

export function navigateTo(path: string, kind: NavKind = "push"): void {
  if (window.location.pathname === path) return;
  pendingNavKind = kind;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

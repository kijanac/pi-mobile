export const routePaths = {
  sessions: "/",
  session: (id: string) => `/s/${encodeURIComponent(id)}`,
  settings: "/settings",
  onboarding: "/onboarding",
} as const;

export type RouteId = "sessions" | "session" | "settings" | "onboarding" | "not-found";

export type RouteMatch =
  | { id: "sessions"; params: Record<string, never> }
  | { id: "session"; params: { id: string } }
  | { id: "settings"; params: Record<string, never> }
  | { id: "onboarding"; params: Record<string, never> }
  | { id: "not-found"; params: { path: string } };

export function currentPath(): string {
  return window.location.pathname || "/";
}

export function matchRoute(path: string): RouteMatch {
  if (path === "/") return { id: "sessions", params: {} };
  if (path === "/settings") return { id: "settings", params: {} };
  if (path === "/onboarding") return { id: "onboarding", params: {} };

  const sessionMatch = /^\/s\/([^/]+)$/.exec(path);
  if (sessionMatch) {
    return {
      id: "session",
      params: { id: decodeURIComponent(sessionMatch[1] ?? "") },
    };
  }

  return { id: "not-found", params: { path } };
}

export function navigateTo(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

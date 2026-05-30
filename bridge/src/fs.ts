import { readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve as resolvePath } from "node:path";
import type { Context } from "hono";
import { WORKSPACES_DIR } from "./config.ts";

const workspaceRoot = () => resolvePath(WORKSPACES_DIR);

const isInsideRoot = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

export function handleFsLs(c: Context) {
  const raw = c.req.query("path");
  const showHidden = c.req.query("hidden") === "1";

  let root: string;
  let target: string;
  try {
    root = realpathSync(workspaceRoot());
    target = raw ? resolvePath(raw) : root;
    target = realpathSync(target);
  } catch {
    return c.json({ error: "not_found" }, 404);
  }

  if (!isInsideRoot(root, target)) {
    return c.json({ error: "outside_workspace_root", root }, 403);
  }

  let entries: string[];
  try {
    entries = readdirSync(target);
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return c.json({ error: "not_found" }, 404);
    if (code === "EACCES" || code === "EPERM") {
      return c.json({ error: "forbidden" }, 403);
    }
    return c.json({ error: "ls_failed", detail: String(e) }, 500);
  }

  const dirs: Array<{ name: string; hidden: boolean }> = [];
  for (const name of entries) {
    if (!showHidden && name.startsWith(".")) continue;
    try {
      const child = join(target, name);
      const childReal = realpathSync(child);
      if (!isInsideRoot(root, childReal)) continue;

      const st = statSync(childReal);
      if (st.isDirectory()) {
        dirs.push({ name, hidden: name.startsWith(".") });
      }
    } catch {
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));

  const parent = (() => {
    if (target === root) return null;
    const p = dirname(target);
    return isInsideRoot(root, p) ? p : null;
  })();

  return c.json({ path: target, parent, home: root, entries: dirs });
}

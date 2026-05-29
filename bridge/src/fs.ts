import { readdirSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath, sep as PATH_SEP } from "node:path";
import { homedir } from "node:os";
import type { Context } from "hono";

export function handleFsLs(c: Context) {
  const raw = c.req.query("path");
  const showHidden = c.req.query("hidden") === "1";

  let target: string;
  try {
    target = raw
      ? resolvePath(raw)
      : resolvePath(process.env.PI_WORKSPACES_DIR ?? homedir());
  } catch {
    return c.json({ error: "invalid_path" }, 400);
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
      const st = statSync(`${target}${PATH_SEP}${name}`);
      if (st.isDirectory()) {
        dirs.push({ name, hidden: name.startsWith(".") });
      }
    } catch {
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));

  const parent = (() => {
    const p = dirname(target);
    return p === target ? null : p;
  })();

  return c.json({ path: target, parent, home: homedir(), entries: dirs });
}

import { createResource, For, Show } from "solid-js";
import { diffLines } from "diff";
import { highlightLines, inferLangFromPath } from "@/lib/highlighter";
import type { EditToolArgs } from "@pi-mobile/protocol";


interface Segment {
  oldText: string;
  newText: string;
}

function normalize(args: EditToolArgs): {
  path: string;
  segments: Segment[];
} {
  return {
    path: args.path,
    segments: args.edits.filter(
      (s) => s.oldText.length > 0 || s.newText.length > 0,
    ),
  };
}


type LineKind = "add" | "remove" | "context";

interface DiffLine {
  kind: LineKind;
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

function toDiffLines(oldText: string, newText: string): DiffLine[] {
  const chunks = diffLines(oldText, newText);
  const out: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;

  for (const chunk of chunks) {
    const lines = chunk.value.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
    const kind: LineKind = chunk.added
      ? "add"
      : chunk.removed
        ? "remove"
        : "context";

    for (const text of lines) {
      if (kind === "add") {
        newNo += 1;
        out.push({ kind, oldLine: null, newLine: newNo, text });
      } else if (kind === "remove") {
        oldNo += 1;
        out.push({ kind, oldLine: oldNo, newLine: null, text });
      } else {
        oldNo += 1;
        newNo += 1;
        out.push({ kind, oldLine: oldNo, newLine: newNo, text });
      }
    }
  }
  return out;
}

const CONTEXT_LINES = 3;

interface CollapsedSegment {
  kind: "hunk" | "skip";
  lines?: DiffLine[];
  skipped?: number;
}

function collapseContext(lines: DiffLine[]): CollapsedSegment[] {
  const changedIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].kind !== "context") changedIdx.push(i);
  }
  if (changedIdx.length === 0) {
    return [{ kind: "hunk", lines }];
  }

  const ranges: Array<[number, number]> = changedIdx.map((i) => [
    Math.max(0, i - CONTEXT_LINES),
    Math.min(lines.length - 1, i + CONTEXT_LINES),
  ]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], r[1]);
    } else {
      merged.push([r[0], r[1]]);
    }
  }

  const result: CollapsedSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      result.push({ kind: "skip", skipped: start - cursor });
    }
    result.push({ kind: "hunk", lines: lines.slice(start, end + 1) });
    cursor = end + 1;
  }
  if (cursor < lines.length) {
    result.push({ kind: "skip", skipped: lines.length - cursor });
  }
  return result;
}


interface Props {
  args: EditToolArgs;
}

export default function EditDiff(props: Props) {
  const normalized = () => normalize(props.args);

  return (
    <div class="space-y-2">
      <For each={normalized().segments}>
        {(seg) => (
          <SegmentView
            oldText={seg.oldText}
            newText={seg.newText}
            path={normalized().path}
          />
        )}
      </For>
      <Show when={normalized().segments.length === 0}>
        <div class="text-[11px] text-[color:var(--color-fg-faint)] italic">
          waiting for edit args…
        </div>
      </Show>
    </div>
  );
}

function SegmentView(props: {
  oldText: string;
  newText: string;
  path: string;
}) {
  const lang = () => inferLangFromPath(props.path);
  const lines = () => toDiffLines(props.oldText, props.newText);

  const [highlighted] = createResource(
    () => ({ old: props.oldText, neu: props.newText, lang: lang() }),
    async ({ old, neu, lang: l }) => {
      if (!l) return null;
      const [oldLines, newLines] = await Promise.all([
        highlightLines(old, l),
        highlightLines(neu, l),
      ]);
      if (!oldLines || !newLines) return null;
      return { old: oldLines, neu: newLines };
    },
  );

  const segments = () => collapseContext(lines());

  return (
    <div class="overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] font-mono text-[11.5px] leading-[1.55]">
      <For each={segments()}>
        {(seg) => (
          <Show
            when={seg.kind === "hunk"}
            fallback={
              <div class="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[10px] text-[color:var(--color-fg-faint)]">
                … {seg.skipped} unchanged
              </div>
            }
          >
            <For each={seg.lines!}>
              {(line) => <DiffLineRow line={line} highlighted={highlighted()} />}
            </For>
          </Show>
        )}
      </For>
    </div>
  );
}

function DiffLineRow(props: {
  line: DiffLine;
  highlighted: { old: string[]; neu: string[] } | null | undefined;
}) {
  const tone = () => {
    switch (props.line.kind) {
      case "add":
        return {
          bg: "bg-[color:var(--color-diff-add-bg)]",
          gutter: "+",
          gutterColor: "text-[color:var(--color-diff-add)]",
        };
      case "remove":
        return {
          bg: "bg-[color:var(--color-diff-remove-bg)]",
          gutter: "-",
          gutterColor: "text-[color:var(--color-diff-remove)]",
        };
      default:
        return { bg: "", gutter: " ", gutterColor: "text-[color:var(--color-fg-faint)]" };
    }
  };

  const content = () => {
    const hl = props.highlighted;
    if (hl) {
      if (props.line.kind === "remove" && props.line.oldLine !== null) {
        return hl.old[props.line.oldLine - 1] ?? null;
      }
      if (props.line.kind === "add" && props.line.newLine !== null) {
        return hl.neu[props.line.newLine - 1] ?? null;
      }
      if (props.line.kind === "context" && props.line.newLine !== null) {
        return hl.neu[props.line.newLine - 1] ?? null;
      }
    }
    return null;
  };

  return (
    <div class={`flex items-start gap-1 px-1 ${tone().bg}`}>
      <span
        class={`shrink-0 select-none w-3 text-center tabular-nums ${tone().gutterColor}`}
        aria-hidden="true"
      >
        {tone().gutter}
      </span>
      <Show
        when={content()}
        fallback={
          <span class="min-w-0 flex-1 whitespace-pre-wrap break-words text-[color:var(--color-fg)]">
            {props.line.text || " "}
          </span>
        }
      >
        <span
          class="min-w-0 flex-1 whitespace-pre-wrap break-words"
          // eslint-disable-next-line solid/no-innerhtml
          innerHTML={content() || "&nbsp;"}
        />
      </Show>
    </div>
  );
}

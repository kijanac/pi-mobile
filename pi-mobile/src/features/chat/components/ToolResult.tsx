import {
  createResource,
  createMemo,
  Show,
} from "solid-js";
import Anser from "anser";
import type { ToolCallMessage } from "@pi-mobile/protocol";
import { highlightToHtml, inferLangFromPath } from "@/lib/highlighter";


const BASH_CLASS =
  "mt-1 overflow-x-auto rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[#0d1117] p-2 font-mono text-[11px] leading-[1.5] text-[#e6edf3] whitespace-pre-wrap break-words";

const CODE_BLOCK_CLASS =
  "code-wrap mt-1 overflow-x-auto rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-2 text-[11px] leading-[1.5]";

const RAW_CLASS =
  "mt-1 overflow-x-auto rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-2 text-[11px] leading-[1.5] text-[color:var(--color-fg-muted)] whitespace-pre-wrap break-words";


function BashResult(props: { result: string }) {
  const html = createMemo(() => {
    const escaped = Anser.escapeForHtml(props.result);
    return Anser.ansiToHtml(escaped, { use_classes: false });
  });
  // eslint-disable-next-line solid/no-innerhtml
  return <pre class={BASH_CLASS} innerHTML={html()} />;
}


function HighlightedResult(props: {
  text: string;
  path: string;
}) {
  const lang = createMemo(() => inferLangFromPath(props.path));

  const [html] = createResource(
    () => ({ text: props.text, lang: lang() }),
    async ({ text, lang }) => {
      if (!text) return null;
      try {
        return await highlightToHtml(text, lang);
      } catch (e) {
        console.warn("[tool-result] highlight failed:", e);
        return null;
      }
    },
  );

  return (
    <Show
      when={html()}
      fallback={<pre class={RAW_CLASS}>{props.text}</pre>}
    >
      <div
        class={CODE_BLOCK_CLASS}
        // eslint-disable-next-line solid/no-innerhtml
        innerHTML={html() ?? ""}
      />
    </Show>
  );
}


function RawResult(props: { text: string }) {
  return <pre class={RAW_CLASS}>{props.text}</pre>;
}

function unwrapContentEnvelope(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return text;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && "content" in parsed) {
      const content = parsed.content;
      if (Array.isArray(content)) {
        const parts = content
          .map((part) => {
            if (typeof part === "string") return part;
            if (part && typeof part === "object" && "text" in part) {
              return typeof part.text === "string" ? part.text : "";
            }
            return "";
          })
          .filter(Boolean);
        if (parts.length > 0) return parts.join("\n");
      }
    }
  } catch {
  }

  return text;
}


export default function ToolResult(props: {
  msg: ToolCallMessage;
}) {
  const isError = () => props.msg.status === "error";
  const result = () => unwrapContentEnvelope(props.msg.result ?? "");

  return (
    <Show when={!isError()} fallback={<RawResult text={result()} />}>
      <ToolResultContent msg={props.msg} result={result()} />
    </Show>
  );
}

function ToolResultContent(props: {
  msg: ToolCallMessage;
  result: string;
}) {
  if (props.msg.toolKind === "custom") {
    return <RawResult text={props.result} />;
  }

  switch (props.msg.tool) {
    case "bash":
      return <BashResult result={props.result} />;
    case "read":
      return <HighlightedResult text={props.result} path={props.msg.args.path} />;
    case "write":
      return (
        <HighlightedResult
          text={props.msg.args.content || props.result}
          path={props.msg.args.path}
        />
      );
    case "edit":
      return <RawResult text={props.result} />;
  }
}

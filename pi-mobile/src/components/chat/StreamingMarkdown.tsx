import { onMount, onCleanup, createEffect, type JSX } from "solid-js";
import * as smd from "streaming-markdown";
import { highlightToHtml } from "~/lib/highlighter";

/**
 * Incremental markdown renderer with Shiki-highlighted fenced code blocks.
 *
 * Backed by thetarnav/streaming-markdown (3KB, framework-agnostic). The
 * parser patches the DOM directly as chunks arrive; we don't re-parse
 * accumulated text on every update.
 *
 * Code fence strategy:
 *   - While a ```fence is open, text streams into the default <pre><code>
 *     as plain text (unhighlighted). User sees it scroll in immediately.
 *   - When end_token fires for the fence, we kick off an async Shiki
 *     highlight and swap the <pre> for a highlighted one when ready.
 *   - If Shiki doesn't know the language (or anything fails), the plain
 *     block is left in place.
 *
 * Re-highlighting per chunk would be expensive and visually janky; the
 * "stream plain, swap on close" pattern matches pi-tool-display's
 * approach in the TUI and is what shiki-stream's docs recommend.
 *
 * State:
 *   - parser instance bound to the root <div>
 *   - fedLen — how many chars we've passed to the parser
 *   - on text rewind (route remount + replay), destroy and re-create
 */
interface Props {
  text: string;
  done?: boolean;
  class?: string;
}

interface ActiveFence {
  preEl: HTMLPreElement;
  codeEl: HTMLElement;
  buffer: string;
  lang: string | null;
}

/**
 * Build a streaming-markdown renderer that delegates to the default
 * renderer for everything but code fences, where we capture the buffered
 * source and language, then async-highlight after the fence closes.
 */
function makeRenderer(root: HTMLElement) {
  const def = smd.default_renderer(root);

  // Track open token types as a stack so end_token (which only receives
  // `data`, no type) can know which token is closing.
  const stack: number[] = [];
  let active: ActiveFence | null = null;

  return {
    data: def.data,

    add_token(data: typeof def.data, type: smd.Token) {
      smd.default_add_token(data, type);
      stack.push(type);

      // CODE_FENCE only — indented CODE_BLOCK doesn't carry a language
      // and is rarer in agent output. After default_add_token, the
      // current slot is the <code> element; its parent is the <pre>.
      if (type === smd.CODE_FENCE) {
        const codeEl = data.nodes[data.index] as HTMLElement;
        const preEl = codeEl.parentElement as HTMLPreElement;
        active = { preEl, codeEl, buffer: "", lang: null };
      }
    },

    end_token(data: typeof def.data) {
      const finished = stack.pop();
      smd.default_end_token(data);

      if (finished === smd.CODE_FENCE && active) {
        const fence = active;
        active = null;
        // Fire-and-forget. If the user navigates away before we resolve,
        // the swap is a no-op (the pre is no longer in the document).
        void (async () => {
          const html = await highlightToHtml(fence.buffer, fence.lang);
          if (!html) return;
          if (!fence.preEl.isConnected) return;
          const wrapper = document.createElement("div");
          wrapper.innerHTML = html;
          const newPre = wrapper.firstElementChild as HTMLElement | null;
          if (newPre) fence.preEl.replaceWith(newPre);
        })();
      }
    },

    add_text(data: typeof def.data, text: string) {
      smd.default_add_text(data, text);
      if (active && stack[stack.length - 1] === smd.CODE_FENCE) {
        active.buffer += text;
      }
    },

    set_attr(data: typeof def.data, type: smd.Attr, value: string) {
      smd.default_set_attr(data, type, value);
      if (active && type === smd.LANG) {
        active.lang = value;
      }
    },
  };
}

export default function StreamingMarkdown(props: Props): JSX.Element {
  let root!: HTMLDivElement;
  let parser: ReturnType<typeof smd.parser> | null = null;
  let fedLen = 0;
  let ended = false;

  const reset = () => {
    root.innerHTML = "";
    parser = smd.parser(makeRenderer(root));
    fedLen = 0;
    ended = false;
  };

  onMount(() => {
    reset();
    if (props.text.length > 0) {
      smd.parser_write(parser!, props.text);
      fedLen = props.text.length;
    }
  });

  createEffect(() => {
    const text = props.text;
    if (!parser) return;

    if (text.length < fedLen) {
      // Rewind (route remount + replay). Recreate parser, re-feed.
      reset();
    }

    if (text.length > fedLen) {
      smd.parser_write(parser, text.slice(fedLen));
      fedLen = text.length;
    }

    if (props.done && !ended) {
      smd.parser_end(parser);
      ended = true;
    }
  });

  onCleanup(() => {
    if (parser && !ended) {
      smd.parser_end(parser);
      ended = true;
    }
  });

  return <div ref={root} class={`streaming-md ${props.class ?? ""}`} />;
}

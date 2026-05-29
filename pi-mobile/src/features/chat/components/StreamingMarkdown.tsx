import { onMount, onCleanup, createEffect } from "solid-js";
import * as smd from "streaming-markdown";
import { highlightToHtml } from "@/lib/highlighter";

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

function makeRenderer(root: HTMLElement) {
  const def = smd.default_renderer(root);

  const stack: number[] = [];
  let active: ActiveFence | null = null;

  return {
    data: def.data,

    add_token(data: typeof def.data, type: smd.Token) {
      smd.default_add_token(data, type);
      stack.push(type);

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

export default function StreamingMarkdown(props: Props) {
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

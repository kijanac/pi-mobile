<script lang="ts">
  import type { ComponentProps, Snippet } from "svelte";
  import Content from "./sheet-content.svelte";
  import { cn } from "@/shared/lib/utils";

  let {
    children,
    class: className,
    style,
    ...restProps
  }: ComponentProps<typeof Content> & { children: Snippet } = $props();

  const keyboardSafePadding = "padding-bottom: calc(env(safe-area-inset-bottom) + var(--keyboard-bottom-inset, 0px) + 0.5rem)";
</script>

<Content
  side="bottom"
  class={cn(
    "flex flex-col gap-0 overflow-hidden rounded-t-[12px] border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] p-0 text-[color:var(--color-fg)] shadow-none",
    className,
  )}
  style={style ? `${keyboardSafePadding}; ${style}` : keyboardSafePadding}
  {...restProps}
>
  {@render children()}
</Content>

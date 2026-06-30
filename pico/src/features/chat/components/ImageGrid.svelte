<script lang="ts">
  import type { ImageContent } from "@pico/protocol";
  import { imageDataUrl } from "@/shared/mobile/image-content";

  let {
    images,
    altPrefix = "image",
    imageClass = "max-h-44 min-h-20",
    class: className = "",
  }: {
    images: readonly ImageContent[];
    altPrefix?: string;
    imageClass?: string;
    class?: string;
  } = $props();
</script>

{#if images.length > 0}
  <div class={`grid gap-1 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${className}`}>
    {#each images as image, index}
      <img src={imageDataUrl(image)} alt={`${altPrefix} ${index + 1}`} class={`${imageClass} w-full rounded-[var(--radius-sm)] object-cover`} />
    {/each}
  </div>
{/if}

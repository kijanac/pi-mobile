<script lang="ts">
  let { children } = $props();
</script>

<div
  class="min-h-dvh bg-[color:var(--color-bg)] text-[color:var(--color-fg)] antialiased"
  data-mobile-viewport
>
  <div class="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col overflow-hidden" data-app-frame>
    {@render children?.()}
  </div>
</div>

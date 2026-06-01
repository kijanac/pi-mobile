<script lang="ts">
  import { navigateTo, routePaths } from "@/app/routes";
  import { Button } from "@/shared/ui/button";
</script>

<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
  <div class="mb-3">
    <h2 class="text-[13px] font-medium text-[color:var(--color-fg)]">guided bridge onboarding</h2>
    <p class="mt-1 text-[11px] leading-relaxed text-[color:var(--color-fg-faint)]">
      generate cloud-init, provision a fresh box, then let pi-mobile wait for and claim the bridge.
    </p>
  </div>
  <Button type="button" class="h-10 w-full" onclick={() => navigateTo(routePaths.onboarding)}>
    start onboarding
  </Button>
</section>

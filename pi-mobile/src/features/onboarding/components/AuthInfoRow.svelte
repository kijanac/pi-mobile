<script lang="ts">
  let { label, value }: { label: string; value: string } = $props();
</script>

<div class="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-2 py-1.5">
  <span class="label">{label}</span>
  <span class="truncate text-[color:var(--color-fg-muted)]">{value}</span>
</div>

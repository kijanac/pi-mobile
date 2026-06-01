<script lang="ts">
  import { Input } from "@/shared/ui/input";

  let {
    id,
    label,
    value = $bindable(""),
    placeholder,
    secret = false,
  }: {
    id: string;
    label: string;
    value: string;
    placeholder: string;
    secret?: boolean;
  } = $props();
</script>

<div>
  <label class="label mb-1.5 block" for={id}>{label}</label>
  <Input
    {id}
    type={secret ? "password" : "text"}
    autocapitalize="none"
    autocorrect="off"
    spellcheck={false}
    bind:value
    {placeholder}
    class="bg-[color:var(--color-bg)] text-[12px]"
  />
</div>

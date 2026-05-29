import { Show, createResource, createSignal } from "solid-js";
import type { QueueMode, SessionSettings, ThinkingLevel } from "@pi-mobile/protocol";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const satisfies readonly ThinkingLevel[];
const QUEUE_MODES = ["one-at-a-time", "all"] as const satisfies readonly QueueMode[];
import { getSessionSettings, patchSessionSettings } from "@/lib/api";
import { getBridgeUrl } from "@/lib/settings";
import { haptic } from "@/lib/haptics";
import { Segmented, ToggleRow } from "./shared";
import type { ActionErrorHandler } from "./types";

export default function SessionSettingsView(props: { sessionId: string; onError: ActionErrorHandler }) {
  const [saving, setSaving] = createSignal<string | null>(null);
  const [settings, { refetch, mutate }] = createResource(async () => {
    const baseUrl = await getBridgeUrl();
    return getSessionSettings(baseUrl, props.sessionId);
  });

  async function patch(key: keyof SessionSettings, value: ThinkingLevel | QueueMode | boolean) {
    if (saving()) return;
    setSaving(String(key));
    props.onError(null);
    try {
      const baseUrl = await getBridgeUrl();
      const next = await patchSessionSettings(baseUrl, props.sessionId, { [key]: value });
      mutate(next);
      haptic.success();
    } catch (e) {
      props.onError(String(e));
      await refetch();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div class="flex-1 overflow-y-auto px-3 py-3">
      <Show when={settings.loading}><div class="text-[12px] text-[color:var(--color-fg-faint)]">loading settings…</div></Show>
      <Show when={settings()}>
        {(s) => (
          <div class="space-y-4">
            <Segmented label="thinking level" options={s().availableThinkingLevels.length ? s().availableThinkingLevels : THINKING_LEVELS} value={s().thinkingLevel} disabled={saving() !== null} onChange={(v) => patch("thinkingLevel", v)} />
            <Segmented label="steering while running" options={QUEUE_MODES} value={s().steeringMode} disabled={saving() !== null} onChange={(v) => patch("steeringMode", v)} />
            <Segmented label="follow-up delivery" options={QUEUE_MODES} value={s().followUpMode} disabled={saving() !== null} onChange={(v) => patch("followUpMode", v)} />
            <ToggleRow label="auto compact" checked={s().autoCompaction} disabled={saving() !== null} onChange={(v) => patch("autoCompaction", v)} />
            <ToggleRow label="auto retry" checked={s().autoRetry} disabled={saving() !== null} onChange={(v) => patch("autoRetry", v)} />
          </div>
        )}
      </Show>
    </div>
  );
}

import { PRODUCT_VERSION, PROTOCOL_VERSION } from "@pi-mobile/protocol";
import { claimBridgeForUrl, getBridgeIdentityForUrl, getBridgeUpdateStatusForUrl, getSystemInfoForUrl, healthcheckBridgeUrl, triggerBridgeUpdateForUrl, type BridgeIdentity, type BridgeUpdateStatus, type SystemInfo } from "@/features/settings/api";
import { settingsState } from "@/features/settings/settings.state.svelte";

export type BridgeProbeState = "idle" | "checking" | "ok" | "fail";
export type BridgeCompatibility = { level: "ok" | "warn" | "danger"; text: string };

export interface BridgeConnectionState {
  readonly saved: boolean;
  readonly probe: BridgeProbeState;
  readonly systemInfo: SystemInfo | null;
  readonly systemInfoError: string | null;
  readonly bridgeIdentity: BridgeIdentity | null;
  readonly bridgeUpdateStatus: BridgeUpdateStatus | null;
  readonly bridgeUpdateMessage: string | null;
  readonly bridgeUpdateBusy: boolean;
  readonly compatibility: BridgeCompatibility | null;
  resetForUrlInput(): void;
  test(url: string): Promise<void>;
  save(url: string): Promise<void>;
  updateBridgeNow(url: string): Promise<void>;
}

export function createBridgeConnectionState(): BridgeConnectionState {
  let saved = $state(false);
  let probe = $state<BridgeProbeState>("idle");
  let systemInfo = $state<SystemInfo | null>(null);
  let systemInfoError = $state<string | null>(null);
  let bridgeIdentity = $state<BridgeIdentity | null>(null);
  let bridgeUpdateStatus = $state<BridgeUpdateStatus | null>(null);
  let bridgeUpdateMessage = $state<string | null>(null);
  let bridgeUpdateBusy = $state(false);

  const compatibility = $derived.by<BridgeCompatibility | null>(() => {
    if (!systemInfo) return null;
    if (systemInfo.protocolVersion !== PROTOCOL_VERSION) {
      return {
        level: "danger",
        text: `protocol mismatch: mobile ${PROTOCOL_VERSION}, bridge ${systemInfo.protocolVersion}`,
      };
    }
    if (compareVersion(PRODUCT_VERSION, systemInfo.minMobileVersion) < 0) {
      return {
        level: "danger",
        text: `mobile ${PRODUCT_VERSION} is too old for this bridge`,
      };
    }
    if (compareVersion(PRODUCT_VERSION, systemInfo.recommendedMobileVersion) < 0) {
      return {
        level: "warn",
        text: `mobile update recommended: ${systemInfo.recommendedMobileVersion}`,
      };
    }
    return { level: "ok", text: "compatible" };
  });

  function clearProbeDetails(): void {
    systemInfo = null;
    systemInfoError = null;
    bridgeIdentity = null;
    bridgeUpdateStatus = null;
    bridgeUpdateMessage = null;
  }

  async function test(url: string): Promise<void> {
    probe = "checking";
    clearProbeDetails();

    const ok = await healthcheckBridgeUrl(url);
    probe = ok ? "ok" : "fail";
    if (!ok) return;

    try {
      systemInfo = await getSystemInfoForUrl(url);
      bridgeUpdateStatus = await getBridgeUpdateStatusForUrl(url);
      const identity = await getBridgeIdentityForUrl(url);
      bridgeIdentity = identity.claimed ? identity : await claimBridgeForUrl(url);
    } catch (error) {
      systemInfoError = error instanceof Error ? error.message : String(error);
    }
  }

  async function save(url: string): Promise<void> {
    await settingsState.setBridgeUrl(url);
    saved = true;
    window.setTimeout(() => {
      saved = false;
    }, 1200);
  }

  async function updateBridgeNow(url: string): Promise<void> {
    if (bridgeUpdateBusy) return;
    bridgeUpdateBusy = true;
    bridgeUpdateMessage = null;
    try {
      bridgeUpdateStatus = await triggerBridgeUpdateForUrl(url);
      bridgeUpdateMessage = "bridge update requested; it may restart if a newer release is available";
    } catch (error) {
      bridgeUpdateMessage = String(error);
    } finally {
      bridgeUpdateBusy = false;
    }
  }

  function resetForUrlInput(): void {
    probe = "idle";
    saved = false;
    clearProbeDetails();
  }

  return {
    get saved() {
      return saved;
    },
    get probe() {
      return probe;
    },
    get systemInfo() {
      return systemInfo;
    },
    get systemInfoError() {
      return systemInfoError;
    },
    get bridgeIdentity() {
      return bridgeIdentity;
    },
    get bridgeUpdateStatus() {
      return bridgeUpdateStatus;
    },
    get bridgeUpdateMessage() {
      return bridgeUpdateMessage;
    },
    get bridgeUpdateBusy() {
      return bridgeUpdateBusy;
    },
    get compatibility() {
      return compatibility;
    },
    resetForUrlInput,
    test,
    save,
    updateBridgeNow,
  };
}

function compareVersion(a: string, b: string): number {
  const aa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const bb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let index = 0; index < Math.max(aa.length, bb.length); index += 1) {
    const diff = (aa[index] ?? 0) - (bb[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

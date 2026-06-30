import type { ImageContent, SendMode } from "@pico/protocol";
import { cloneImageContent } from "@/shared/mobile/image-content";

interface RecallRequest {
  id: number;
  hostId: string;
  sessionId: string;
  text: string;
  images?: ImageContent[];
  mode: SendMode;
}

let recallCounter = 0;
let recallRequest = $state<RecallRequest | null>(null);

export const queuedMessageActionsState = {
  get recallRequest() {
    return recallRequest;
  },

  recall(hostId: string, sessionId: string, text: string, mode: SendMode, images?: readonly ImageContent[]): void {
    recallRequest = {
      id: ++recallCounter,
      hostId,
      sessionId,
      text,
      images: cloneImageContent(images),
      mode,
    };
  },
};

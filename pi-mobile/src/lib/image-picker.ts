import {
  Camera,
  MediaTypeSelection,
  type MediaResult,
} from "@capacitor/camera";
import type { ImageAttachment } from "@pi-mobile/protocol";


interface PickOptions {
  limit?: number;
}

export async function chooseFromGallery(
  opts?: PickOptions,
): Promise<ImageAttachment[]> {
  const limit = opts?.limit ?? 4;
  try {
    const { results } = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: limit > 1,
      ...(limit > 1 ? { limit } : {}),
    });
    const attachments: ImageAttachment[] = [];
    for (const r of results) {
      const a = await mediaResultToAttachment(r);
      if (a) attachments.push(a);
    }
    return attachments;
  } catch (e) {
    if (isUserCancelled(e)) return [];
    console.warn("[image-picker] chooseFromGallery failed:", e);
    throw e;
  }
}


async function mediaResultToAttachment(
  r: MediaResult,
): Promise<ImageAttachment | null> {
  const url = r.webPath ?? r.uri;
  if (!url) {
    console.warn("[image-picker] no webPath or uri on result");
    return null;
  }
  const res = await fetch(url);
  const blob = await res.blob();
  const data = await blobToBase64(blob);
  return {
    data,
    mimeType: blob.type || "image/jpeg",
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader produced non-string result"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function isUserCancelled(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return (
    msg.includes("cancel") ||
    msg.includes("dismiss") ||
    msg.includes("no image picked")
  );
}

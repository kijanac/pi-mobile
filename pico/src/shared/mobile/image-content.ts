import type { ImageContent } from "@pico/protocol";

const MAX_IMAGE_SIDE = 1600;
const OUTPUT_MIME = "image/jpeg";
const OUTPUT_QUALITY = 0.84;

export function cloneImageContent(images: readonly ImageContent[] | undefined): ImageContent[] | undefined {
  return images && images.length > 0
    ? images.map((image) => ({ type: "image", data: image.data, mimeType: image.mimeType }))
    : undefined;
}

export function imageDataUrl(image: ImageContent): string {
  return `data:${image.mimeType};base64,${image.data}`;
}

export async function blobToImageContent(blob: Blob): Promise<ImageContent> {
  const normalized = await normalizeImageBlob(blob).catch(() => blob);
  return {
    type: "image",
    data: await blobToBase64(normalized),
    mimeType: normalized.type || blob.type || OUTPUT_MIME,
  };
}

export async function filesToImageContent(files: readonly File[], limit: number): Promise<ImageContent[]> {
  const images: ImageContent[] = [];
  for (const file of files) {
    if (images.length >= limit) break;
    if (!file.type.startsWith("image/")) continue;
    images.push(await blobToImageContent(file));
  }
  return images;
}

async function normalizeImageBlob(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("image/")) throw new Error("not an image");

  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas context unavailable");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await canvasToBlob(canvas, OUTPUT_MIME, OUTPUT_QUALITY);
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("image encode failed"));
    }, type, quality);
  });
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

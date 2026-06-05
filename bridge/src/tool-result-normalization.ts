import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import type { ToolResultContent } from "@pico/protocol";

type SupportedToolResultContent = TextContent | ImageContent;

type ToolResultEnvelope = {
  content?: unknown;
  details?: unknown;
};

export type NormalizedToolResult = {
  text: string;
  content?: ToolResultContent[];
  details?: unknown;
};

const MAX_DETAILS_DEPTH = 8;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isTextContent = (value: unknown): value is TextContent =>
  isRecord(value) && value.type === "text" && typeof value.text === "string";

const isImageContent = (value: unknown): value is ImageContent =>
  isRecord(value) &&
  value.type === "image" &&
  typeof value.data === "string" &&
  typeof value.mimeType === "string";

const isSupportedToolResultContent = (value: unknown): value is SupportedToolResultContent =>
  isTextContent(value) || isImageContent(value);

const asToolResultEnvelope = (result: unknown): ToolResultEnvelope | undefined =>
  isRecord(result) ? result : undefined;

const toProtocolContent = (part: SupportedToolResultContent): ToolResultContent => {
  if (part.type === "text") return { type: "text", text: part.text };
  return { type: "image", data: part.data, mimeType: part.mimeType };
};

const toJsonSafe = (value: unknown, seen = new WeakSet<object>(), depth = 0): unknown => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (!isRecord(value)) return undefined;
  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_DETAILS_DEPTH) return "[MaxDepth]";

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item, seen, depth + 1) ?? null);
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const safe = toJsonSafe(entry, seen, depth + 1);
      return safe === undefined ? [] : [[key, safe]];
    }),
  );
};

const stringifyFallback = (result: unknown): string => {
  if (result == null) return "";
  if (typeof result === "string") return result;

  try {
    return JSON.stringify(toJsonSafe(result));
  } catch {
    return String(result);
  }
};

export const textFromContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (isTextContent(part)) return part.text;
      if (isRecord(part) && typeof part.type === "string") return `[${part.type}]`;
      return "";
    })
    .filter(Boolean)
    .join(" ");
};

export const normalizeToolResultContent = (content: unknown): ToolResultContent[] | undefined => {
  if (!Array.isArray(content)) return undefined;

  const normalized = content
    .filter(isSupportedToolResultContent)
    .map(toProtocolContent);

  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeToolResult = (result: unknown): NormalizedToolResult => {
  const envelope = asToolResultEnvelope(result);

  if (!envelope || !("content" in envelope)) {
    return { text: stringifyFallback(result) };
  }

  const content = normalizeToolResultContent(envelope.content);
  const details = "details" in envelope ? toJsonSafe(envelope.details) : undefined;

  return {
    text: textFromContent(envelope.content),
    ...(content ? { content } : {}),
    ...(details !== undefined ? { details } : {}),
  };
};

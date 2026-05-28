import * as v from "valibot";
import { SessionSettingsPatch } from "@pi-mobile/protocol";

export const CreateBody = v.object({
  cwd: v.string(),
  title: v.optional(v.string()),
  branch: v.optional(v.string()),
});

export const PatchBody = v.object({
  title: v.optional(v.string()),
  archived: v.optional(v.boolean()),
});

export const SetModelBody = v.object({
  provider: v.string(),
  modelId: v.string(),
});

export const CompactBody = v.object({
  instructions: v.optional(v.string()),
});

export const TreeJumpBody = v.object({
  entryId: v.string(),
  summarize: v.optional(v.boolean()),
});

export const AuthLoginBody = v.object({ providerId: v.string() });
export const AuthInputBody = v.object({ value: v.string() });

export { SessionSettingsPatch };

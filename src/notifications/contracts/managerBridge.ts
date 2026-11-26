import {z} from "zod";

export const ManagerReference = z.string().regex(/^[a-f0-9]{64}$/u);
const Revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const ImageUrl = z.string().max(2048).refine(value => {
  if ([...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return false;
  try {const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.hash;} catch {return false;}
});

/** Shared wire fields for trusted notification manager bridges. */
export const ManagerRegistration = z.object({
  version: z.literal(1), revision: Revision, enabled: z.boolean(),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/u).max(16), expiresAtMs: Revision,
}).strict();

export const ManagerRegistrationReceipt = z.object({installationId: ManagerReference, revision: Revision}).strict();

export const ManagerDispatch = z.object({
  version: z.literal(1), revision: Revision, notificationId: ManagerReference,
  title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(2000),
  imageUrl: ImageUrl.nullable(), expiresAtMs: Revision,
}).strict();

export function withinCampaignBudget(value: Pick<z.infer<typeof ManagerDispatch>, "title" | "body" | "imageUrl">): boolean {
  const content = JSON.stringify({title: value.title, body: value.body, imageUrl: value.imageUrl});
  return new TextEncoder().encode(content).byteLength <= 3000;
}

export const ManagerDispatchResult = z.object({outcome: z.enum(["accepted", "failed", "uncertain", "skipped"])}).strict();

import {z} from "zod";

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const ImageUrl = z.string().max(2048).refine(value => {
  if (/[\u0000-\u001f\u007f]/u.test(value)) return false;
  try {const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.hash;} catch {return false;}
});

export const AndroidRegistration = z.object({
  version: z.literal(1), tokenHash: Hash, revision: Revision, enabled: z.boolean(),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/u).max(16), expiresAtMs: Revision,
}).strict();
export type AndroidRegistration = z.infer<typeof AndroidRegistration>;

export const AndroidRegistrationReceipt = z.object({installationId: Hash, revision: Revision}).strict();
export type AndroidRegistrationReceipt = z.infer<typeof AndroidRegistrationReceipt>;

export const AndroidDispatch = z.object({
  version: z.literal(1), tokenHash: Hash, revision: Revision, notificationId: Hash,
  title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(2000),
  imageUrl: ImageUrl.nullable(), expiresAtMs: Revision,
}).strict().refine(value => new TextEncoder().encode(JSON.stringify({title: value.title, body: value.body, imageUrl: value.imageUrl})).byteLength <= 3000,
  "Notification content exceeds the push payload budget");
export type AndroidDispatch = z.infer<typeof AndroidDispatch>;

export const AndroidDispatchResult = z.object({outcome: z.enum(["accepted", "failed", "uncertain", "skipped"])}).strict();
export type AndroidDispatchResult = z.infer<typeof AndroidDispatchResult>;

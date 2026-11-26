import {z} from "zod";

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Locale = z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/u).max(16);
export const FirebasePushTarget = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u).refine(value => value !== "all");
export const FirebasePushRegistration = z.object({
  version: z.literal(1), deviceHash: Hash, target: FirebasePushTarget, revision: Revision,
  enabled: z.boolean(), locale: Locale, expiresAtMs: Revision,
}).strict();
export type FirebasePushRegistration = z.infer<typeof FirebasePushRegistration>;
export const FirebasePushBridgeInput = z.discriminatedUnion("action", [
  z.object({action: z.literal("audience")}).strict(),
  z.object({action: z.literal("status"), deviceToken: Hash, renew: z.boolean().optional()}).strict(),
  z.object({action: z.literal("disable"), deviceToken: Hash}).strict(),
]);
export const FirebasePushDeviceStatus = z.object({registered: z.boolean(), enabled: z.boolean(), expiresAtMs: Revision, revision: Revision}).strict();
export const FirebasePushAudience = z.object({accounts: Revision, registeredDevices: Revision}).strict();

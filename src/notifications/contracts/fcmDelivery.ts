import {z} from "zod";

export const FcmRegistrationToken = z.string().min(20).max(4096).regex(/^[A-Za-z0-9_:.-]+$/u);
const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Time = z.number().int().nonnegative().safe();
const DecimalTime = z.string().regex(/^(?:0|[1-9][0-9]{0,15})$/u).refine(value => Number.isSafeInteger(Number(value)));
const AndroidData = z.object({
  version: z.literal("1"), kind: z.literal("campaign"), notificationId: Hash, registrationRevision: DecimalTime,
  title: z.string().min(1).max(200), body: z.string().min(1).max(2000),
  imageUrl: z.string().url().max(2048).optional(), expiresAtMs: DecimalTime, accountId: z.string().min(1).max(128),
}).strict();
export const FcmDeliveryRequest = z.object({
  version: z.literal(1), transport: z.literal("android"), token: FcmRegistrationToken, expiresAtMs: Time, data: AndroidData,
}).strict().refine(input => new TextEncoder().encode(JSON.stringify(input.data)).byteLength <= 3800, "FCM data exceeds its delivery limit")
  .refine(input => Number(input.data.expiresAtMs) === input.expiresAtMs, "FCM expiry does not match its payload");
export type FcmDeliveryRequest = z.infer<typeof FcmDeliveryRequest>;

export const FcmDeliveryResult = z.union([
  z.object({outcome: z.literal("accepted")}).strict(),
  z.object({outcome: z.literal("failed"), reason: z.enum(["unregistered", "rejected"])}).strict(),
  z.object({outcome: z.literal("uncertain")}).strict(),
  z.object({outcome: z.literal("skipped"), reason: z.literal("expired")}).strict(),
]);
export type FcmDeliveryResult = z.infer<typeof FcmDeliveryResult>;

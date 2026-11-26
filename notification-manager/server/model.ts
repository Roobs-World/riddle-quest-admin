import {ECDH} from "node:crypto";
import {z} from "zod";
import {FirebasePushTarget} from "../../src/notifications/contracts/firebasePush.js";

export const DAY_MS = 86_400_000;
export const Platform = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u);
export const BrowserPlatform = Platform.refine(value => value !== "android" && value !== "all");
export const Revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
export const Locale = z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/u).max(16);

function decodeKey(value: string, length: number): boolean {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== length || bytes.toString("base64url") !== value.replace(/=+$/u, "")) return false;
  if (length !== 65) return true;
  if (bytes[0] !== 4) return false;
  try {ECDH.convertKey(bytes, "prime256v1"); return true;} catch {return false;}
}

/** Subscription URLs can reach only documented browser push vendors. */
export function permittedPushEndpoint(value: string): boolean {
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:" && !endpoint.username && !endpoint.password && !endpoint.hash && !endpoint.port &&
      (["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(endpoint.hostname) ||
        /^[a-z0-9-]+\.notify\.windows\.com$/u.test(endpoint.hostname));
  } catch {return false;}
}

export const Subscription = z.object({
  endpoint: z.string().min(20).max(4096).refine(permittedPushEndpoint),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/u).refine(value => decodeKey(value, 65)),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/u).refine(value => decodeKey(value, 16)),
  }).strict(),
}).strict();
export type Subscription = z.infer<typeof Subscription>;

export const UnsubscribeInput = z.object({target: BrowserPlatform, revision: Revision}).strict();
export const CampaignInput = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/u),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  imageUrl: z.string().max(2048).refine(value => {
    if (/[\u0000-\u001f\u007f]/u.test(value)) return false;
    try {const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.hash;} catch {return false;}
  }).nullable(),
  target: z.union([z.literal("all"), Platform]),
  sendAt: z.iso.datetime({offset: true}).nullable(),
}).strict().refine(value => Buffer.byteLength(JSON.stringify({title: value.title, body: value.body, imageUrl: value.imageUrl})) <= 3000, "Notification content exceeds the push payload budget");
export type CampaignInput = z.infer<typeof CampaignInput>;

const InstallationBase = z.object({
  revision: Revision, locale: Locale,
  createdAtMs: Revision, updatedAtMs: Revision, expiresAtMs: Revision,
  enrolledAtMs: Revision.nullable(),
});
const WebInstallationBase = InstallationBase.extend({transport: z.literal("web-push"), target: BrowserPlatform, origin: z.string()});
const AndroidInstallationBase = InstallationBase.extend({transport: z.literal("android"), target: z.literal("android"), origin: z.null()});
const FacebookInstallationBase = InstallationBase.extend({transport: z.literal("facebook"), target: z.literal("facebook"), origin: z.null()});
const FirebaseInstallationBase = InstallationBase.extend({transport: z.literal("firebase"), target: FirebasePushTarget, origin: z.null()});
export const Installation = z.discriminatedUnion("transport", [
  z.discriminatedUnion("status", [
    WebInstallationBase.extend({status: z.literal("active"), enrolledAtMs: Revision, subscription: Subscription, endpointHash: Hash}).strict(),
    WebInstallationBase.extend({status: z.literal("disabled")}).strict(),
  ]),
  z.discriminatedUnion("status", [
    AndroidInstallationBase.extend({status: z.literal("active"), enrolledAtMs: Revision, nativeRef: Hash, endpointHash: Hash}).strict(),
    AndroidInstallationBase.extend({status: z.literal("disabled")}).strict(),
  ]),
  z.discriminatedUnion("status", [
    FacebookInstallationBase.extend({status: z.literal("active"), enrolledAtMs: Revision, nativeRef: Hash, endpointHash: Hash}).strict(),
    FacebookInstallationBase.extend({status: z.literal("disabled")}).strict(),
  ]),
  z.discriminatedUnion("status", [
    FirebaseInstallationBase.extend({status: z.literal("active"), enrolledAtMs: Revision, nativeRef: Hash, endpointHash: Hash}).strict(),
    FirebaseInstallationBase.extend({status: z.literal("disabled")}).strict(),
  ]),
]);
export type Installation = z.infer<typeof Installation>;
export type ActiveInstallation = Extract<Installation, {status: "active"}>;

export const Counts = z.object({
  attempted: Revision, accepted: Revision, failed: Revision, uncertain: Revision, skipped: Revision,
}).strict();
const CampaignBase = z.object({
  requestId: CampaignInput.shape.requestId, fingerprint: Hash,
  createdBy: z.string().min(1),
  title: CampaignInput.shape.title, body: CampaignInput.shape.body, imageUrl: CampaignInput.shape.imageUrl, target: CampaignInput.shape.target,
  sendAtMs: Revision, createdAtMs: Revision, updatedAtMs: Revision,
  counts: Counts,
  cursor: z.string().nullable(), startedAtMs: Revision.nullable(),
  leaseId: z.string().nullable(), leaseUntilMs: Revision,
}).strict();
export const Campaign = z.discriminatedUnion("status", [
  CampaignBase.extend({status: z.literal("queued"), nextRunAtMs: Revision}).strict(),
  CampaignBase.extend({status: z.literal("sending"), nextRunAtMs: Revision}).strict(),
  CampaignBase.extend({status: z.literal("complete"), nextRunAtMs: z.never().optional()}).strict(),
  CampaignBase.extend({status: z.literal("cancelled"), nextRunAtMs: z.never().optional()}).strict(),
]);
export type Campaign = z.infer<typeof Campaign>;

export function publicCampaign(id: string, campaign: Campaign) {
  return {id, requestId: campaign.requestId, title: campaign.title, body: campaign.body, imageUrl: campaign.imageUrl, target: campaign.target,
    sendAt: new Date(campaign.sendAtMs).toISOString(), status: campaign.status,
    createdAt: new Date(campaign.createdAtMs).toISOString(), updatedAt: new Date(campaign.updatedAtMs).toISOString(), counts: campaign.counts};
}

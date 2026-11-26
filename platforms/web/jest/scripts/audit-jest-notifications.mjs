import {readFile} from "node:fs/promises";
import {z} from "zod";
import {ENGAGEMENT_REMINDER_IDS} from "../src/notifications/engagement.ts";

const printableText = maximum => z.string().trim().min(1).max(maximum).regex(/^[\x20-\x7e]+$/u);
const attributionCode = z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/u);
const notificationSchema = z.strictObject({
  scheduledInDays: z.number().int().min(1).max(7),
  identifier: z.string().min(1),
  template: attributionCode,
  body: printableText(100),
  ctaText: printableText(50),
});
const campaignSchema = z.strictObject({
  schemaVersion: z.literal(1),
  locale: z.literal("en"),
  assetReference: z.literal("riddle-q-notification"),
  campaign: attributionCode,
  gameMode: z.literal("challenge"),
  callback: z.literal("daily_riddle"),
  notifications: z.array(notificationSchema).length(7),
});

const path = new URL("../src/notifications/fundCampaign.json", import.meta.url);
const raw = JSON.parse(await readFile(path, "utf8"));
const campaign = campaignSchema.parse(raw);
const entries = campaign.notifications;
for (const [index, notification] of entries.entries()) {
  if (notification.scheduledInDays !== index + 1) throw new Error("Jest campaign must contain ordered D1-D7 schedules");
  if (notification.identifier !== ENGAGEMENT_REMINDER_IDS[index]) {
    throw new Error(`Jest D${index + 1} identifier must retain its existing cancellation/deletion ownership`);
  }
  if (notification.body !== raw.notifications[index].body || notification.ctaText !== raw.notifications[index].ctaText) {
    throw new Error(`Jest D${index + 1} copy must not contain surrounding whitespace`);
  }
}
for (const key of ["identifier", "template", "body"]) {
  if (new Set(entries.map(entry => entry[key])).size !== entries.length) {
    throw new Error(`Jest campaign must have seven distinct ${key} values`);
  }
}

console.log("Jest notification campaign passed: D1-D7, stable owned identifiers, seven distinct ASCII bodies within 100 characters, bounded CTAs, configured portal asset and Daily routing. Portal moderation status is verified separately.");

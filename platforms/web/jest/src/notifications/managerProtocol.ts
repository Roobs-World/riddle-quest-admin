import {z} from "zod";
import {ManagerReference, ManagerRegistration, ManagerRegistrationReceipt} from "../../../../../src/notifications/contracts/managerBridge.js";

export const JestRegistration = ManagerRegistration.extend({recipientHash: ManagerReference, locale: z.literal("en")});
export type JestRegistration = z.infer<typeof JestRegistration>;

export const JestRegistrationReceipt = ManagerRegistrationReceipt.extend({
  enabled: z.boolean(), expiresAtMs: z.number().int().nonnegative().safe(),
});
export type JestRegistrationReceipt = z.infer<typeof JestRegistrationReceipt>;

const PrintableText = z.string().trim().min(1).regex(/^[\x20-\x7e]+$/u);
export const JestManagedNotification = z.object({
  identifier: z.string().regex(/^riddle-quest-d[1-7]-v4$/u),
  scheduledInDays: z.number().int().min(1).max(7),
  body: PrintableText.max(100),
  ctaText: PrintableText.max(50),
  assetReference: z.literal("riddle-q-notification"),
}).strict().refine(value => value.identifier === `riddle-quest-d${value.scheduledInDays}-v4`, "Notification day does not match its identifier");
export type JestManagedNotification = z.infer<typeof JestManagedNotification>;

export const JestNotificationPlan = JestRegistrationReceipt.extend({
  version: z.literal(1),
  planId: z.literal("jest-daily-v4"),
  notifications: z.array(JestManagedNotification).max(7),
}).strict().superRefine((value, context) => {
  if (value.notifications.length !== (value.enabled ? 7 : 0)) {
    context.addIssue({code: "custom", path: ["notifications"], message: "Enabled plans require seven days; disabled plans must be empty"});
  }
  if (new Set(value.notifications.map(notification => notification.scheduledInDays)).size !== value.notifications.length ||
      new Set(value.notifications.map(notification => notification.body)).size !== value.notifications.length) {
    context.addIssue({code: "custom", path: ["notifications"], message: "Notification days and bodies must be unique"});
  }
});
export type JestNotificationPlan = z.infer<typeof JestNotificationPlan>;

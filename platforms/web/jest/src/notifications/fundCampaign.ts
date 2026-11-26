import campaign from "./fundCampaign.json";
import type {JestNotificationSchedule} from "../types";

/** Builds the English-only Jest campaign validated by the release content audit. */
export function createJestFundNotifications(): JestNotificationSchedule[] {
  return campaign.notifications.map(notification => ({
    identifier: notification.identifier,
    scheduledInDays: notification.scheduledInDays,
    body: notification.body,
    ctaText: notification.ctaText,
    priority: "medium",
    assetReference: campaign.assetReference,
    entryPayload: {
      source: "notification",
      gameMode: campaign.gameMode,
      campaign: campaign.campaign,
      callback: campaign.callback,
      notification_template: notification.template,
      notification_offset: `D${notification.scheduledInDays}`,
    },
  } satisfies JestNotificationSchedule));
}

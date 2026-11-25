import type {NotificationProvider, NotificationProviderFactory, NotificationProviderPolicy} from "../contracts/notificationProvider";
import {notificationDeliveryForPlatform} from "../contracts/notificationPolicy";

/** Uses our hosted implementation unless a target declares an explicit requirement or prohibition. */
export function createNotificationProvider({platform, hosted, policy}: {
  platform: string;
  hosted: NotificationProviderFactory;
  policy?: NotificationProviderPolicy;
}): NotificationProvider | null {
  const requirement = notificationDeliveryForPlatform(platform);
  if (requirement === "disabled") return null;
  if (requirement === "platform-required" && policy?.kind !== "platform-required" && policy?.kind !== "disabled") {
    throw new Error(`A platform notification implementation is required for ${platform}`);
  }
  const selected = policy ?? {kind: "hosted"};
  let provider: NotificationProvider;
  switch (selected.kind) {
    case "hosted": provider = hosted({platform}); break;
    case "platform-required": provider = selected.create({platform}); break;
    case "disabled": return null;
    default: {
      const exhaustive: never = selected;
      return exhaustive;
    }
  }
  if (requirement === "account-enrollment" && provider.kind !== "manager")
    throw new Error(`Manager registration is required for ${platform}`);
  if (requirement === "platform-required" && provider.kind !== "device")
    throw new Error(`A device notification adapter is required for ${platform}`);
  return provider;
}

/** Only authenticated web games manage consent. Push delivery is native. */
export function notificationDeliveryForPlatform(platform: string): "account-enrollment" | "platform-required" | "disabled" {
  switch (platform) {
    case "jest": return "account-enrollment";
    case "android": return "platform-required";
    default: return "disabled";
  }
}

/** Requirements override our hosted default only at the platform boundary. */
export function notificationDeliveryForPlatform(platform: string): "hosted" | "platform-required" | "disabled" {
  switch (platform) {
    case "jest":
    case "android": return "platform-required";
    case "youtube":
    case "netflix":
    case "reddit":
    case "gamesnacks": return "disabled";
    default: return "hosted";
  }
}

import {defineSecret} from "firebase-functions/params";
import {FcmDeliveryRequest, FcmDeliveryResult} from "../../../src/notifications/contracts/fcmDelivery";

export const notificationFcmEdgeSecret = defineSecret("NOTIFICATION_FCM_EDGE_SECRET");
const endpoint = "https://vqyjgcqyudqonfhgymoy.supabase.co/functions/v1/fcm-push";

export class FcmDeliveryError extends Error {
  constructor(readonly code: "messaging/registration-token-not-registered" | "messaging/invalid-argument" | "messaging/internal-error") {
    super("notification-fcm-delivery-unavailable");
    this.name = "FcmDeliveryError";
  }
}

export async function sendFcmNotification(value: unknown): Promise<boolean> {
  const parsed = FcmDeliveryRequest.safeParse(value);
  if (!parsed.success) throw new FcmDeliveryError("messaging/invalid-argument");
  const input = parsed.data;
  if (input.expiresAtMs <= Date.now()) return false;
  const secret = notificationFcmEdgeSecret.value();
  if (process.env.NOTIFICATION_FCM_EDGE_URL !== endpoint || !/^[A-Za-z0-9_-]{43,128}$/u.test(secret))
    throw new FcmDeliveryError("messaging/internal-error");
  const response = await fetch(endpoint, {method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: {Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Accept: "application/json"}, body: JSON.stringify(input)});
  const reader = response.body?.getReader();
  if (!reader) throw new FcmDeliveryError("messaging/internal-error");
  let text = "", size = 0;
  try {
    if (!response.ok || !response.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
      throw new FcmDeliveryError("messaging/internal-error");
    const decoder = new TextDecoder();
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) throw new FcmDeliveryError("messaging/internal-error");
      text += decoder.decode(part.value, {stream: true});
    }
    const raw: unknown = JSON.parse(text + decoder.decode());
    const result = FcmDeliveryResult.parse(raw);
    switch (result.outcome) {
      case "accepted": return true;
      case "skipped": return false;
      case "failed": throw new FcmDeliveryError(result.reason === "unregistered" ? "messaging/registration-token-not-registered" : "messaging/invalid-argument");
      case "uncertain": throw new FcmDeliveryError("messaging/internal-error");
      default: {const exhaustive: never = result; throw exhaustive;}
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

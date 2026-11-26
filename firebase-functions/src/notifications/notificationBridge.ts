import {createHash, timingSafeEqual} from "node:crypto";
import {defineSecret} from "firebase-functions/params";
import type {FirebasePushRegistration} from "../../../src/notifications/contracts/firebasePush";

export const notificationBridgeSecret = defineSecret("NOTIFICATION_MANAGER_BRIDGE_SECRET");
export const pushDigest = (value: string): string => createHash("sha256").update(value).digest("hex");

export function managerOrigin(): string {
  const value = process.env.NOTIFICATION_MANAGER_URL ?? "";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) throw new Error("notification-manager-unconfigured");
  return url.origin;
}

export function bridgeAuthorized(authorization: string | undefined): boolean {
  const secret = notificationBridgeSecret.value();
  const expected = Buffer.from(`Bearer ${secret}`), supplied = Buffer.from(authorization ?? "");
  return secret.length >= 32 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function synchronizeFirebaseRegistration(registration: FirebasePushRegistration): Promise<void> {
  const response = await fetch(`${managerOrigin()}/api/devices/firebase/registration`, {
    method: "POST", redirect: "error", headers: {"Content-Type": "application/json", Authorization: `Bearer ${notificationBridgeSecret.value()}`},
    body: JSON.stringify(registration), signal: AbortSignal.timeout(8000),
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error("notification-manager-unavailable");
}

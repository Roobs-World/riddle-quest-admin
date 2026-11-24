import {createHash} from "node:crypto";
import {defineSecret} from "firebase-functions/params";
import {AndroidRegistration, AndroidRegistrationReceipt} from "../notificationManagerProtocol";

export const notificationManagerBridgeSecret = defineSecret("NOTIFICATION_MANAGER_BRIDGE_SECRET");

export function notificationManagerConfiguration(): {origin: string; secret: string} | null {
  const origin = process.env.NOTIFICATION_MANAGER_URL ?? "";
  const secret = notificationManagerBridgeSecret.value();
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && origin === url.origin && secret.length >= 32 ? {origin, secret} : null;
  } catch {return null;}
}

/** Only opaque routing references cross from the game authority into the manager. */
export async function synchronizeAndroidRegistration(registration: AndroidRegistration): Promise<boolean> {
  const configuration = notificationManagerConfiguration();
  if (!configuration) return false;
  const input = AndroidRegistration.parse(registration);
  const response = await fetch(`${configuration.origin}/api/devices/android/registration`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: {Authorization: `Bearer ${configuration.secret}`, "Content-Type": "application/json"}, body: JSON.stringify(input),
  });
  if (!response.ok) {void response.body?.cancel(); throw new Error("notification-manager-registration-unavailable");}
  const receipt = AndroidRegistrationReceipt.parse(await response.json());
  const expectedId = createHash("sha256").update(`android:${input.tokenHash}`).digest("hex");
  if (receipt.installationId !== expectedId || receipt.revision < input.revision) throw new Error("notification-manager-registration-invalid");
  return true;
}

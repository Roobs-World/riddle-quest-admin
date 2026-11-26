import {AndroidRegistration, AndroidRegistrationReceipt} from "../../platforms/native/android/server/notificationManagerProtocol.js";
import {notificationRpc} from "./database.js";
import type {Deadline} from "./deadline.js";
import {ApiError} from "./http.js";
import {digest} from "./security.js";

export async function registerAndroidDevice(value: unknown, deadline: Deadline) {
  const result = AndroidRegistration.safeParse(value);
  if (!result.success) throw new ApiError(400, "android-registration-invalid");
  const input = result.data;
  return AndroidRegistrationReceipt.parse(await notificationRpc(deadline, "notification_register_android", {
    p_id: digest(`android:${input.tokenHash}`), p_token_hash: input.tokenHash, p_revision: input.revision,
    p_enabled: input.enabled, p_locale: input.locale, p_expires_at_ms: input.expiresAtMs,
  }));
}

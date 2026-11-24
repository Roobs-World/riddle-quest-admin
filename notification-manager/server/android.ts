import {timingSafeEqual} from "node:crypto";
import {AndroidRegistration, AndroidRegistrationReceipt} from "../../platforms/native/android/server/notificationManagerProtocol.js";
import {androidBridgeConfiguration} from "./configuration.js";
import {notificationRpc} from "./database.js";
import type {Deadline} from "./deadline.js";
import {ApiError, bearer, header, type ApiRequest} from "./http.js";
import {digest} from "./security.js";

export function requireAndroidBridge(request: ApiRequest): void {
  if (header(request, "origin")) throw new ApiError(403, "android-server-origin-required");
  const configuration = androidBridgeConfiguration();
  if (!configuration) throw new ApiError(503, "android-bridge-unconfigured");
  const supplied = Buffer.from(bearer(request)), expected = Buffer.from(configuration.secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new ApiError(401, "android-bridge-authentication-required");
  }
}

export async function registerAndroidDevice(value: unknown, deadline: Deadline) {
  const result = AndroidRegistration.safeParse(value);
  if (!result.success) throw new ApiError(400, "android-registration-invalid");
  const input = result.data;
  return AndroidRegistrationReceipt.parse(await notificationRpc(deadline, "notification_register_android", {
    p_id: digest(`android:${input.tokenHash}`), p_token_hash: input.tokenHash, p_revision: input.revision,
    p_enabled: input.enabled, p_locale: input.locale, p_expires_at_ms: input.expiresAtMs,
  }));
}

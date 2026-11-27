import {timingSafeEqual} from "node:crypto";
import {JestRegistration, JestRegistrationReceipt} from "../../../../platforms/web/jest/server/notifications/managerProtocol.js";
import {notificationRpc} from "../../../server/database.js";
import {requestDeadline} from "../../../server/deadline.js";
import {ApiError, bearer, body, fail, header, json, type ApiRequest, type ApiResponse} from "../../../server/http.js";
import {createJestNotificationPlan} from "../../../server/jest/plan.js";
import {digest} from "../../../server/security.js";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (request.method !== "POST") throw new ApiError(405, "method-not-allowed");
    if (header(request, "origin")) throw new ApiError(403, "jest-server-origin-required");
    const secret = process.env.NOTIFICATION_MANAGER_BRIDGE_SECRET ?? "";
    if (!/^[A-Za-z0-9_-]{32,256}$/u.test(secret)) throw new ApiError(503, "jest-bridge-unconfigured");
    const supplied = Buffer.from(bearer(request)), expected = Buffer.from(secret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new ApiError(401, "jest-bridge-authentication-required");
    }
    const parsed = JestRegistration.safeParse(await body(request, deadline, 2048));
    if (!parsed.success) throw new ApiError(400, "jest-registration-invalid");
    const input = parsed.data;
    const registration = JestRegistrationReceipt.parse(await notificationRpc(deadline, "notification_register_jest", {
      p_id: digest(`jest:${input.recipientHash}`), p_recipient_hash: input.recipientHash, p_revision: input.revision,
      p_enabled: input.enabled, p_locale: input.locale, p_expires_at_ms: input.expiresAtMs,
    }));
    if (registration.revision !== input.revision || registration.enabled !== input.enabled) {
      throw new ApiError(409, "jest-registration-revision-conflict");
    }
    if (registration.enabled && registration.expiresAtMs <= Date.now()) throw new ApiError(409, "jest-registration-expired");
    json(response, 200, createJestNotificationPlan(registration));
  } catch (error) {fail(response, error);}
}

import {FacebookRegistration, FacebookRegistrationReceipt} from "../../../../platforms/web/facebook/server/notifications/managerProtocol.js";
import {facebookBridgeConfiguration} from "../../../server/configuration.js";
import {notificationRpc} from "../../../server/database.js";
import {requestDeadline} from "../../../server/deadline.js";
import {ApiError, body, fail, json, type ApiRequest, type ApiResponse} from "../../../server/http.js";
import {requireProviderBridge} from "../../../server/providerBridge.js";
import {digest} from "../../../server/security.js";

/** Only the authenticated Firebase bridge can mirror an opted-in Facebook recipient. */
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (request.method !== "POST") throw new ApiError(405, "method-not-allowed");
    requireProviderBridge(request, "facebook", facebookBridgeConfiguration());
    const parsed = FacebookRegistration.safeParse(await body(request, deadline, 2048));
    if (!parsed.success) throw new ApiError(400, "facebook-registration-invalid");
    const input = parsed.data;
    const receipt = await notificationRpc(deadline, "notification_register_provider", {
      p_transport: "facebook", p_id: digest(`facebook:${input.recipientHash}`), p_ref: input.recipientHash,
      p_revision: input.revision, p_enabled: input.enabled, p_locale: input.locale, p_expires_at_ms: input.expiresAtMs,
    });
    json(response, 200, FacebookRegistrationReceipt.parse(receipt));
  } catch (error) {fail(response, error);}
}

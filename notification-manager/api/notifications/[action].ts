import {UnsubscribeInput} from "../../server/model.js";
import {ApiError, body, fail, json, type ApiRequest, type ApiResponse} from "../../server/http.js";
import {browserCors, browserOrigin, consumeBrowserQuota, digest, installationCredential} from "../../server/security.js";
import {unsubscribeInstallation} from "../../server/subscriptions.js";
import {requestDeadline} from "../../server/deadline.js";

/** Previously enrolled installations may still revoke their subscriptions. */
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (browserCors(request, response)) return;
    const url = new URL(request.url ?? "/", "https://notification.invalid");
    const action = url.pathname.split("/").filter(Boolean).at(-1);
    if (action === "config" || action === "subscribe" || action === "activity") throw new ApiError(410, "browser-push-retired");
    if (action !== "unsubscribe") throw new ApiError(404, "notification-route-not-found");
    if (request.method !== "POST") throw new ApiError(405, "method-not-allowed");
    const token = installationCredential(request);
    const input = UnsubscribeInput.safeParse(await body(request, deadline));
    if (!input.success) throw new ApiError(400, "revocation-invalid");
    const origin = browserOrigin(request, input.data.target);
    await consumeBrowserQuota(request, origin, digest(token), deadline);
    json(response, 200, await unsubscribeInstallation(token, origin, input.data, deadline));
  } catch (error) {fail(response, error);}
}

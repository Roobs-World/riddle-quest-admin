import {z} from "zod";
import {vapidConfiguration} from "../../server/configuration.js";
import {ActivityInput, BrowserPlatform, SubscribeInput, UnsubscribeInput} from "../../server/model.js";
import {ApiError, body, fail, json, type ApiRequest, type ApiResponse} from "../../server/http.js";
import {browserCors, browserOrigin, consumeBrowserQuota, digest, installationCredential} from "../../server/security.js";
import {recordInstallationActivity, subscribeInstallation, unsubscribeInstallation} from "../../server/subscriptions.js";
import {requestDeadline} from "../../server/deadline.js";

const ConfigQuery = z.object({target: BrowserPlatform}).strict();

/** Anonymous browser enrollment is isolated from both management authentication and game accounts. */
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (browserCors(request, response)) return;
    const url = new URL(request.url ?? "/", "https://notification.invalid");
    const action = url.pathname.split("/").filter(Boolean).at(-1);
    if (action === "config") {
      if (request.method !== "GET") throw new ApiError(405, "method-not-allowed");
      const query = ConfigQuery.safeParse(Object.fromEntries(url.searchParams));
      if (!query.success) throw new ApiError(400, "configuration-query-invalid");
      browserOrigin(request, query.data.target, true);
      const config = vapidConfiguration();
      json(response, 200, {version: 1, target: query.data.target, publicKey: config.publicKey});
      return;
    }
    if (request.method !== "POST") throw new ApiError(405, "method-not-allowed");
    const token = installationCredential(request);
    const value = await body(request, deadline);
    if (action === "subscribe") {
      const input = SubscribeInput.safeParse(value);
      if (!input.success) throw new ApiError(400, "subscription-invalid");
      const origin = browserOrigin(request, input.data.target);
      await consumeBrowserQuota(request, origin, digest(token), deadline);
      json(response, 200, await subscribeInstallation(token, origin, input.data, deadline));
    } else if (action === "unsubscribe") {
      const input = UnsubscribeInput.safeParse(value);
      if (!input.success) throw new ApiError(400, "revocation-invalid");
      const origin = browserOrigin(request, input.data.target);
      await consumeBrowserQuota(request, origin, digest(token), deadline);
      json(response, 200, await unsubscribeInstallation(token, origin, input.data, deadline));
    } else if (action === "activity") {
      const input = ActivityInput.safeParse(value);
      if (!input.success) throw new ApiError(400, "activity-invalid");
      const origin = browserOrigin(request, input.data.target);
      await consumeBrowserQuota(request, origin, digest(token), deadline);
      await recordInstallationActivity(token, origin, input.data, deadline);
      json(response, 200, {ok: true});
    } else throw new ApiError(404, "notification-route-not-found");
  } catch (error) {fail(response, error);}
}

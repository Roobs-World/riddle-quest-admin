import {disableBrowserDevice} from "../../server/firebasePush.js";
import {requestDeadline} from "../../server/deadline.js";
import {ApiError, body, fail, json, type ApiRequest, type ApiResponse} from "../../server/http.js";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (request.method !== "POST") throw new ApiError(405, "method-not-allowed");
    const action = new URL(request.url ?? "/", "https://notification.invalid").pathname.split("/").filter(Boolean).at(-1) ?? "";
    if (["config", "config-fcm", "enroll", "enroll-fcm", "status"].includes(action)) throw new ApiError(410, "browser-push-retired");
    if (action !== "disable") throw new ApiError(404, "notification-route-not-found");
    json(response, 200, await disableBrowserDevice(request, await body(request, deadline, 8192), deadline));
  } catch (error) {fail(response, error);}
}

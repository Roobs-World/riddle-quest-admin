import {registerFirebaseDevice, requireFirebaseBridge} from "../../../server/firebasePush.js";
import {requestDeadline} from "../../../server/deadline.js";
import {ApiError, body, fail, json, type ApiRequest, type ApiResponse} from "../../../server/http.js";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (request.method !== "POST") throw new ApiError(405, "method-not-allowed");
    requireFirebaseBridge(request);
    json(response, 200, await registerFirebaseDevice(await body(request, deadline, 2048), deadline));
  } catch (error) {fail(response, error);}
}

import {registerAndroidDevice} from "../../../server/android.js";
import {androidBridgeConfiguration} from "../../../server/configuration.js";
import {requireProviderBridge} from "../../../server/providerBridge.js";
import {requestDeadline} from "../../../server/deadline.js";
import {ApiError, body, fail, json, type ApiRequest, type ApiResponse} from "../../../server/http.js";

/** Firebase alone supplies opaque device references and authoritative native consent revisions. */
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (request.method !== "POST") throw new ApiError(405, "method-not-allowed");
    requireProviderBridge(request, "android", androidBridgeConfiguration());
    json(response, 200, await registerAndroidDevice(await body(request, deadline, 2048), deadline));
  } catch (error) {fail(response, error);}
}

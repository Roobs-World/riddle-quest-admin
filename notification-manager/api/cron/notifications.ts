import {ApiError, fail, json, requireCron, type ApiRequest, type ApiResponse} from "../../server/http.js";
import {dispatchDueCampaigns} from "../../server/dispatcher.js";
import {requestDeadline} from "../../server/deadline.js";

/** An authenticated external or Vercel scheduler invokes this route after scheduled times become due. */
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (request.method !== "GET" && request.method !== "POST") throw new ApiError(405, "method-not-allowed");
    requireCron(request);
    json(response, 200, await dispatchDueCampaigns(deadline));
  } catch (error) {fail(response, error);}
}

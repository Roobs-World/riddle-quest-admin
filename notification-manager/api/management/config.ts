import {admittedPlatforms} from "../../server/configuration.js";
import {ApiError, fail, json, requireOperator, type ApiRequest, type ApiResponse} from "../../server/http.js";
import {requestDeadline} from "../../server/deadline.js";
import {firebaseAudience} from "../../server/firebasePush.js";
import {readCampaignSummary} from "../../server/summary.js";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (request.method !== "GET") throw new ApiError(405, "method-not-allowed");
    await requireOperator(request, deadline);
    if (new URL(request.url ?? "/", "https://notification.invalid").searchParams.size === 0) {
      json(response, 200, {platforms: admittedPlatforms(), pushOnly: true, firebaseAudience: await firebaseAudience(deadline)});
      return;
    }
    const [campaignSummary, audience] = await Promise.all([readCampaignSummary(request.url, deadline), firebaseAudience(deadline)]);
    json(response, 200, {platforms: admittedPlatforms(), pushOnly: true, campaignSummary, firebaseAudience: audience});
  } catch (error) {fail(response, error);}
}

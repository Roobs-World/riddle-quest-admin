import {CampaignInput} from "../../../server/model.js";
import {ApiError, body, fail, json, requireOperator, type ApiRequest, type ApiResponse} from "../../../server/http.js";
import {vapidConfiguration} from "../../../server/configuration.js";
import {createCampaign, listCampaigns, readCampaign} from "../../../server/campaigns.js";
import {dispatchCampaignBatch} from "../../../server/dispatcher.js";
import {requestDeadline, reserveDeadline} from "../../../server/deadline.js";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    const operator = await requireOperator(request, deadline);
    if (request.method === "GET") {json(response, 200, await listCampaigns(request.url, deadline)); return;}
    if (request.method !== "POST") throw new ApiError(405, "method-not-allowed");
    const input = CampaignInput.safeParse(await body(request, deadline));
    if (!input.success) throw new ApiError(400, "campaign-input-invalid");
    vapidConfiguration();
    const id = await createCampaign(operator, input.data, deadline);
    await dispatchCampaignBatch(id, reserveDeadline(deadline, 8000)).catch(() => undefined);
    json(response, 200, {campaign: await readCampaign(id, deadline)});
  } catch (error) {fail(response, error);}
}

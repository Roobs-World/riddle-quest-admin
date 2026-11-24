import {ApiError, fail, json, requireOperator, type ApiRequest, type ApiResponse} from "../../../server/http.js";
import {cancelCampaign, readCampaign} from "../../../server/campaigns.js";
import {requestDeadline} from "../../../server/deadline.js";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    const operator = await requireOperator(request, deadline);
    const url = new URL(request.url ?? "/", "https://notification.invalid");
    const id = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    if (request.method === "GET") json(response, 200, {campaign: await readCampaign(id, deadline)});
    else if (request.method === "DELETE") json(response, 200, {campaign: await cancelCampaign(id, operator, deadline)});
    else throw new ApiError(405, "method-not-allowed");
  } catch (error) {fail(response, error);}
}

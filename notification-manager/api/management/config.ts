import {admittedOrigins} from "../../server/configuration.js";
import {ApiError, fail, json, requireOperator, type ApiRequest, type ApiResponse} from "../../server/http.js";
import {requestDeadline} from "../../server/deadline.js";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const deadline = requestDeadline();
  try {
    if (request.method !== "GET") throw new ApiError(405, "method-not-allowed");
    await requireOperator(request, deadline);
    json(response, 200, {platforms: Object.entries(admittedOrigins()).map(([id, origin]) => ({id, origin})), pushOnly: true});
  } catch (error) {fail(response, error);}
}

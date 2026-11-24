import {z} from "zod";
import {notificationRpc} from "./database.js";
import {admittedPlatforms} from "./configuration.js";
import {ApiError} from "./http.js";
import {digest} from "./security.js";
import {Campaign, Hash, publicCampaign, type CampaignInput} from "./model.js";
import type {Deadline} from "./deadline.js";

export async function createCampaign(operator: string, input: CampaignInput, deadline: Deadline): Promise<string> {
  if (input.target !== "all" && !admittedPlatforms().some(platform => platform.id === input.target)) throw new ApiError(400, "campaign-platform-not-admitted");
  const id = digest(`${operator}\0${input.requestId}`);
  const receipt = z.object({id: Hash}).strict().parse(await notificationRpc(deadline, "notification_create_campaign", {
    p_id: id, p_operator: operator, p_request_id: input.requestId, p_fingerprint: digest(JSON.stringify(input)),
    p_title: input.title, p_body: input.body, p_image_url: input.imageUrl, p_target: input.target, p_send_at: input.sendAt,
  }));
  return receipt.id;
}

export async function readCampaign(id: string, deadline: Deadline) {
  if (!Hash.safeParse(id).success) throw new ApiError(400, "campaign-id-invalid");
  const value = await notificationRpc(deadline, "notification_read_campaign", {p_id: id});
  if (value === null) throw new ApiError(404, "campaign-not-found");
  return publicCampaign(id, Campaign.parse(value));
}

const CampaignCursor = z.object({at: z.iso.datetime({offset: true}), id: Hash}).strict();

export async function listCampaigns(requestUrl: string | undefined, deadline: Deadline) {
  const search = new URL(requestUrl ?? "/", "https://notification.invalid").searchParams;
  if ([...search.keys()].some(key => !["view", "cursor", "limit"].includes(key) || search.getAll(key).length !== 1)) {
    throw new ApiError(400, "campaign-page-invalid");
  }
  const view = z.enum(["all", "active", "history"]).safeParse(search.get("view") ?? "all");
  const rawLimit = search.get("limit") ?? "100";
  if (!view.success || !/^(?:[1-9][0-9]?|100)$/u.test(rawLimit)) throw new ApiError(400, "campaign-page-invalid");
  let cursor: z.infer<typeof CampaignCursor> | null = null;
  const encoded = search.get("cursor");
  if (encoded !== null) {
    try {
      if (!/^[A-Za-z0-9_-]{1,512}$/u.test(encoded)) throw new Error();
      const decoded = Buffer.from(encoded, "base64url");
      if (decoded.toString("base64url") !== encoded) throw new Error();
      cursor = CampaignCursor.parse(JSON.parse(decoded.toString("utf8")));
    } catch {throw new ApiError(400, "campaign-page-invalid");}
  }
  const page = z.object({entries: z.array(z.object({id: Hash, campaign: Campaign}).strict()).max(100),
    nextCursor: CampaignCursor.nullable()}).strict().parse(await notificationRpc(deadline, "notification_list_campaigns", {
    p_view: view.data, p_limit: Number(rawLimit), p_before_at: cursor?.at ?? null, p_before_id: cursor?.id ?? null,
  }));
  return {campaigns: page.entries.map(entry => publicCampaign(entry.id, entry.campaign)),
    nextCursor: page.nextCursor ? Buffer.from(JSON.stringify(page.nextCursor)).toString("base64url") : null};
}

export async function cancelCampaign(id: string, operator: string, deadline: Deadline) {
  if (!Hash.safeParse(id).success) throw new ApiError(400, "campaign-id-invalid");
  await notificationRpc(deadline, "notification_cancel_campaign", {p_id: id, p_operator: operator});
  return readCampaign(id, deadline);
}

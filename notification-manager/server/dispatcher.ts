import {randomBytes} from "node:crypto";
import {z} from "zod";
import {notificationRpc} from "./database.js";
import {Campaign, Hash} from "./model.js";
import {deliverCampaignNotification} from "./delivery.js";
import {remainingMs, reserveDeadline, type Deadline} from "./deadline.js";

export async function dispatchCampaignBatch(id: string, deadline: Deadline, limit = 25): Promise<number> {
  if (!Hash.safeParse(id).success || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) return 0;
  const workDeadline = reserveDeadline(deadline, 4000);
  if (remainingMs(workDeadline) < 12_000) return 0;
  const leaseId = randomBytes(16).toString("hex");
  const value = await notificationRpc(workDeadline, "notification_claim_campaign", {p_id: id, p_lease_id: leaseId});
  if (value === null) return 0;
  const campaign = Campaign.parse(value);
  try {
    const rows = z.array(Hash).parse(await notificationRpc(workDeadline, "notification_installation_page", {
      p_campaign_id: id, p_cursor: campaign.cursor, p_limit: limit}));
    let processed = 0;
    for (let index = 0; index < rows.length; index += 10) {
      if (remainingMs(workDeadline) < 12_000) break;
      const batch = rows.slice(index, index + 10);
      const outcomes = await Promise.allSettled(batch.map(installationId => deliverCampaignNotification(id, installationId, workDeadline)));
      if (outcomes.some(outcome => outcome.status === "rejected")) throw new Error("notification-batch-admission-unavailable");
      processed += batch.length;
    }
    await notificationRpc(deadline, "notification_finish_campaign_batch", {p_id: id, p_lease_id: leaseId,
      p_cursor: processed ? rows.at(processed - 1) ?? campaign.cursor : campaign.cursor,
      p_finished: processed === rows.length && rows.length < limit});
    return processed;
  } catch {
    await notificationRpc(deadline, "notification_finish_campaign_batch", {p_id: id, p_lease_id: leaseId,
      p_cursor: campaign.cursor, p_finished: false}).catch(() => undefined);
    return 0;
  }
}

export async function dispatchDueCampaigns(deadline: Deadline): Promise<{campaigns: number; scanned: number}> {
  const workDeadline = reserveDeadline(deadline, 3000);
  const due = z.array(Hash).parse(await notificationRpc(workDeadline, "notification_due_campaigns"));
  let remaining = 50, campaigns = 0;
  for (const id of due) {
    if (remaining <= 0 || remainingMs(workDeadline) < 16_000) break;
    remaining -= await dispatchCampaignBatch(id, workDeadline, remaining);
    campaigns += 1;
  }
  await notificationRpc(deadline, "notification_cleanup").catch(() => undefined);
  return {campaigns, scanned: 50 - remaining};
}

import {z} from "zod";
import {notificationRpc} from "./database.js";
import {androidBridgeConfiguration} from "./configuration.js";
import {Campaign, Installation, Revision} from "./model.js";
import {deadlineSignal, reserveDeadline, type Deadline} from "./deadline.js";

const Claim = z.object({attemptId: z.string().regex(/^[a-f0-9]{64}:[a-f0-9]{64}$/u), installation: Installation, revision: Revision}).strict();
type Outcome = "accepted" | "failed" | "uncertain" | "skipped";

export async function deliverCampaignNotification(campaignId: string, installationId: string, deadline: Deadline): Promise<void> {
  const workDeadline = reserveDeadline(deadline, 4000);
  const raw = await notificationRpc(workDeadline, "notification_claim_delivery", {p_campaign_id: campaignId, p_installation_id: installationId});
  if (raw === null) return;
  const claim = Claim.parse(raw);
  if (claim.installation.status !== "active") throw new Error("notification-claim-invalid");
  const installation = claim.installation;
  if (installation.transport !== "android") {
    await notificationRpc(deadline, "notification_finish_delivery", {p_attempt_id: claim.attemptId, p_outcome: "skipped"});
    return;
  }
  let outcome: Outcome = "uncertain";
  try {
    const admit = async () => {
      const value = await notificationRpc(workDeadline, "notification_admit_delivery", {p_campaign_id: campaignId,
        p_installation_id: installationId, p_revision: claim.revision});
      return value === null ? null : Campaign.parse(value);
    };
    const campaign = await admit();
    const expiresAtMs = campaign ? campaign.sendAtMs + 6 * 3_600_000 : 0;
    if (!campaign || expiresAtMs <= Date.now()) {
      outcome = "skipped";
    } else {
      const configuration = androidBridgeConfiguration();
      if (!configuration) outcome = "failed";
      else if (!await admit()) outcome = "skipped";
      else {
        const {sendAndroidManagerNotification} = await import("../../platforms/native/android/server/managerAndroidDelivery.js");
        outcome = (await sendAndroidManagerNotification({version: 1, tokenHash: installation.nativeRef,
          revision: claim.revision, notificationId: campaignId, title: campaign.title, body: campaign.body,
          imageUrl: campaign.imageUrl, expiresAtMs}, configuration, deadlineSignal(workDeadline, 8000))).outcome;
      }
    }
  } catch {outcome = "uncertain";}
  await notificationRpc(deadline, "notification_finish_delivery", {p_attempt_id: claim.attemptId, p_outcome: outcome});
}

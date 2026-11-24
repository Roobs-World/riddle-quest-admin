import {z} from "zod";
import {notificationRpc} from "./database.js";
import {admittedOrigins, androidBridgeConfiguration, firebaseBridgeConfiguration, firebaseNotificationTargets, vapidConfiguration} from "./configuration.js";
import {FirebasePushDispatch, FirebasePushDispatchResult} from "../../src/notifications/contracts/firebasePush.js";
import {readFirebaseBridgeResponse} from "./firebasePush.js";
import {Campaign, Installation, permittedPushEndpoint, Revision} from "./model.js";
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
    } else if (installation.transport === "android") {
      const configuration = androidBridgeConfiguration();
      if (!configuration) outcome = "failed";
      else if (!await admit()) outcome = "skipped";
      else {
        const {sendAndroidManagerNotification} = await import("../../platforms/native/android/server/managerAndroidDelivery.js");
        outcome = (await sendAndroidManagerNotification({version: 1, tokenHash: installation.nativeRef,
          revision: claim.revision, notificationId: campaignId, title: campaign.title, body: campaign.body,
          imageUrl: campaign.imageUrl, expiresAtMs}, configuration, deadlineSignal(workDeadline, 8000))).outcome;
      }
    } else if (installation.transport === "firebase") {
      const configuration = firebaseBridgeConfiguration();
      if (!configuration || !firebaseNotificationTargets().includes(installation.target)) outcome = "failed";
      else if (!await admit()) outcome = "skipped";
      else {
        const input = FirebasePushDispatch.parse({version: 1, deviceHash: installation.nativeRef, revision: claim.revision,
          notificationId: campaignId, title: campaign.title, body: campaign.body, imageUrl: campaign.imageUrl, expiresAtMs});
        const response = await fetch(configuration.dispatchEndpoint, {method: "POST", headers: {
          Authorization: `Bearer ${configuration.secret}`, "Content-Type": "application/json", Accept: "application/json"},
          body: JSON.stringify(input), redirect: "error", signal: deadlineSignal(workDeadline, 8000)});
        outcome = FirebasePushDispatchResult.parse(await readFirebaseBridgeResponse(response)).outcome;
      }
    } else if (admittedOrigins()[installation.target] !== installation.origin || !permittedPushEndpoint(installation.subscription.endpoint)) {
      outcome = "skipped";
    } else {
      const config = vapidConfiguration();
      const {generateRequestDetails} = await import("web-push");
      const payload = JSON.stringify({version: 1, kind: "notification", notificationId: campaignId,
        target: installation.target, installationId, title: campaign.title, body: campaign.body, imageUrl: campaign.imageUrl,
        expiresAtMs});
      const details = generateRequestDetails(installation.subscription, payload, {vapidDetails: {
        subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey},
        TTL: Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)), urgency: "normal", topic: campaignId.slice(0, 32)});
      if (details.endpoint !== installation.subscription.endpoint || !permittedPushEndpoint(details.endpoint)) throw new Error("notification-endpoint-invalid");
      if (!await admit()) outcome = "skipped";
      else {
        const response = await fetch(details.endpoint, {method: "POST", headers: details.headers,
          body: details.body ? new Uint8Array(details.body) : undefined, redirect: "error", signal: deadlineSignal(workDeadline, 8000)});
        if (response.status >= 200 && response.status < 300) outcome = "accepted";
        else if (response.status === 404 || response.status === 410) {
          outcome = "failed";
          await notificationRpc(workDeadline, "notification_disable_subscription", {p_id: installationId,
            p_revision: claim.revision, p_endpoint_hash: installation.endpointHash}).catch(() => undefined);
        } else outcome = response.status >= 500 || response.status === 408 ? "uncertain" : "failed";
        void response.body?.cancel().catch(() => undefined);
      }
    }
  } catch {outcome = "uncertain";}
  await notificationRpc(deadline, "notification_finish_delivery", {p_attempt_id: claim.attemptId, p_outcome: outcome});
}

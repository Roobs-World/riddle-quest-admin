import {z} from "zod";
import {notificationRpc} from "./database.js";
import {digest} from "./security.js";
import {ActivityInput, Hash, Revision, SubscribeInput, UnsubscribeInput} from "./model.js";
import type {Deadline} from "./deadline.js";

const Receipt = z.object({installationId: Hash, revision: Revision}).strict();

export async function subscribeInstallation(token: string, origin: string, input: z.infer<typeof SubscribeInput>, deadline: Deadline) {
  return Receipt.parse(await notificationRpc(deadline, "notification_subscribe", {p_id: digest(token), p_origin: origin,
    p_target: input.target, p_revision: input.revision, p_locale: input.locale,
    p_subscription: input.subscription, p_endpoint_hash: digest(input.subscription.endpoint)}));
}

export async function unsubscribeInstallation(token: string, origin: string, input: z.infer<typeof UnsubscribeInput>, deadline: Deadline) {
  return Receipt.parse(await notificationRpc(deadline, "notification_unsubscribe", {p_id: digest(token), p_origin: origin,
    p_target: input.target, p_revision: input.revision}));
}

export async function recordInstallationActivity(token: string, origin: string, input: z.infer<typeof ActivityInput>, deadline: Deadline): Promise<void> {
  z.object({ok: z.literal(true)}).strict().parse(await notificationRpc(deadline, "notification_activity", {
    p_id: digest(token), p_origin: origin, p_target: input.target, p_locale: input.locale}));
}

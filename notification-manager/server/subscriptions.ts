import {z} from "zod";
import {notificationRpc} from "./database.js";
import {digest} from "./security.js";
import {Hash, Revision, UnsubscribeInput} from "./model.js";
import type {Deadline} from "./deadline.js";

const Receipt = z.object({installationId: Hash, revision: Revision}).strict();

export async function unsubscribeInstallation(token: string, origin: string, input: z.infer<typeof UnsubscribeInput>, deadline: Deadline) {
  return Receipt.parse(await notificationRpc(deadline, "notification_unsubscribe", {p_id: digest(token), p_origin: origin,
    p_target: input.target, p_revision: input.revision}));
}

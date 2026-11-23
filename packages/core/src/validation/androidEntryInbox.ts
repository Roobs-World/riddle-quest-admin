import {z} from "zod";

/** Only the app's existing opaque invitation URLs can survive a cold launch. */
const entryUrl = z.string().max(512).regex(/^riddlequest:\/\/(?:race\?challengeId=live_[a-f0-9]{64}|referral\?token=[A-Za-z0-9_-]{43})$/);
/** One atomic device-private record prevents a handled Play receipt from reopening its entry. */
export const AndroidEntryInboxEnvelopeSchema = z.object({
  version: z.literal(1),
  pending: z.object({id: z.string().min(1).max(128), url: entryUrl}).strict().nullable(),
  consumedInstallEntryUrl: entryUrl.nullable(),
}).strict();
/** Validated device-private entry receipt and pending preview, never a server grant. */
export type AndroidEntryInboxEnvelope = z.infer<typeof AndroidEntryInboxEnvelopeSchema>;

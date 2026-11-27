import type {JestEntryIntent} from "./types";

/** Describes registration source. */
export type RegistrationSource = "post_instructions" | "returning_player" | "profile" | "subscription" | "authoritative_win";

/** Creates registration entry payload. */
export function createRegistrationEntryPayload(
  source: RegistrationSource,
  intent: JestEntryIntent,
): Record<string, string> {
  return {
    source,
    campaign: intent.campaign ?? "direct_to_game_registration_v2",
    reference: `registration_${source}_v1`,
    ...(intent.inviteKind ? {inviteKind: intent.inviteKind} : {}),
    ...(intent.reference ? {acquisition_reference: intent.reference} : {}),
    ...(intent.gameMode ? {gameMode: intent.gameMode} : {}),
    ...(intent.challengeDestination ? {challengeDestination: intent.challengeDestination} : {}),
    ...(intent.customName ? {customName: intent.customName} : {}),
    ...(intent.inviterName ? {inviterName: intent.inviterName} : {}),
    ...(intent.challengeId ? {challengeId: intent.challengeId} : {}),
    ...(intent.riddleId ? {riddleId: intent.riddleId} : {}),
    ...(intent.utmSource ? {utm_source: intent.utmSource} : {}),
    ...(intent.utmMedium ? {utm_medium: intent.utmMedium} : {}),
    ...(intent.utmCampaign ? {utm_campaign: intent.utmCampaign} : {}),
    ...(intent.utmTerm ? {utm_term: intent.utmTerm} : {}),
    ...(intent.utmContent ? {utm_content: intent.utmContent} : {}),
  };
}

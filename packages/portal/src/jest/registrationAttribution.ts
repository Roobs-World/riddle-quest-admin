import type {JestEntryIntent} from "./types";

export type RegistrationSource = "post_instructions" | "authoritative_win";

export function createRegistrationEntryPayload(
  source: RegistrationSource,
  intent: JestEntryIntent,
): Record<string, string> {
  return {
    source,
    campaign: intent.campaign ?? "direct_to_game_registration_v2",
    reference: `registration_${source}_v1`,
    ...(intent.reference ? {acquisition_reference: intent.reference} : {}),
    ...(intent.gameMode ? {gameMode: intent.gameMode} : {}),
    ...(intent.challengeDestination ? {challengeDestination: intent.challengeDestination} : {}),
    ...(intent.customName ? {customName: intent.customName} : {}),
    ...(intent.inviterName ? {inviterName: intent.inviterName} : {}),
    ...(intent.challengeId ? {challengeId: intent.challengeId} : {}),
    ...(intent.utmSource ? {utm_source: intent.utmSource} : {}),
    ...(intent.utmMedium ? {utm_medium: intent.utmMedium} : {}),
    ...(intent.utmCampaign ? {utm_campaign: intent.utmCampaign} : {}),
    ...(intent.utmTerm ? {utm_term: intent.utmTerm} : {}),
    ...(intent.utmContent ? {utm_content: intent.utmContent} : {}),
  };
}

import type {JestEntryIntent} from "./types";

/** Provides clean behavior. */
const clean = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;

/** Parses entry intent. */
export function parseEntryIntent(value: unknown, search = ""): JestEntryIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const query = new URLSearchParams(search);
  const acquisition = (key: string) => clean(source[key] ?? query.get(key), 160);
  const mode = source.gameMode;
  const inviteKind = source.inviteKind;
  return {
    inviteKind: inviteKind === "result" || inviteKind === "race" || inviteKind === "open"
      ? inviteKind
      : undefined,
    gameMode: mode === "classic" || mode === "challenge" ? mode : undefined,
    campaign: clean(source.campaign, 80),
    reference: clean(source.reference, 80),
    challengeDestination: clean(source.challengeDestination, 160),
    customName: clean(source.customName, 80),
    inviterName: clean(source.inviterName, 80),
    challengeId: clean(source.challengeId, 160),
    riddleId: clean(source.riddleId, 160),
    notificationTemplate: clean(source.notification_template, 80),
    notificationOffset: clean(source.notification_offset, 16),
    callback: clean(source.callback, 80),
    utmSource: acquisition("utm_source"),
    utmMedium: acquisition("utm_medium"),
    utmCampaign: acquisition("utm_campaign"),
    utmTerm: acquisition("utm_term"),
    utmContent: acquisition("utm_content"),
  };
}

/** Resolves only challenge IDs that were explicitly attributed to a Race-to-10 invite. */
export function resolveRaceChallengeId(intent: JestEntryIntent): string | undefined {
  const isRaceInvite = intent.inviteKind === "race" || intent.campaign === "race_to_10_v1";
  return isRaceInvite ? intent.challengeId : undefined;
}

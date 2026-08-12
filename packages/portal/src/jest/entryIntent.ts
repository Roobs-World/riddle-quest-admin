import type {JestEntryIntent} from "./types";

/** Provides clean behavior. */
const clean = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;

/** Accepts only telemetry-safe campaign, reference, and opaque identifier characters. */
const cleanCode = (value: unknown, max: number): string | undefined => {
  const candidate = clean(value, max);
  return candidate && /^[a-zA-Z0-9][a-zA-Z0-9._:~-]*$/.test(candidate) ? candidate : undefined;
};

/** Parses entry intent. */
export function parseEntryIntent(value: unknown, search = ""): JestEntryIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const query = new URLSearchParams(search);
  const acquisition = (key: string) => cleanCode(source[key] ?? query.get(key), 80);
  const mode = source.gameMode;
  const inviteKind = source.inviteKind;
  return {
    inviteKind: inviteKind === "result" || inviteKind === "race" || inviteKind === "open"
      ? inviteKind
      : undefined,
    gameMode: mode === "classic" || mode === "challenge" ? mode : undefined,
    campaign: cleanCode(source.campaign, 80),
    reference: cleanCode(source.reference, 80),
    challengeDestination: cleanCode(source.challengeDestination, 160),
    customName: clean(source.customName, 80),
    inviterName: clean(source.inviterName, 80),
    challengeId: cleanCode(source.challengeId, 160),
    riddleId: cleanCode(source.riddleId, 160),
    notificationTemplate: cleanCode(source.notification_template, 80),
    notificationOffset: cleanCode(source.notification_offset, 16),
    callback: cleanCode(source.callback, 80),
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

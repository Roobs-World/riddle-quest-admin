import type {JestEntryIntent} from "./types";

const clean = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;

export function parseEntryIntent(value: unknown, search = ""): JestEntryIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const query = new URLSearchParams(search);
  const acquisition = (key: string) => clean(source[key] ?? query.get(key), 160);
  const mode = source.gameMode;
  return {
    gameMode: mode === "classic" || mode === "challenge" ? mode : undefined,
    campaign: clean(source.campaign, 80),
    reference: clean(source.reference, 80),
    challengeDestination: clean(source.challengeDestination, 160),
    customName: clean(source.customName, 80),
    inviterName: clean(source.inviterName, 80),
    challengeId: clean(source.challengeId, 160),
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

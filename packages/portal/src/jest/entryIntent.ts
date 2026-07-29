import type {JestEntryIntent} from "./types";

const clean = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;

export function parseEntryIntent(value: unknown): JestEntryIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const mode = source.gameMode;
  return {
    gameMode: mode === "classic" || mode === "challenge" ? mode : undefined,
    campaign: clean(source.campaign, 80),
    reference: clean(source.reference, 80),
    challengeDestination: clean(source.challengeDestination, 160),
    customName: clean(source.customName, 80),
    inviterName: clean(source.inviterName, 80),
    challengeId: clean(source.challengeId, 160),
  };
}

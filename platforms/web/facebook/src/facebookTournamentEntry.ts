import {RaceLocaleSchema, type RaceLocale} from "../../../../src/core/race";

/** Reads only a live, bounded native-tournament destination; no entry field supplies authority. */
export function facebookTournamentLocaleFromEntryData(value: unknown, nowMs = Date.now()): RaceLocale | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Number.isSafeInteger(nowMs)) return undefined;
  /** Native sharing publishes exactly these presentation fields. */
  const entry = value as Record<string, unknown>;
  /** The provider envelope cannot attach a challenge, score, identity or reward to this destination. */
  const keys = ["kind", "locale", "tournamentId", "startsAtMs", "endsAtMs"];
  if (Object.keys(entry).length !== keys.length || !keys.every(key => Object.hasOwn(entry, key)) ||
    entry.kind !== "rq-race10-tournament-v1") return undefined;
  /** Supported race language is a routing hint, never a requested locale change. */
  const locale = RaceLocaleSchema.safeParse(entry.locale);
  if (!locale.success || typeof entry.startsAtMs !== "number" || typeof entry.endsAtMs !== "number" ||
    !Number.isSafeInteger(entry.startsAtMs) || !Number.isSafeInteger(entry.endsAtMs) ||
    entry.startsAtMs < 0 || entry.endsAtMs > 253_402_300_799_999 ||
    entry.startsAtMs % 86_400_000 !== 0 || entry.endsAtMs !== entry.startsAtMs + 86_400_000 ||
    nowMs < entry.startsAtMs || nowMs >= entry.endsAtMs) return undefined;
  return entry.tournamentId === `facebook-race10-${locale.data}-${new Date(entry.startsAtMs).toISOString().slice(0, 10)}`
    ? locale.data : undefined;
}

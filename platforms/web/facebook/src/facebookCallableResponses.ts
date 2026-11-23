import {
  ListFacebookContextBoardResponseSchema,
  ListFacebookTournamentResponseSchema,
  RecordFacebookContextRunResponseSchema,
  RecordFacebookTournamentRunResponseSchema,
  RACE_CHALLENGE_TTL_MS,
  type ListFacebookContextBoardResponse,
  type ListFacebookTournamentResponse,
  type RecordFacebookContextRunResponse,
  type RecordFacebookTournamentRunResponse,
} from "../../../../src/core/race";
import type {FacebookPurchaseGrant} from "./FacebookPurchaseRecovery";

/** Defines the facebook tournament duration ms value. */
const FACEBOOK_TOURNAMENT_DURATION_MS = 24 * 60 * 60 * 1_000;
/** Defines the facebook firestore timestamp max ms value. */
const FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS = 253_402_300_799_999;

/** Accepts only the authoritative grant before native consumption or balance updates. */
export function parseFacebookPurchaseGrant(value: unknown): Required<FacebookPurchaseGrant> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
    !("granted" in value) || value.granted !== true ||
    !("providerReceiptId" in value) || typeof value.providerReceiptId !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.providerReceiptId) ||
    !("consume" in value) || typeof value.consume !== "boolean" ||
    !("newCoins" in value) || typeof value.newCoins !== "number" ||
    !Number.isSafeInteger(value.newCoins) || value.newCoins < 0 ||
    !("coinsAwarded" in value) || typeof value.coinsAwarded !== "number" ||
    !Number.isSafeInteger(value.coinsAwarded) || value.coinsAwarded < 0 ||
    !("removeInterstitialAds" in value) || typeof value.removeInterstitialAds !== "boolean" ||
    Object.keys(value).length !== 6) throw new Error("Invalid Facebook purchase grant response.");
  return {
    granted: true,
    providerReceiptId: value.providerReceiptId,
    consume: value.consume,
    newCoins: value.newCoins,
    coinsAwarded: value.coinsAwarded,
    removeInterstitialAds: value.removeInterstitialAds,
  };
}

/** Parses only the authoritative balance; no arbitrary provider reward/receipt is accepted. */
export function parseFacebookRewardedContinue(value: unknown): {
/** Validated authoritative balance returned after the continuation grant. */
newCoins: number} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid Facebook continuation response.");
  /** Untrusted response fields inspected before accepting an authoritative balance. */
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.newCoins !== "number" || !Number.isSafeInteger(record.newCoins) || record.newCoins < 0)
    throw new Error("Invalid Facebook continuation response.");
  return {newCoins: record.newCoins};
}

/** Describes facebook notification prompt claim. */
export type FacebookNotificationPromptClaim =
  | {
      /** Stores granted. */
      granted: false;
    }
  | {
      /** Stores granted. */
      granted: true; /** Stores claimed at ms. */
      /** Stores claimed at ms. */
      claimedAtMs: number;
    };

/** Rejects extra fields and unsafe server clocks before prompt state is persisted. */
export function parseFacebookNotificationPromptClaim(value: unknown): FacebookNotificationPromptClaim {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid Facebook notification prompt claim response.");
  }
  /** Provides record behavior. */
  const record = value as Record<string, unknown>;
  if (record.granted === false && Object.keys(record).length === 1) return {granted: false};
  if (
    record.granted === true &&
    Object.keys(record).length === 2 &&
    typeof record.claimedAtMs === "number" &&
    Number.isSafeInteger(record.claimedAtMs) &&
    record.claimedAtMs >= 0 &&
    record.claimedAtMs <= FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS
  ) {
    return {granted: true, claimedAtMs: record.claimedAtMs};
  }
  throw new Error("Invalid Facebook notification prompt claim response.");
}

/** Parses facebook notification prompt acceptance. */
export function parseFacebookNotificationPromptAcceptance(value: unknown): void {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    (value as Record<string, unknown>).accepted !== true
  ) {
    throw new Error("Invalid Facebook notification prompt acceptance response.");
  }
}

/** Describes facebook client configuration. */
export type FacebookClientConfiguration = {
  /** Stores interstitials enabled. */
  interstitialsEnabled: boolean;
  /** Stores notifications enabled. */
  notificationsEnabled: boolean;
  /** Stores commerce enabled. */
  commerceEnabled: boolean;
  /** Stores rewarded ads enabled. */
  rewardedAdsEnabled: boolean;
  /** Stores referrals enabled. */
  referralsEnabled: boolean;
  /** Stores matchmaking enabled. */
  matchmakingEnabled: boolean;
  /** Stores tournaments enabled. */
  tournamentsEnabled: boolean;
  /** Stores presence enabled. */
  presenceEnabled: boolean;
  /** Stores remove interstitial ads. */
  removeInterstitialAds: boolean;
};

/** Provides configuration keys behavior. */
const configurationKeys: ReadonlyArray<keyof FacebookClientConfiguration> = [
  "interstitialsEnabled",
  "notificationsEnabled",
  "commerceEnabled",
  "rewardedAdsEnabled",
  "referralsEnabled",
  "matchmakingEnabled",
  "tournamentsEnabled",
  "presenceEnabled",
  "removeInterstitialAds",
];

/** Fails all optional features closed when the server projection is malformed or drifts. */
export function parseFacebookClientConfiguration(value: unknown): FacebookClientConfiguration {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid Facebook client configuration response.");
  }
  /** Provides record behavior. */
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== configurationKeys.length ||
    !configurationKeys.every((key) => typeof record[key] === "boolean")
  ) {
    throw new Error("Invalid Facebook client configuration response.");
  }
  return Object.fromEntries(configurationKeys.map((key) => [key, record[key]])) as FacebookClientConfiguration;
}

/** Parses social response. */
const parseSocialResponse = <T>(
  schema: {
    /** Provides safe parse behavior. */
    safeParse(value: unknown):
      | {
          /** Stores success. */
          success: true; /** Stores data. */
          /** Stores data. */
          data: T;
        }
      | {
          /** Stores success. */
          success: false;
        };
  },
  value: unknown,
  operation: string,
): T => {
  /** Parses d. */
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid Facebook ${operation} response.`);
  return parsed.data;
};

/** Describes facebook standing. */
type FacebookStanding = ListFacebookTournamentResponse["standings"][number];

/** Provides standings equal behavior. */
const standingsEqual = (left: FacebookStanding, right: FacebookStanding): boolean =>
  left.rank === right.rank &&
  left.adjustedTimeMs === right.adjustedTimeMs &&
  left.isCurrentPlayer === right.isCurrentPlayer;

/** Enforces the server's competition-ranking algorithm and current-player projection. */
const assertStandingsSemantics = (
  standings: FacebookStanding[],
  currentPlayer: FacebookStanding | undefined,
  operation: string,
): void => {
  /** Provides previous time behavior. */
  let previousTime: number | undefined;
  /** Provides previous rank behavior. */
  let previousRank = 0;
  /** Provides projected current behavior. */
  let projectedCurrent: FacebookStanding | undefined;
  standings.forEach((standing, index) => {
    /** Provides expected rank behavior. */
    const expectedRank = standing.adjustedTimeMs === previousTime ? previousRank : index + 1;
    if (
      standing.rank !== expectedRank ||
      (previousTime !== undefined && standing.adjustedTimeMs < previousTime) ||
      (standing.isCurrentPlayer && projectedCurrent !== undefined)
    ) {
      throw new Error(`Invalid Facebook ${operation} response.`);
    }
    if (standing.isCurrentPlayer) projectedCurrent = standing;
    previousTime = standing.adjustedTimeMs;
    previousRank = standing.rank;
  });
  if (
    (currentPlayer !== undefined && !currentPlayer.isCurrentPlayer) ||
    (projectedCurrent === undefined) !== (currentPlayer === undefined) ||
    (projectedCurrent !== undefined && currentPlayer !== undefined && !standingsEqual(projectedCurrent, currentPlayer))
  ) {
    throw new Error(`Invalid Facebook ${operation} response.`);
  }
};

/** Asserts board window. */
const assertBoardWindow = (startsAtMs: number, endsAtMs: number, durationMs: number, operation: string): void => {
  if (startsAtMs > FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS - durationMs || endsAtMs !== startsAtMs + durationMs) {
    throw new Error(`Invalid Facebook ${operation} response.`);
  }
};

/** Parses facebook tournament response. */
export const parseFacebookTournamentResponse = (value: unknown): ListFacebookTournamentResponse => {
  /** Parses d. */
  const parsed = parseSocialResponse(ListFacebookTournamentResponseSchema, value, "tournament standings");
  assertBoardWindow(parsed.startsAtMs, parsed.endsAtMs, FACEBOOK_TOURNAMENT_DURATION_MS, "tournament standings");
  /** Provides expected tournament id behavior. */
  const expectedTournamentId = `facebook-race10-${parsed.locale}-${new Date(parsed.startsAtMs).toISOString().slice(0, 10)}`;
  if (parsed.startsAtMs % FACEBOOK_TOURNAMENT_DURATION_MS !== 0 || parsed.tournamentId !== expectedTournamentId) {
    throw new Error("Invalid Facebook tournament standings response.");
  }
  assertStandingsSemantics(parsed.standings, parsed.currentPlayer, "tournament standings");
  return parsed;
};
/** Parses facebook tournament record response. */
export const parseFacebookTournamentRecordResponse = (value: unknown): RecordFacebookTournamentRunResponse => {
  /** Parses d. */
  const parsed = parseSocialResponse(RecordFacebookTournamentRunResponseSchema, value, "tournament record");
  if (parsed.completedAtMs > FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS - FACEBOOK_TOURNAMENT_DURATION_MS) {
    throw new Error("Invalid Facebook tournament record response.");
  }
  /** Starts s at ms. */
  const startsAtMs =
    Math.floor(parsed.completedAtMs / FACEBOOK_TOURNAMENT_DURATION_MS) * FACEBOOK_TOURNAMENT_DURATION_MS;
  /** Provides expected tournament id behavior. */
  const expectedTournamentId = `facebook-race10-${parsed.locale}-${new Date(startsAtMs).toISOString().slice(0, 10)}`;
  if (parsed.tournamentId !== expectedTournamentId) {
    throw new Error("Invalid Facebook tournament record response.");
  }
  return parsed;
};
/** Parses facebook context board response. */
export const parseFacebookContextBoardResponse = (value: unknown): ListFacebookContextBoardResponse => {
  /** Parses d. */
  const parsed = parseSocialResponse(ListFacebookContextBoardResponseSchema, value, "context board");
  assertBoardWindow(parsed.startsAtMs, parsed.endsAtMs, RACE_CHALLENGE_TTL_MS, "context board");
  assertStandingsSemantics(parsed.standings, parsed.currentPlayer, "context board");
  return parsed;
};
/** Parses facebook context record response. */
export const parseFacebookContextRecordResponse = (value: unknown): RecordFacebookContextRunResponse => {
  /** Parses d. */
  const parsed = parseSocialResponse(RecordFacebookContextRunResponseSchema, value, "context record");
  if (parsed.completedAtMs > FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS) {
    throw new Error("Invalid Facebook context record response.");
  }
  return parsed;
};

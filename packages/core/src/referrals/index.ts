/** Stable Jest referral campaign identifiers shared by the client and trusted backend. */
export const JEST_REFERRAL_REFERENCES = {
  friendChallenge: "riddle_quest_friend_challenge_v2",
  raceTo10: "riddle_quest_race_to_10_v1",
} as const;

/** Prefixes for one immutable Jest referral link per personalized share. */
export const JEST_REFERRAL_SHARE_PREFIXES = {
  result: `${JEST_REFERRAL_REFERENCES.friendChallenge}_result_`,
  race: `${JEST_REFERRAL_REFERENCES.raceTo10}_share_`,
} as const;

/** Fixed-width opaque suffix accepted for personalized referral references. */
const JEST_REFERRAL_SHARE_TOKEN = /^[0-9a-f]{16}$/;

/** Coins granted to both players after a signed referral converts to a registration. */
export const JEST_REFERRAL_REWARD_COINS = 100;

/** Describes jest referral reference. */
export type JestLegacyReferralReference = (typeof JEST_REFERRAL_REFERENCES)[keyof typeof JEST_REFERRAL_REFERENCES];
/** Describes a bounded personalized reference that Jest will never upsert across shares. */
export type JestPersonalizedReferralReference =
  `${(typeof JEST_REFERRAL_SHARE_PREFIXES)[keyof typeof JEST_REFERRAL_SHARE_PREFIXES]}${string}`;
/** Describes any signed referral campaign eligible for an idempotent backend reward. */
export type JestReferralReference = JestLegacyReferralReference | JestPersonalizedReferralReference;

/** Defines the jest rewarded referral references value. */
export const JEST_REWARDED_REFERRAL_REFERENCES = Object.freeze(
  Object.values(JEST_REFERRAL_REFERENCES),
) as readonly JestLegacyReferralReference[];

/** Builds one length-bounded, telemetry-safe personalized Jest upsert key. */
export function createJestReferralShareReference(
  kind: keyof typeof JEST_REFERRAL_SHARE_PREFIXES,
  token: string,
): JestPersonalizedReferralReference {
  if (!JEST_REFERRAL_SHARE_TOKEN.test(token)) throw new Error("invalid-jest-referral-share-token");
  return `${JEST_REFERRAL_SHARE_PREFIXES[kind]}${token}`;
}

/** Accepts legacy campaigns and the two strictly formatted personalized families. */
export function isJestRewardedReferralReference(value: unknown): value is JestReferralReference {
  if (typeof value !== "string") return false;
  if ((JEST_REWARDED_REFERRAL_REFERENCES as readonly string[]).includes(value)) return true;
  if (value.startsWith(JEST_REFERRAL_SHARE_PREFIXES.result)) {
    return JEST_REFERRAL_SHARE_TOKEN.test(value.slice(JEST_REFERRAL_SHARE_PREFIXES.result.length));
  }
  return (
    value.startsWith(JEST_REFERRAL_SHARE_PREFIXES.race) &&
    JEST_REFERRAL_SHARE_TOKEN.test(value.slice(JEST_REFERRAL_SHARE_PREFIXES.race.length))
  );
}

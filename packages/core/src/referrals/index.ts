/** Stable Jest referral campaign identifiers shared by the client and trusted backend. */
export const JEST_REFERRAL_REFERENCES = {
  friendChallenge: "riddle_quest_friend_challenge_v2",
  raceTo10: "riddle_quest_race_to_10_v1",
} as const;

/** Coins granted to both players after a signed referral converts to a registration. */
export const JEST_REFERRAL_REWARD_COINS = 100;

/** Describes jest referral reference. */
export type JestReferralReference =
  (typeof JEST_REFERRAL_REFERENCES)[keyof typeof JEST_REFERRAL_REFERENCES];

/** Defines the jest rewarded referral references value. */
export const JEST_REWARDED_REFERRAL_REFERENCES = Object.freeze(
  Object.values(JEST_REFERRAL_REFERENCES),
) as readonly JestReferralReference[];

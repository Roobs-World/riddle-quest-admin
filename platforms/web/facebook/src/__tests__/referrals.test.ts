import {facebookReferralTokenFromEntryData, facebookLaunchFromEntryData, parseFacebookReferralTokenResponse} from "../referrals";

it("accepts only the exact opaque referral token field", () => {
  /** Provides token behavior. */
  const token = "A".repeat(43);
  expect(facebookReferralTokenFromEntryData({referralToken: token, inviterName: "untrusted"})).toBe(token);
  expect(facebookReferralTokenFromEntryData({referralToken: `${token}!`})).toBeUndefined();
  expect(facebookReferralTokenFromEntryData({referralToken: "short"})).toBeUndefined();
  expect(facebookReferralTokenFromEntryData([token])).toBeUndefined();
  expect(facebookReferralTokenFromEntryData(null)).toBeUndefined();
});

it("accepts bounded destinations while ignoring untrusted scores and provider identity", () => {
  expect(facebookLaunchFromEntryData({challengeId: "challenge-1", coins: 999, opponentUserId: "facebook_private", result: "player_win"}))
    .toEqual({initialGameMode: "classic", initialRaceChallengeId: "challenge-1"});
  expect(facebookLaunchFromEntryData({gameMode: "challenge", challengeId: "../invalid"})).toEqual({initialGameMode: "challenge"});
  expect(facebookLaunchFromEntryData(null)).toEqual({initialGameMode: "classic"});
  expect(facebookLaunchFromEntryData({challengeId: "a".repeat(161)})).toEqual({initialGameMode: "classic"});
});

it.each([null, [], {token: "short", expiresAtMs: 100}, {token: "a".repeat(43), expiresAtMs: 0},
  {token: "a".repeat(43), expiresAtMs: "100"}])("rejects invalid server referral responses", value => {
  expect(() => parseFacebookReferralTokenResponse(value, 1)).toThrow("facebook-referral-response-invalid");
});


it("ignores retired tournament launches without accepting nested challenge data", () => {
  expect(facebookLaunchFromEntryData({kind: "rq-race10-tournament-v1", locale: "en",
    gameMode: "challenge", challengeId: "challenge-1"})).toEqual({initialGameMode: "classic"});
});

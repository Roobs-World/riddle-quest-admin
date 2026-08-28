import {facebookReferralTokenFromEntryData} from "../referrals";

it("accepts only the exact opaque referral token field", () => {
  /** Provides token behavior. */
  const token = "A".repeat(43);
  expect(facebookReferralTokenFromEntryData({referralToken: token, inviterName: "untrusted"})).toBe(token);
  expect(facebookReferralTokenFromEntryData({referralToken: `${token}!`})).toBeUndefined();
  expect(facebookReferralTokenFromEntryData({referralToken: "short"})).toBeUndefined();
  expect(facebookReferralTokenFromEntryData([token])).toBeUndefined();
  expect(facebookReferralTokenFromEntryData(null)).toBeUndefined();
});

import {
  FACEBOOK_FEATURES,
  isFacebookFeatureEnabled,
  parseFacebookDisabledFeatures,
} from "../facebook/facebookFeatureFlags";

describe("Facebook emergency kill switches", () => {
  it("covers every provider capability required by release operations", () => {
    expect(FACEBOOK_FEATURES).toEqual([
      "identity",
      "commerce",
      "rewarded_ads",
      "interstitials",
      "referrals",
      "notifications",
      "matchmaking",
      "tournaments",
      "presence",
    ]);
  });

  it("defaults enabled and independently disables comma-separated features", () => {
    expect(isFacebookFeatureEnabled("identity", undefined)).toBe(true);
    expect(isFacebookFeatureEnabled("commerce", " commerce, tournaments ")).toBe(false);
    expect(isFacebookFeatureEnabled("tournaments", "commerce,tournaments")).toBe(false);
    expect(isFacebookFeatureEnabled("identity", "commerce,tournaments")).toBe(true);
    expect([...parseFacebookDisabledFeatures("commerce,commerce")]).toEqual(["commerce"]);
  });

  it("fails deployment closed on misspelled feature names", () => {
    expect(() => parseFacebookDisabledFeatures("commerce,tournments")).toThrow("unknown-facebook-feature:tournments");
  });
});

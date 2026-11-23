import {
  isRedditFeatureEnabled,
  parseRedditApprovedFeatures,
  parseRedditDisabledFeatures,
  REDDIT_FEATURES,
  resolveRedditClientFeatures,
} from "../redditFeatureFlags";

describe("Reddit emergency kill switches", () => {
  it("covers every provider capability independently", () => {
    expect(REDDIT_FEATURES).toEqual([
      "identity",
      "gameplay",
      "commerce",
      "referrals",
      "notifications",
      "matchmaking",
      "tournaments",
      "presence",
    ]);
    /** Provides features behavior. */
    const features = resolveRedditClientFeatures("gameplay,presence", "commerce,notifications");
    expect(features).toEqual({
      identity: true,
      gameplay: false,
      commerce: true,
      referrals: true,
      notifications: true,
      matchmaking: true,
      tournaments: true,
      presence: false,
    });
  });

  it("keeps commerce and notifications disabled until separately approved", () => {
    expect(resolveRedditClientFeatures()).toMatchObject({commerce: false, notifications: false});
    expect(resolveRedditClientFeatures(undefined, "notifications")).toMatchObject({
      commerce: false,
      notifications: true,
    });
    expect(resolveRedditClientFeatures("notifications", "notifications")).toMatchObject({notifications: false});
    expect([...parseRedditApprovedFeatures("commerce,commerce")]).toEqual(["commerce"]);
    expect(() => parseRedditApprovedFeatures("presence")).toThrow("unknown-reddit-approved-feature:presence");
  });

  it("allows commerce sandbox testing without implying production approval", () => {
    expect(resolveRedditClientFeatures(undefined, undefined, "sandbox", "1")).toMatchObject({
      commerce: true,
      notifications: false,
    });
    expect(resolveRedditClientFeatures(undefined, undefined, "sandbox", "0")).toMatchObject({commerce: false});
    expect(resolveRedditClientFeatures(undefined, undefined, "production", "1")).toMatchObject({commerce: false});
    expect(resolveRedditClientFeatures("commerce", undefined, "sandbox", "1")).toMatchObject({commerce: false});
  });

  it("defaults enabled and rejects misspelled switches", () => {
    expect(isRedditFeatureEnabled("identity", undefined)).toBe(true);
    expect(isRedditFeatureEnabled("commerce", "commerce,tournaments")).toBe(false);
    expect(isRedditFeatureEnabled("identity", "commerce,tournaments")).toBe(true);
    expect([...parseRedditDisabledFeatures("commerce,commerce")]).toEqual(["commerce"]);
    expect(() => parseRedditDisabledFeatures("gameply")).toThrow("unknown-reddit-feature:gameply");
  });
});

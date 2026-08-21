import {parseRedditPlayerData, parseRedditPreferences} from "../reddit/redditStorageEndpoint";

describe("Reddit storage validation", () => {
  it("accepts only platform-neutral preferences", () => {
    expect(parseRedditPreferences({
      locale: "ar",
      muted: true,
      reducedMotion: false,
      highContrast: true,
      onboardingComplete: true,
      firstMilestoneMarked: false,
      presenceEnabled: true,
    })).toEqual({
      locale: "ar",
      muted: true,
      reducedMotion: false,
      highContrast: true,
      onboardingComplete: true,
      firstMilestoneMarked: false,
      presenceEnabled: true,
    });
  });

  it.each([
    null,
    [],
    {locale: "EN_us"},
    {locale: "en", muted: "yes"},
    {registered: true},
    {jestPlayerId: "player"},
    {facebookPlayerId: "player"},
  ])("rejects invalid or provider-specific preferences: %p", (value) => {
    expect(() => parseRedditPreferences(value)).toThrow("invalid-reddit-preferences");
  });

  it("accepts a bounded neutral player snapshot and explicit clearing", () => {
    const snapshot = {
      schemaVersion: 1,
      updatedAt: 1_750_000_000_000,
      profile: {displayName: "Riddle fan"},
      activeGame: null,
    };
    expect(parseRedditPlayerData(snapshot)).toBe(snapshot);
    expect(parseRedditPlayerData(null)).toBeNull();
  });

  it.each([
    {},
    {schemaVersion: 2, updatedAt: 1},
    {schemaVersion: 1, updatedAt: -1},
    {schemaVersion: 1, updatedAt: 1.5},
    {schemaVersion: 1, updatedAt: 1, providerUserId: "t2_private"},
    {schemaVersion: 1, updatedAt: 1, profile: "x".repeat(49 * 1_024)},
  ])("rejects invalid, provider-bearing, or oversized player data", (value) => {
    expect(() => parseRedditPlayerData(value)).toThrow("invalid-reddit-player-data");
  });
});

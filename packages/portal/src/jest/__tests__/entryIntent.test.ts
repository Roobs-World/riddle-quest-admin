import {parseEntryIntent} from "../entryIntent";

describe("parseEntryIntent", () => {
  it.each([undefined, null, "challenge", []])("rejects a non-record root value", (value) => {
    expect(parseEntryIntent(value)).toEqual({});
  });
  it("allowlists supported fields", () => expect(parseEntryIntent({
    gameMode: "challenge",
    campaign: "summer",
    inviterName: "Sam",
    challengeId: "daily-42",
    evil: "no",
  })).toEqual({
    inviteKind: undefined,
    gameMode: "challenge",
    campaign: "summer",
    reference: undefined,
    challengeDestination: undefined,
    customName: undefined,
    inviterName: "Sam",
    challengeId: "daily-42",
    riddleId: undefined,
    notificationTemplate: undefined,
    notificationOffset: undefined,
    callback: undefined,
    utmSource: undefined,
    utmMedium: undefined,
    utmCampaign: undefined,
    utmTerm: undefined,
    utmContent: undefined,
  }));
  it("rejects malformed values", () => expect(parseEntryIntent({gameMode: "admin", campaign: {}})).toEqual({
    inviteKind: undefined,
    gameMode: undefined,
    campaign: undefined,
    reference: undefined,
    challengeDestination: undefined,
    customName: undefined,
    inviterName: undefined,
    challengeId: undefined,
    riddleId: undefined,
    notificationTemplate: undefined,
    notificationOffset: undefined,
    callback: undefined,
    utmSource: undefined,
    utmMedium: undefined,
    utmCampaign: undefined,
    utmTerm: undefined,
    utmContent: undefined,
  }));
  it("captures notification attribution without trusting unrelated payload fields", () => expect(parseEntryIntent({
    gameMode: "challenge",
    reference: "notification_d3_v3",
    notification_template: "streak_progress_v3",
    notification_offset: "D3",
    callback: "daily_streak",
    redirect: "https://malicious.invalid",
  })).toEqual({
    inviteKind: undefined,
    gameMode: "challenge",
    campaign: undefined,
    reference: "notification_d3_v3",
    challengeDestination: undefined,
    customName: undefined,
    inviterName: undefined,
    challengeId: undefined,
    riddleId: undefined,
    notificationTemplate: "streak_progress_v3",
    notificationOffset: "D3",
    callback: "daily_streak",
    utmSource: undefined,
    utmMedium: undefined,
    utmCampaign: undefined,
    utmTerm: undefined,
    utmContent: undefined,
  }));

  it("captures Jest-preserved paid acquisition attribution", () => expect(parseEntryIntent({
    utm_source: "instagram",
    utm_medium: "paid_social",
    utm_campaign: "launch_2026",
    utm_term: "riddle_game",
    utm_content: "video_a",
  })).toEqual(expect.objectContaining({
    utmSource: "instagram",
    utmMedium: "paid_social",
    utmCampaign: "launch_2026",
    utmTerm: "riddle_game",
    utmContent: "video_a",
  })));

  it("accepts standard UTM query parameters when the platform preserves them on the game URL", () => {
    expect(parseEntryIntent({}, "?utm_source=creator&utm_medium=social&utm_campaign=launch")).toEqual(
      expect.objectContaining({
        utmSource: "creator",
        utmMedium: "social",
        utmCampaign: "launch",
      }),
    );
  });

  it("distinguishes a result share from a Race-to-10 invite", async () => {
    const {resolveRaceChallengeId} = await import("../entryIntent");
    expect(resolveRaceChallengeId(parseEntryIntent({
      inviteKind: "result",
      campaign: "friend_challenge_v2",
      challengeId: "legacy-riddle-id",
    }))).toBeUndefined();
    expect(resolveRaceChallengeId(parseEntryIntent({
      inviteKind: "race",
      challengeId: "race-42",
    }))).toBe("race-42");
    expect(resolveRaceChallengeId(parseEntryIntent({
      campaign: "race_to_10_v1",
      challengeId: "legacy-race-42",
    }))).toBe("legacy-race-42");
  });

  it("rejects empty and oversized acquisition values", () => {
    expect(parseEntryIntent({utm_source: "", utm_medium: "x".repeat(161)})).toEqual(expect.objectContaining({
      utmSource: undefined,
      utmMedium: undefined,
    }));
  });
});

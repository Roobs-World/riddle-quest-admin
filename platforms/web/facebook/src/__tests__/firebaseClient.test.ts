import {describe, expect, test} from "@jest/globals";
import {
  parseFacebookClientConfiguration,
  parseFacebookContextBoardResponse,
  parseFacebookContextRecordResponse,
  parseFacebookNotificationPromptAcceptance,
  parseFacebookNotificationPromptClaim,
  parseFacebookTournamentRecordResponse,
  parseFacebookTournamentResponse,
} from "../facebookCallableResponses";

/** Provides configuration behavior. */
const configuration = {
  interstitialsEnabled: false,
  notificationsEnabled: false,
  commerceEnabled: false,
  rewardedAdsEnabled: false,
  referralsEnabled: true,
  matchmakingEnabled: true,
  tournamentsEnabled: true,
  presenceEnabled: true,
  removeInterstitialAds: false,
};

describe("Facebook callable response validation", () => {
  test("accepts only the exact all-boolean capability projection", () => {
    expect(parseFacebookClientConfiguration(configuration)).toEqual(configuration);
    for (const invalid of [
      null,
      {...configuration, presenceEnabled: "true"},
      {...configuration, removeInterstitialAds: undefined},
      {...configuration, extraCapability: true},
    ])
      expect(() => parseFacebookClientConfiguration(invalid)).toThrow("configuration response");
  });

  test("accepts only exact bounded notification prompt lease responses", () => {
    expect(parseFacebookNotificationPromptClaim({granted: false})).toEqual({granted: false});
    expect(parseFacebookNotificationPromptClaim({granted: true, claimedAtMs: 123})).toEqual({
      granted: true,
      claimedAtMs: 123,
    });
    expect(parseFacebookNotificationPromptAcceptance({accepted: true})).toBeUndefined();
    for (const invalid of [
      null,
      {granted: true},
      {granted: true, claimedAtMs: -1},
      {granted: true, claimedAtMs: 1.5},
      {granted: false, claimedAtMs: 1},
      {granted: false, extra: true},
    ])
      expect(() => parseFacebookNotificationPromptClaim(invalid)).toThrow("prompt claim response");
    for (const invalid of [null, {accepted: false}, {accepted: true, extra: true}]) {
      expect(() => parseFacebookNotificationPromptAcceptance(invalid)).toThrow("acceptance response");
    }
  });

  test("rejects forged social fields, windows, IDs, ordering, ranks, and player projections", () => {
    /** Provides tournament behavior. */
    const tournament = {
      tournamentId: "facebook-race10-ja-1970-01-01",
      locale: "ja",
      startsAtMs: 0,
      endsAtMs: 86_400_000,
      sortOrder: "LOWER_IS_BETTER",
      rewardsEnabled: false,
      standings: [{rank: 1, adjustedTimeMs: 123, isCurrentPlayer: true}],
      currentPlayer: {rank: 1, adjustedTimeMs: 123, isCurrentPlayer: true},
    };
    expect(parseFacebookTournamentResponse(tournament)).toEqual(tournament);
    for (const forged of [
      {...tournament, rewardsEnabled: true},
      {...tournament, locale: "unsupported"},
      {...tournament, standings: [{...tournament.standings[0], userId: "facebook-secret"}]},
      {...tournament, standings: [{rank: 1, adjustedTimeMs: -1, isCurrentPlayer: true}]},
      {
        ...tournament,
        standings: [{rank: 1, adjustedTimeMs: 300_001, isCurrentPlayer: true}],
        currentPlayer: {rank: 1, adjustedTimeMs: 300_001, isCurrentPlayer: true},
      },
      {...tournament, endsAtMs: 86_399_999},
      {...tournament, tournamentId: "facebook-race10-ja-1970-01-02"},
      {...tournament, startsAtMs: 1, endsAtMs: 86_400_001},
      {
        ...tournament,
        startsAtMs: 253_402_214_400_000,
        endsAtMs: 253_402_300_800_000,
        tournamentId: "facebook-race10-ja-9999-12-31",
      },
      {
        ...tournament,
        standings: [{rank: 2, adjustedTimeMs: 123, isCurrentPlayer: true}],
        currentPlayer: {rank: 2, adjustedTimeMs: 123, isCurrentPlayer: true},
      },
      {
        ...tournament,
        standings: [
          {rank: 1, adjustedTimeMs: 124, isCurrentPlayer: false},
          {rank: 2, adjustedTimeMs: 123, isCurrentPlayer: true},
        ],
        currentPlayer: {rank: 2, adjustedTimeMs: 123, isCurrentPlayer: true},
      },
      {
        ...tournament,
        standings: [
          {rank: 1, adjustedTimeMs: 123, isCurrentPlayer: true},
          {rank: 1, adjustedTimeMs: 123, isCurrentPlayer: true},
        ],
      },
      {...tournament, currentPlayer: {...tournament.currentPlayer, adjustedTimeMs: 124}},
      {...tournament, standings: [{...tournament.standings[0], isCurrentPlayer: false}]},
    ])
      expect(() => parseFacebookTournamentResponse(forged)).toThrow("tournament standings response");

    /** Provides tied tournament behavior. */
    const tiedTournament = {
      ...tournament,
      standings: [
        {rank: 1, adjustedTimeMs: 100, isCurrentPlayer: false},
        {rank: 1, adjustedTimeMs: 100, isCurrentPlayer: false},
        {rank: 3, adjustedTimeMs: 200, isCurrentPlayer: true},
      ],
      currentPlayer: {rank: 3, adjustedTimeMs: 200, isCurrentPlayer: true},
    };
    expect(parseFacebookTournamentResponse(tiedTournament)).toEqual(tiedTournament);

    /** Provides context behavior. */
    const context = {
      locale: "ja",
      startsAtMs: 0,
      endsAtMs: 604_800_000,
      sortOrder: "LOWER_IS_BETTER",
      rewardsEnabled: false,
      standings: [],
    };
    expect(parseFacebookContextBoardResponse(context)).toEqual(context);
    expect(() => parseFacebookContextBoardResponse({...context, coins: 100})).toThrow("context board response");
    expect(() => parseFacebookContextBoardResponse({...context, endsAtMs: 604_800_001})).toThrow(
      "context board response",
    );
    expect(() =>
      parseFacebookContextBoardResponse({
        ...context,
        startsAtMs: 253_401_696_000_000,
        endsAtMs: 253_402_300_800_000,
      }),
    ).toThrow("context board response");

    /** Provides tournament record behavior. */
    const tournamentRecord = {
      tournamentId: "facebook-race10-ja-2026-08-20",
      locale: "ja",
      runId: "run-1",
      adjustedTimeMs: 45_000,
      completedAtMs: 1_787_184_000_000,
      improved: true,
      sortOrder: "LOWER_IS_BETTER",
      rewardsEnabled: false,
    };
    expect(parseFacebookTournamentRecordResponse(tournamentRecord)).toEqual(tournamentRecord);
    expect(() =>
      parseFacebookTournamentRecordResponse({
        ...tournamentRecord,
        tournamentId: "facebook-race10-ja-2026-08-19",
      }),
    ).toThrow("tournament record response");
    expect(() =>
      parseFacebookTournamentRecordResponse({
        ...tournamentRecord,
        adjustedTimeMs: 300_001,
      }),
    ).toThrow("tournament record response");

    /** Provides context record behavior. */
    const contextRecord = {
      locale: "ja",
      runId: "run-1",
      adjustedTimeMs: 45_000,
      completedAtMs: 1_787_184_000_000,
      improved: true,
      sortOrder: "LOWER_IS_BETTER",
      rewardsEnabled: false,
    };
    expect(parseFacebookContextRecordResponse(contextRecord)).toEqual(contextRecord);
    expect(() =>
      parseFacebookContextRecordResponse({
        ...contextRecord,
        completedAtMs: 253_402_300_800_000,
      }),
    ).toThrow("context record response");
  });
});

/** Provides mock record behavior. */
const mockRecord = jest.fn();
/** Provides mock list behavior. */
const mockList = jest.fn();
/** Provides mock feature enabled behavior. */
const mockFeatureEnabled = jest.fn(() => true);

jest.mock("../../shared/sentryHandlers", () => ({
  onCallWithSentry: jest.fn((_name: string, _options: unknown, handler: unknown) => handler),
}));
jest.mock("../../race/facebookTournament", () => ({
  FACEBOOK_TOURNAMENT_SORT_ORDER: "LOWER_IS_BETTER",
  recordFacebookTournamentRun: (...args: unknown[]) => mockRecord(...args),
  listFacebookTournamentStandings: (...args: unknown[]) => mockList(...args),
}));
jest.mock("../../facebook/facebookFeatureFlags", () => ({
  isFacebookFeatureEnabled: (...args: unknown[]) => mockFeatureEnabled(...args),
}));

import type {CallableRequest} from "firebase-functions/v2/https";
import {listFacebookTournament, recordFacebookTournament} from "../../race/facebookTournamentCallable";

/** Handles r. */
const handler = recordFacebookTournament as unknown as (request: CallableRequest<unknown>) => Promise<unknown>;
/** Lists handler. */
const listHandler = listFacebookTournament as unknown as (request: CallableRequest<unknown>) => Promise<unknown>;
/** Provides uid behavior. */
const uid = `facebook_${"a".repeat(40)}`;
/** Provides request behavior. */
const request = (
  data: unknown,
  auth: CallableRequest<unknown>["auth"] = {
    uid,
    token: {provider: "facebook"},
  },
) => ({auth, data}) as CallableRequest<unknown>;

describe("recordFacebookTournament callable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureEnabled.mockReturnValue(true);
    mockRecord.mockResolvedValue({
      entry: {
        tournamentId: "facebook-race10-ja-2026-08-19",
        locale: "ja",
        runId: "run-1",
        adjustedTimeMs: 45_000,
        completedAtMs: 1_000_000,
      },
      improved: true,
    });
    mockList.mockResolvedValue({
      tournamentId: "facebook-race10-ja-2026-08-19",
      locale: "ja",
      startsAtMs: 1,
      endsAtMs: 2,
      sortOrder: "LOWER_IS_BETTER",
      rewardsEnabled: false,
      standings: [{rank: 1, adjustedTimeMs: 45_000, isCurrentPlayer: true}],
      currentPlayer: {rank: 1, adjustedTimeMs: 45_000, isCurrentPlayer: true},
    });
  });

  it("lists only identity-free authoritative standings for the requested locale", async () => {
    await expect(listHandler(request({locale: "ja"}))).resolves.toMatchObject({
      locale: "ja",
      rewardsEnabled: false,
      standings: [{rank: 1, adjustedTimeMs: 45_000, isCurrentPlayer: true}],
    });
    expect(mockList).toHaveBeenCalledWith(uid, "ja");
    expect(JSON.stringify(await listHandler(request({locale: "ja"})))).not.toContain(uid);
  });

  it("accepts only a score-free request from a Facebook custom-auth identity", async () => {
    await expect(handler(request({runId: "run-1", locale: "ja"}))).resolves.toEqual({
      tournamentId: "facebook-race10-ja-2026-08-19",
      locale: "ja",
      runId: "run-1",
      adjustedTimeMs: 45_000,
      completedAtMs: 1_000_000,
      improved: true,
      sortOrder: "LOWER_IS_BETTER",
      rewardsEnabled: false,
    });
    expect(mockRecord).toHaveBeenCalledWith(uid, {runId: "run-1", locale: "ja"});
    await expect(handler(request({runId: "run-1", locale: "ja", score: 1}))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects missing, Jest, and mismatched provider identities", async () => {
    await expect(handler({auth: undefined, data: {}} as CallableRequest<unknown>)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(
      handler(request({}, {uid: `jest_${"b".repeat(40)}`, token: {provider: "jest"}})),
    ).rejects.toMatchObject({code: "permission-denied"});
    await expect(handler(request({}, {uid, token: {provider: "jest"}}))).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("fails closed when the Facebook tournament kill switch is off", async () => {
    mockFeatureEnabled.mockReturnValue(false);
    await expect(handler(request({runId: "run-1", locale: "ja"}))).rejects.toMatchObject({code: "unavailable"});
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
